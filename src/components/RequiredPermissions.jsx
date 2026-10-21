import { useCallback, useEffect, useRef, useState } from 'react'
import { BellRing, Check, MapPin, Settings } from 'lucide-react'
import { useBackToClose } from '../hooks/useBackToClose'
import { isNativeApp } from '../utils/native'
import { backgroundLocationSupported } from '../utils/location'
import { locationPermission, openAppSettings, PERMISSION_RULES, permissionStatus, permissionSteps, requestLocation, requestNotifications, requiredOk, snoozePermission } from '../utils/permissions'
import { liveReachUndecided, setLiveReach } from '../utils/liveReach'
import './RequiredPermissions.css'

const passes = (state) => state === 'granted' || state === 'unsupported'

const STEPS = {
  location: {
    icon: MapPin,
    title: 'Poveži svoju lokaciju',
    text: {
      account: 'Zadatak po lokaciji zna koliko si daleko od posla, pokazuje poslove u blizini i majstoru olakšava da dođe.',
      post: 'Po lokaciji tvoj posao prvo vide majstori u blizini.',
      offer: 'Klijent vidi koliko si daleko i kad možeš doći.',
      search: 'Pokazujemo poslove oko tebe i koliko je svaki daleko, da ne tražiš naslijepo po cijeloj državi.',
    },
    // Google Play: the disclosure says plainly that the app keeps using it with Zadatak in the background
    note: () => (backgroundLocationSupported()
      ? 'Dok je Lokacija uživo uključena, radi i kad je Zadatak u pozadini, a na telefonu tada stoji obavijest. Isključuješ je u Postavke → Lokacija.'
      : 'Koristi se dok je Zadatak otvoren. Lokaciju uživo isključuješ u Postavke → Lokacija.'),
    ask: requestLocation,
  },
  notifications: {
    icon: BellRing,
    title: 'Uključi obavijesti',
    text: {
      account: 'Da ti ništa ne promakne: nove ponude, poruke i plaćanja stižu odmah, i kad je aplikacija zatvorena.',
      post: 'Čim majstor pošalje ponudu ili poruku, javićemo ti odmah, i kad je aplikacija zatvorena.',
      offer: 'Čim klijent prihvati ponudu ili ti pošalje poruku, javićemo ti odmah.',
    },
    note: () => 'Možeš ih uvijek isključiti u postavkama.',
    ask: requestNotifications,
  },
}

const blockedHelp = (kind) => {
  const what = kind === 'location' ? 'Lokaciju' : 'Obavijesti'
  return isNativeApp()
    ? `Odbijeno je jednom, pa telefon više ne pita sam. Dodirni „Otvori postavke“, uključi ${what} za Zadatak i vrati se ovdje.`
    : `Odbijeno je jednom, pa preglednik više ne pita sam. Dodirni ikonu lijevo od adrese stranice (katanac), uključi ${what} i dodirni „Provjeri ponovo“.`
}

/** The picture on each step: the icon in rings, plus what it brings (a pin on a map, a notification card). */
function Art({ kind }) {
  const Icon = STEPS[kind]?.icon || Check
  return (
    <div className={`rp-art is-${kind}`} aria-hidden="true">
      <span className="rp-ring rp-ring-3" />
      <span className="rp-ring rp-ring-2" />
      <span className="rp-ring rp-ring-1" />
      <span className="rp-badge"><Icon size={44} strokeWidth={2.2} /></span>
      {kind === 'notifications' && (
        <span className="rp-toast"><b>Nova ponuda · 40 KM</b><small>Majstor Emir može doći sutra</small></span>
      )}
      {kind === 'location' && <span className="rp-chip">U blizini · 3 km</span>}
    </div>
  )
}

/**
 * "Poveži lokaciju" → "Uključi obavijesti", one screen at a time like WhatsApp: the explanation first,
 * and "Nastavi" opens the system's own dialog right away (Google Play: prominent disclosure before the
 * runtime prompt). Only the screens this moment needs are shown (utils/permissions.js permissionSteps).
 * Nothing is required (like Airtasker): "Preskoči" skips a screen for a week and the action carries on.
 */
