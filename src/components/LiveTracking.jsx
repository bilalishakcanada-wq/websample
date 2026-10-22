import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { BellRing, CheckCircle2, Clock3, MapPin, Navigation, Radio, Square } from 'lucide-react'
import { liveLocationService } from '../services/liveLocationService'
import { backgroundLocationSupported, distanceMeters, keepScreenOn, locationSupported, watchLocation } from '../utils/location'
import { haptic, isNativeApp } from '../utils/native'
import { toast } from './Toaster'
import { useListingAddress } from '../hooks/queries'
import './LiveTracking.css'
import { isJobShareAuto } from '../utils/jobShare'
import { locationPermission } from '../utils/permissions'

const LiveTrackingMap = lazy(() => import('./LiveTrackingMap'))

const FRESH_MS = 3 * 60 * 1000          // older than this: "lokacija nije osvježena"
const SEND_EVERY_MS = 15 * 1000         // send at least this often while moving slowly
const SEND_AFTER_M = 25                 // …or as soon as the provider moved this far
const CITY_SPEED = 30 / 3.6             // m/s when the phone doesn't report speed
const ASK_AGAIN_MS = 2 * 60 * 1000      // same cooldown as request_live_location (booking/06)
const SHARE_MINUTES = 120                // one sharing lasts 2 h, then stops by itself (sd's choice)

