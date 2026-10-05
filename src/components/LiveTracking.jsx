import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Navigation, Radio, Square } from 'lucide-react'
import { liveLocationService } from '../services/liveLocationService'
import { distanceMeters, keepScreenOn, locationSupported, watchLocation } from '../utils/location'
import { haptic, isNativeApp } from '../utils/native'
import { toast } from './Toaster'
import './LiveTracking.css'

const LiveTrackingMap = lazy(() => import('./LiveTrackingMap'))

const FRESH_MS = 3 * 60 * 1000          // older than this: "lokacija nije osvježena"
const SEND_EVERY_MS = 15 * 1000         // send at least this often while moving slowly
const SEND_AFTER_M = 25                 // …or as soon as the provider moved this far
const CITY_SPEED = 30 / 3.6             // m/s when the phone doesn't report speed

const daleko = (m) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toLocaleString('bs-BA', { maximumFractionDigits: 1 })} km`)
const prije = (ms) => (ms < 60000 ? `prije ${Math.max(1, Math.round(ms / 1000))} s` : `prije ${Math.round(ms / 60000)} min`)

/**
 * The job's point is its town (listings keep the town centre, not the street), so closer than ~3 km the
 * provider is simply "in town"; further out: road ≈ 1.3 × straight line, speed from GPS when it reports one.
 */
const IN_TOWN_M = 3000
function eta(distance, speed) {
  const v = speed && speed > 2 ? speed : CITY_SPEED
  const min = Math.max(1, Math.round((distance * 1.3) / v / 60))
  return min >= 60 ? `oko ${Math.floor(min / 60)} h ${min % 60} min` : `oko ${min} min`
}

/**
 * „Izvođač je na putu“: one component for the laptop browser, the phone browser and the iOS/Android app.
 *  - provider: "Krećem" starts sending the position (native GPS in the app, HTML5 Geolocation in a browser);
 *  - client: the provider's point moves on the map live through Supabase Realtime, with distance and arrival time.
 * Shown only on on-site jobs while the work is in progress, and only once supabase/booking/05 is in the database.
 */
function LiveTracking({ payment, listing, role }) {
  const isProvider = role === 'provider'
  const active = payment.status === 'funded' && ['in_progress', 'revision'].includes(payment.work_state || 'in_progress')
  const onSite = !/online/i.test(listing?.location || '')
  const town = (listing?.location || '').split(',')[0].trim()
  const destination = listing?.lat != null && listing?.lng != null ? { lat: listing.lat, lng: listing.lng } : null

  const [available, setAvailable] = useState(false)
  const [row, setRow] = useState(null)          // last point the server has
  const [sharing, setSharing] = useState(false)
  const [error, setError] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const [mine, setMine] = useState(null)        // provider: own live position (map follows it without waiting for the server)
  const lastSent = useRef(null)

  // what the server has now + live updates (both roles); a slow poll covers missed realtime events and the "stopped" case
  useEffect(() => {
    if (!active || !onSite) return undefined
    let alive = true
    const load = () => liveLocationService.current(payment.id).then(({ available: ok, row: r }) => { if (alive) { setAvailable(ok); setRow(r) } })
    load()
    const off = liveLocationService.subscribe(payment.id, (r) => setRow(r))
    const poll = window.setInterval(load, 30000)
    const tick = window.setInterval(() => setNow(Date.now()), 5000)
    return () => { alive = false; off(); window.clearInterval(poll); window.clearInterval(tick) }
  }, [payment.id, active, onSite])

  // provider sends while sharing; stops on leaving the page, on "Zaustavi", or when the job moves on
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
      liveLocationService.share(payment.listing_id, point).catch((e) => setError(e.message))
    }, (message) => setError(message))
    return () => { stop(); releaseScreen() }
  }, [sharing, active, payment.listing_id])

  if (!active || !onSite || !available) return null
  if (isProvider && !locationSupported()) return null

  const point = isProvider && sharing && mine ? mine : row
  const age = row ? now - new Date(row.updated_at).getTime() : null
  const fresh = isProvider ? Boolean(point) : Boolean(row) && age < FRESH_MS
  const distance = point && destination ? distanceMeters(point, destination) : null

  const start = () => {
    haptic('medium')
    lastSent.current = null
    setSharing(true)
    toast('Klijent te sada vidi na mapi dok dolaziš.', { kind: 'success' })
  }
  const stop = () => {
    setSharing(false)
    setMine(null)
    liveLocationService.stop(payment.listing_id).then(() => setRow(null)).catch(() => {})
  }

  // client before the provider sets off: one quiet line, no empty map
  if (!isProvider && !row) {
    return (
      <div className="live-track live-track-idle" data-testid="live-tracking">
        <Navigation size={16} /> Kad izvođač krene prema tebi, ovdje ćeš ga vidjeti na mapi uživo.
      </div>
    )
  }

  return (
    <section className={`live-track${isNativeApp() ? ' is-app' : ''}`} data-testid="live-tracking" aria-live="polite">
      <div className="live-track-info">
        <strong className="live-track-title">
          {fresh ? <span className="live-dot" aria-hidden="true" /> : <Radio size={15} />}
          {isProvider ? (sharing ? 'Dijeliš lokaciju uživo' : 'Na putu do posla?') : fresh ? 'Izvođač je na putu' : 'Lokacija izvođača nije osvježena'}
        </strong>
        {distance != null && (fresh || isProvider) && (
          distance < IN_TOWN_M
            ? <p className="live-track-eta">{isProvider ? `Stigao si u mjesto posla${town ? ` (${town})` : ''}.` : `U mjestu posla${town ? ` (${town})` : ''}, samo što nije stigao.`}</p>
            : <p className="live-track-eta"><b>{daleko(distance)}</b> od mjesta posla{town ? ` (${town})` : ''} · {isProvider ? 'stižeš' : 'stiže'} za <b>{eta(distance, point?.speed ?? point?.speed_mps)}</b></p>
        )}
        {!isProvider && row && <p className="muted-text">Zadnje javljanje {prije(age)}{row.accuracy_m ? ` · tačnost ±${Math.round(row.accuracy_m)} m` : ''}</p>}
        {isProvider && !sharing && <p className="muted-text">Kad kreneš, uključi dijeljenje: klijent vidi gdje si i kad stižeš. Gasi se samo kad predaš rad.</p>}
        {isProvider && sharing && <p className="muted-text">Drži Zadatak otvoren dok voziš; lokacija se ne šalje kad je ekran zaključan.</p>}
        {error && <p className="form-error">{error}</p>}
        {isProvider && (
          sharing
            ? <button type="button" className="ghost-button live-track-btn" onClick={stop} data-testid="live-stop"><Square size={15} /> Zaustavi dijeljenje</button>
            : <button type="button" className="primary-button live-track-btn" onClick={start} data-testid="live-start"><Navigation size={15} /> Krećem, dijeli lokaciju</button>
        )}
      </div>
      {(point || destination) && (isProvider ? sharing : true) && (
        <Suspense fallback={<div className="live-map live-map-loading" aria-busy="true" />}>
          <LiveTrackingMap destination={destination} provider={fresh ? point : null} />
        </Suspense>
      )}
    </section>
  )
}

export default LiveTracking