export function RequiredPermissionsSheet({ reason = 'account', steps: initialSteps, onDone, onClose }) {
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)
  const [skipped, setSkipped] = useState([])
  const [steps] = useState(initialSteps)
  const required = (PERMISSION_RULES[reason] || PERMISSION_RULES.account).required
  const refresh = useCallback(() => permissionStatus().then(setStatus), [])

  useEffect(() => {
    refresh()
    // back from the phone settings or the browser's site settings
    const again = () => { if (document.visibilityState === 'visible') refresh() }
    document.addEventListener('visibilitychange', again)
    window.addEventListener('focus', again)
    return () => { document.removeEventListener('visibilitychange', again); window.removeEventListener('focus', again) }
  }, [refresh])

  const step = status ? steps.find((kind) => !passes(status[kind]) && !skipped.includes(kind)) || 'done' : null
  const denied = step && step !== 'done' && status[step] === 'denied'
  const index = step === 'done' ? steps.length : steps.indexOf(step)
  const isRequired = required.includes(step)

  // every screen answered (allowed or skipped): carry on with what they were doing, no extra tap
  const finished = useRef(false)
  useEffect(() => {
    if (step !== 'done' || finished.current) return
    finished.current = true
    if (requiredOk(status, reason)) onDone()
    else onClose()
  }, [step, status, reason, onDone, onClose])

  const ask = async () => {
    setBusy(true)
    try {
      const state = await STEPS[step].ask()
      // a connected location follows the person (Postavke → Lokacija uživo), unless they switched it off there
      if (step === 'location' && state === 'granted' && liveReachUndecided()) setLiveReach(true)
      setStatus((current) => ({ ...current, [step]: state }))
    } finally {
      setBusy(false)
    }
  }

  const notNow = () => {
    if (isRequired) { onClose(); return }
    snoozePermission(step)
    setSkipped((current) => [...current, step])
  }

  const info = STEPS[step]
  if (step === 'done') return null
  return (
    <div className="rp-screen" role="dialog" aria-modal="true" aria-labelledby="rp-title" data-testid="required-permissions">
      {steps.length > 1 && (
        <div className="rp-dots" aria-label={step ? `Korak ${Math.min(index + 1, steps.length)} od ${steps.length}` : undefined}>
          {steps.map((kind, i) => <span key={kind} className={i < index ? 'is-done' : i === index ? 'is-on' : ''} />)}
        </div>
      )}
      {step && (
        <div className="rp-body" key={step}>
          <Art kind={step} />
          <h1 id="rp-title">{info.title}</h1>
          <p>{info.text[reason] || info.text.account}</p>
          {denied ? <p className="rp-help">{blockedHelp(step)}</p> : <p className="rp-note">{info.note()}</p>}
        </div>
      )}
      <div className="rp-actions">
        {step && !denied && (
          <button type="button" className="rp-primary" data-testid="permissions-allow" onClick={ask} disabled={busy}>{busy ? 'Čekam odgovor…' : 'Nastavi'}</button>
        )}
        {denied && isNativeApp() && <button type="button" className="rp-primary" onClick={() => openAppSettings()}><Settings size={18} /> Otvori postavke</button>}
        {denied && <button type="button" className={isNativeApp() ? 'rp-secondary' : 'rp-primary'} onClick={refresh}>Provjeri ponovo</button>}
        <button type="button" className="rp-link" data-testid="permissions-skip" onClick={notNow}>{isRequired ? 'Ne sada' : 'Preskoči'}</button>
      </div>
    </div>
  )
}

/**
 * const permissions = useRequiredPermissions('post')
 * if (!(await permissions.ensure())) return     // in the submit handler
 * {permissions.sheet}                            // in the page
 * ensure() resolves at once when nothing needs asking; otherwise after the screens, true when what this
 * moment requires is allowed (an optional notification step never blocks).
 */
export function useRequiredPermissions(reason = 'account') {
  const [steps, setSteps] = useState(null)
  const resolver = useRef(null)
  const shown = useRef(false)

  const ensure = useCallback(async () => {
    const status = await permissionStatus()
    const needed = permissionSteps(status, reason)
    shown.current = needed.length > 0
    if (needed.length === 0) return requiredOk(status, reason)
    return new Promise((resolve) => { resolver.current = resolve; setSteps(needed) })
  }, [reason])

  const finish = useCallback((ok) => {
    setSteps(null)
    resolver.current?.(ok)
    resolver.current = null
  }, [])
  const done = useCallback(() => finish(true), [finish])
  const close = useCallback(() => finish(false), [finish])
  useBackToClose(Boolean(steps), close)

  const sheet = steps ? <RequiredPermissionsSheet reason={reason} steps={steps} onDone={done} onClose={close} /> : null
  // asked(): the last ensure() showed the screens (something may have just been allowed)
  const asked = useCallback(() => shown.current, [])
  return { ensure, sheet, asked }
}

const SEARCH_ASKED = 'zadatak-search-location-asked'

/**
 * The job search without the device's location: a small card that connects it on a tap (with `auto`, the
 * location screen opens once per app session by itself). The search works without it: a typed place does
 * the same. onGranted runs when it was just allowed.
 */
export function LocationNudge({ onGranted, auto = false }) {
  const [state, setState] = useState(null)
  const permissions = useRequiredPermissions('search')
  const { ensure } = permissions

  const connect = useCallback(async () => {
    if (await ensure()) { setState('granted'); onGranted?.() }
  }, [ensure, onGranted])

  useEffect(() => {
    let alive = true
    const check = () => locationPermission().then((next) => { if (alive) setState(next) })
    locationPermission().then((first) => {
      if (!alive) return
      setState(first)
      let asked = true
      try { asked = sessionStorage.getItem(SEARCH_ASKED) === '1'; sessionStorage.setItem(SEARCH_ASKED, '1') } catch { /* private mode */ }
      if (auto && !passes(first) && !asked) connect()
    })
    window.addEventListener('focus', check)
    return () => { alive = false; window.removeEventListener('focus', check) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!state || passes(state)) return permissions.sheet
  return (
    <>
      <div className="rp-nudge" data-testid="location-nudge">
        <span className="rp-nudge-icon" aria-hidden="true"><MapPin size={20} /></span>
        <div>
          <strong>Poveži lokaciju</strong>
          <span>{state === 'denied' ? 'Lokacija je isključena za Zadatak. Bez nje ne vidiš koliko je koji posao daleko.' : 'Da vidiš poslove oko sebe i koliko je svaki daleko.'}</span>
        </div>
        <button type="button" className="rp-nudge-btn" onClick={state === 'denied' && isNativeApp() ? () => openAppSettings() : connect}>
          {state === 'denied' && isNativeApp() ? 'Postavke' : 'Poveži'}
        </button>
      </div>
      {permissions.sheet}
    </>
  )
}