const daleko = (m) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toLocaleString('hr-HR', { maximumFractionDigits: 1 })} km`)
const ostalo = (ms) => {
  const min = Math.max(1, Math.round(ms / 60000))
  return min >= 60 ? `još ${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ''}` : `još ${min} min`
}
const prije = (ms) => (ms < 60000 ? `prije ${Math.max(1, Math.round(ms / 1000))} s` : `prije ${Math.round(ms / 60000)} min`)

/**
 * The job's point is its town (listings keep the town centre, not the street), so closer than ~3 km the
 * provider is simply "in town"; further out: road ≈ 1.3 × straight line, speed from GPS when it reports one.
 */
const IN_TOWN_M = 3000
// on the phone while the provider drives with another app open (maps, calls): Android shows it as long as it runs
const SHARING_NOTICE = { title: 'Dijeliš lokaciju s klijentom', message: 'Klijent vidi gdje si dok ne stigneš. Zaustavi u Zadatku.', distanceFilter: 10 }
function eta(distance, speed) {
  const v = speed && speed > 2 ? speed : CITY_SPEED
  const min = Math.max(1, Math.round((distance * 1.3) / v / 60))
  return min >= 60 ? `oko ${Math.floor(min / 60)} h ${min % 60} min` : `oko ${min} min`
}

/**
 * „Izvođač je na putu“: one component for the laptop browser, the phone browser and the iOS/Android app.
 *  - client: can ask for the provider's location ("Zatraži lokaciju"); the provider gets a notification and decides;
 *  - provider: shares on their own or answers the request, for 2 h at most; "Stigao sam" ends it and tells the client;
 *  - the provider's point moves on the client's map live through Supabase Realtime, with distance and arrival time.
 * Shown only on on-site jobs while the work is in progress, and only once supabase/booking/05 is in the database
 * (asking and the time limit need booking/06; without it the card works as before).
 */
function LiveTracking({ payment, listing, role }) {
  const isProvider = role === 'provider'
  const active = payment.status === 'funded' && ['in_progress', 'revision'].includes(payment.work_state || 'in_progress')
  const onSite = !/online/i.test(listing?.location || '')
  const town = (listing?.location || '').split(',')[0].trim()
  // the exact address when the client gave one (both people here may read it), else the job's public point
  const exact = useListingAddress(listing?.id, onSite)
  const destination = exact ? { lat: exact.lat, lng: exact.lng } : listing?.lat != null && listing?.lng != null ? { lat: listing.lat, lng: listing.lng } : null

  const [available, setAvailable] = useState(false)
  const [row, setRow] = useState(null)          // last point the server has
  const [canAsk, setCanAsk] = useState(false)   // booking/06 is in the database
  const [request, setRequest] = useState(null)  // { state: 'pending' | 'declined', requested_at }
  const [sharing, setSharing] = useState(false)
  const [until, setUntil] = useState(null)      // provider: when this sharing ends (ms)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const [mine, setMine] = useState(null)        // provider: own live position (map follows it without waiting for the server)
  const lastSent = useRef(null)
  const firstMinutes = useRef(null)             // the chosen duration goes with the first point only

  // what the server has now + live updates (both roles); a slow poll covers missed realtime events and the "stopped" case
  useEffect(() => {
    if (!active || !onSite) return undefined
    let alive = true
    const load = () => {
      liveLocationService.current(payment.id).then(({ available: ok, row: r }) => {
        if (!alive) return
        setAvailable(ok)
        setRow(r)
        // asking needs booking/06; only looked up where tracking itself exists
        if (ok) liveLocationService.request(payment.id).then(({ available: can, request: q }) => { if (alive) { setCanAsk(can); setRequest(q) } })
      })
    }
    load()
    const off = liveLocationService.subscribe(payment.id, (r) => setRow(r), (q) => setRequest(q))
    const poll = window.setInterval(load, 30000)
    const tick = window.setInterval(() => setNow(Date.now()), 5000)
    return () => { alive = false; off(); window.clearInterval(poll); window.clearInterval(tick) }
  }, [payment.id, active, onSite])

  const stopSharing = (how = 'stop') => {
    setSharing(false)
    setMine(null)
    setUntil(null)
    const done = how === 'arrived' ? liveLocationService.arrived(payment.listing_id) : liveLocationService.stop(payment.listing_id)
    done.then(() => setRow(null)).catch(() => {})
  }

  // provider sends while sharing; stops on leaving the page, on "Zaustavi"/"Stigao sam", at the time limit, or when the job moves on
  useEffect(() => {
    if (!sharing || !active) return undefined
    let releaseScreen = () => {}
    keepScreenOn().then((release) => { releaseScreen = release })
    const stop = watchLocation((point) => {
      setMine(point)
      setError('')
      const last = lastSent.current
      const due = !last || Date.now() - last.at > SEND_EVERY_MS || distanceMeters(last, point) > SEND_AFTER_M
      if (!due) return
      lastSent.current = { ...point, at: Date.now() }
      const first = firstMinutes.current
      firstMinutes.current = null
      liveLocationService.share(payment.listing_id, point, first).catch((e) => {
        if (first) firstMinutes.current = first
        if (e.expired) { stopSharing(); toast('Vrijeme dijeljenja lokacije je isteklo.'); return }
        setError(e.message)
      })
    }, (message) => setError(message), { background: SHARING_NOTICE })
    return () => { stop(); releaseScreen() }
  }, [sharing, active, payment.listing_id]) // eslint-disable-line react-hooks/exhaustive-deps

  // time limit on the provider's phone (the database refuses points after it anyway)
  useEffect(() => {
    if (!sharing || !until) return undefined
    const left = until - Date.now()
    const id = window.setTimeout(() => { stopSharing(); toast('Vrijeme dijeljenja lokacije je isteklo. Možeš ga ponovo uključiti.') }, Math.max(0, left))
    return () => window.clearTimeout(id)
  }, [sharing, until]) // eslint-disable-line react-hooks/exhaustive-deps

  // Postavke → Lokacija → "Dijeli tokom posla": the client's request is answered by itself, once per request
  const autoAnswered = useRef(null)
  useEffect(() => {
    if (!isProvider || !active || !onSite || !available || sharing || request?.state !== 'pending' || !isJobShareAuto()) return
    if (autoAnswered.current === request.requested_at) return
    autoAnswered.current = request.requested_at
    locationPermission().then((state) => {
      if (state !== 'granted') return
      lastSent.current = null
      firstMinutes.current = SHARE_MINUTES
      setUntil(Date.now() + SHARE_MINUTES * 60000)
      setSharing(true)
      setError('')
      toast('Klijent je zatražio lokaciju i dijeliš je automatski. Isključuješ u Postavke → Lokacija.', { kind: 'info', duration: 5000 })
    })
  }, [isProvider, active, onSite, available, sharing, request?.state, request?.requested_at])

  if (!active || !onSite || !available) return null
  if (isProvider && !locationSupported()) return null

  const shareEnds = row?.share_until ? new Date(row.share_until).getTime() : null
  const visibleRow = row && (!shareEnds || shareEnds > now) ? row : null
  const point = isProvider && sharing && mine ? mine : visibleRow
  const age = visibleRow ? now - new Date(visibleRow.updated_at).getTime() : null
  const fresh = isProvider ? Boolean(point) : Boolean(visibleRow) && age < FRESH_MS
  const distance = point && destination ? distanceMeters(point, destination) : null
  const askedAt = request?.requested_at ? new Date(request.requested_at).getTime() : null
  const askWait = askedAt ? Math.max(0, askedAt + ASK_AGAIN_MS - now) : 0
  const pending = request?.state === 'pending'
  const leftMs = isProvider ? (until ? until - now : null) : (shareEnds ? shareEnds - now : null)

  const start = () => {
    haptic('medium')
    lastSent.current = null
    firstMinutes.current = SHARE_MINUTES
    setUntil(Date.now() + SHARE_MINUTES * 60000)
    setSharing(true)
    setError('')
    toast('Klijent te sada vidi na mapi dok dolaziš.', { kind: 'success' })
  }
  const arrived = () => {
    haptic('medium')
    stopSharing('arrived')
    toast('Javili smo klijentu da si stigao.', { kind: 'success' })
  }
  const ask = async () => {
    haptic('light')
    setBusy(true)
    setError('')
    try {
      await liveLocationService.ask(payment.listing_id)
      setRequest({ state: 'pending', requested_at: new Date().toISOString() })
      setNow(Date.now())
      toast('Zahtjev je poslan izvođaču.', { kind: 'success' })
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }
  const decline = async () => {
    setBusy(true)
    try {
      await liveLocationService.decline(payment.listing_id)
      setRequest((q) => (q ? { ...q, state: 'declined' } : q))
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  // client while the provider isn't sharing: ask for the location, or wait for the answer
  if (!isProvider && !visibleRow) {
    if (!canAsk) {
      return (
        <div className="live-track live-track-idle" data-testid="live-tracking">
          <Navigation size={16} /> Kad izvođač krene prema tebi, ovdje ćeš ga vidjeti na mapi uživo.
        </div>
      )
    }
    return (
      <section className="live-track live-track-ask" data-testid="live-tracking" aria-live="polite">
        <span className={`live-track-icon${pending ? ' is-waiting' : ''}`} aria-hidden="true">{pending ? <Clock3 size={20} /> : <MapPin size={20} />}</span>
        <div className="live-track-info">
          <strong className="live-track-title">
            {pending ? 'Zahtjev je poslan' : request?.state === 'declined' ? 'Izvođač trenutno ne dijeli lokaciju' : 'Gdje je izvođač?'}
          </strong>
          <p className="muted-text">
            {pending
              ? `Čekamo da izvođač uključi lokaciju. Poslano ${prije(now - askedAt)}.`
              : request?.state === 'declined'
                ? 'Izvođač je vidio zahtjev. Možeš ga pitati ponovo ili mu pisati u porukama.'
                : 'Zatraži lokaciju i vidjet ćeš ga na mapi uživo dok dolazi, s vremenom dolaska.'}
          </p>
          {error && <p className="form-error">{error}</p>}
          <button type="button" className={`${pending ? 'ghost-button' : 'primary-button'} live-track-btn`} onClick={ask}
            disabled={busy || askWait > 0} data-testid="live-ask">
            <BellRing size={15} /> {askWait > 0 ? `Ponovo za ${Math.ceil(askWait / 60000)} min` : request ? 'Pitaj ponovo' : 'Zatraži lokaciju'}
          </button>
        </div>
      </section>
    )
  }

  const asked = isProvider && !sharing && pending
  return (
    <section className={`live-track${isNativeApp() ? ' is-app' : ''}${asked ? ' live-track-asked' : ''}`} data-testid="live-tracking" aria-live="polite">
      <div className="live-track-info">
        <strong className="live-track-title">
          {asked ? <BellRing size={16} /> : fresh ? <span className="live-dot" aria-hidden="true" /> : <Radio size={15} />}
          {isProvider
            ? (sharing ? 'Dijeliš lokaciju uživo' : asked ? 'Klijent traži tvoju lokaciju' : 'Na putu do posla?')
            : fresh ? 'Izvođač je na putu' : 'Lokacija izvođača nije osvježena'}
        </strong>
        {leftMs != null && leftMs > 0 && (isProvider ? sharing : fresh) && (
          <span className="live-track-left" data-testid="live-left"><Clock3 size={13} /> {ostalo(leftMs)}</span>
        )}
        {distance != null && (fresh || isProvider) && (isProvider ? sharing : true) && (
          distance < IN_TOWN_M
            ? <p className="live-track-eta">{isProvider ? `Stigao si u mjesto posla${town ? ` (${town})` : ''}.` : `U mjestu posla${town ? ` (${town})` : ''}, samo što nije stigao.`}</p>
            : <p className="live-track-eta"><b>{daleko(distance)}</b> od mjesta posla{town ? ` (${town})` : ''} · {isProvider ? 'stižeš' : 'stiže'} za <b>{eta(distance, point?.speed ?? point?.speed_mps)}</b></p>
        )}
        {!isProvider && visibleRow && <p className="muted-text">Zadnje javljanje {prije(age)}{visibleRow.accuracy_m ? ` · tačnost ±${Math.round(visibleRow.accuracy_m)} m` : ''}</p>}
        {isProvider && !sharing && (
          <p className="muted-text">
            {asked
              ? `Zatraženo ${prije(now - askedAt)}. Vidi te samo klijent ovog posla, najviše 2 sata ili dok ne javiš da si stigao.`
              : 'Kad kreneš, uključi dijeljenje: klijent vidi gdje si i kad stižeš. Traje najviše 2 sata, a ugasiš ga kad hoćeš.'}
          </p>
        )}
        {isProvider && sharing && <p className="muted-text">{backgroundLocationSupported() ? 'Lokacija se šalje i kad otvoriš drugu aplikaciju ili zaključaš ekran; na telefonu stoji obavijest dok dijeliš.' : 'Drži Zadatak otvoren dok voziš; lokacija se ne šalje kad je ekran zaključan.'}</p>}
        {error && <p className="form-error">{error}</p>}
        {isProvider && (
          sharing
            ? (
              <div className="live-track-actions">
                <button type="button" className="primary-button live-track-btn" onClick={arrived} data-testid="live-arrived"><CheckCircle2 size={15} /> Stigao sam</button>
                <button type="button" className="ghost-button live-track-btn" onClick={() => stopSharing()} data-testid="live-stop"><Square size={15} /> Zaustavi</button>
              </div>
            )
            : (
              <div className="live-track-actions">
                <button type="button" className="primary-button live-track-btn" onClick={start} data-testid="live-start">
                  <Navigation size={15} /> {asked ? 'Dijeli lokaciju' : 'Krećem, dijeli lokaciju'}
                </button>
                {asked && <button type="button" className="ghost-button live-track-btn" onClick={decline} disabled={busy} data-testid="live-decline">Ne sada</button>}
              </div>
            )
        )}
      </div>
      {(point || destination) && (isProvider ? sharing : true) && (
        <Suspense fallback={<div className="live-map live-map-loading" aria-busy="true" />}>
          <LiveTrackingMap key={destination ? `${destination.lat},${destination.lng}` : 'none'} destination={destination} provider={fresh ? point : null} />
        </Suspense>
      )}
    </section>
  )
}

export default LiveTracking
