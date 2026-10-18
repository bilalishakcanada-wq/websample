import { useCallback, useEffect, useRef, useState } from 'react'
import { BellRing, Check, MapPin, Settings } from 'lucide-react'
import { useBackToClose } from '../hooks/useBackToClose'
import { isNativeApp } from '../utils/native'
import { openAppSettings, permissionStatus, permissionsOk, requestLocation, requestNotifications } from '../utils/permissions'
import './RequiredPermissions.css'

const passes = (state) => state === 'granted' || state === 'unsupported'

const STEPS = {
  location: {
    icon: MapPin,
    title: 'Poveži svoju lokaciju',
    text: {
      account: 'Zadatak po lokaciji zna koliko si daleko od posla, pokazuje poslove u blizini i majstoru olakšava da dođe.',
      post: 'Po lokaciji tvoj posao vide majstori u blizini, a oni koji su daleko te mogu samo zamoliti da platiš prevoz.',
    },
    note: 'Koristi se samo dok je Zadatak otvoren, nikad u pozadini.',
    ask: requestLocation,
  },
  notifications: {
    icon: BellRing,
    title: 'Uključi obavijesti',
    text: {
      account: 'Da ti ništa ne promakne: nove ponude, poruke, molbe za prevoz i plaćanja stižu odmah, i kad je aplikacija zatvorena.',
      post: 'Čim majstor pošalje ponudu ili poruku, javićemo ti odmah, i kad je aplikacija zatvorena.',
    },
    note: 'Možeš ih uvijek isključiti u postavkama.',
    ask: requestNotifications,
  },
}
const ORDER = ['location', 'notifications']

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
 * runtime prompt). When it is allowed the next step comes on its own. Refusing never locks the app:
 * the step explains how to turn it on, and "Ne sada" only cancels this one action.
 */
export function RequiredPermissionsSheet({ reason = 'account', onDone, onClose }) {
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)
  const refresh = useCallback(() => permissionStatus().then(setStatus), [])

  useEffect(() => {
    refresh()
    // back from the phone settings or the browser's site settings
    const again = () => { if (document.visibilityState === 'visible') refresh() }
    document.addEventListener('visibilitychange', again)
    window.addEventListener('focus', again)
    return () => { document.removeEventListener('visibilitychange', again); window.removeEventListener('focus', again) }
  }, [refresh])

  const step = status ? ORDER.find((kind) => !passes(status[kind])) || 'done' : null
  const denied = step && step !== 'done' && status[step] === 'denied'
  const index = step === 'done' ? ORDER.length : ORDER.indexOf(step)

  const ask = async () => {
    setBusy(true)
    try {
      const state = await STEPS[step].ask()
      const next = { ...status, [step]: state }
      setStatus(next)
      // both allowed by the person's own taps: carry on with what they were doing, no extra tap
      if (permissionsOk(next)) onDone()
    } finally {
      setBusy(false)
    }
  }

  const info = STEPS[step]
  return (
    <div className="rp-screen" role="dialog" aria-modal="true" aria-labelledby="rp-title" data-testid="required-permissions">
      <div className="rp-dots" aria-label={step ? `Korak ${Math.min(index + 1, ORDER.length)} od ${ORDER.length}` : undefined}>
        {ORDER.map((kind, i) => <span key={kind} className={i < index ? 'is-done' : i === index ? 'is-on' : ''} />)}
      </div>
      {step && (
        <div className="rp-body" key={step}>
          <Art kind={step} />
          {step === 'done' ? (
            <>
              <h1 id="rp-title">Sve je povezano</h1>
              <p>Lokacija i obavijesti su uključene. Možeš nastaviti.</p>
            </>
          ) : (
            <>
              <h1 id="rp-title">{info.title}</h1>
              <p>{info.text[reason] || info.text.account}</p>
              {denied ? <p className="rp-help">{blockedHelp(step)}</p> : <p className="rp-note">{info.note}</p>}
            </>
          )}
        </div>
      )}
      <div className="rp-actions">
        {step === 'done' && <button type="button" className="rp-primary" data-testid="permissions-continue" onClick={onDone}>Nastavi</button>}
        {step && step !== 'done' && !denied && (
          <button type="button" className="rp-primary" data-testid="permissions-allow" onClick={ask} disabled={busy}>{busy ? 'Čekam odgovor…' : 'Nastavi'}</button>
        )}
        {denied && isNativeApp() && <button type="button" className="rp-primary" onClick={() => openAppSettings()}><Settings size={18} /> Otvori postavke</button>}
        {denied && <button type="button" className={isNativeApp() ? 'rp-secondary' : 'rp-primary'} onClick={refresh}>Provjeri ponovo</button>}
        <button type="button" className="rp-link" onClick={onClose}>Ne sada</button>
      </div>
    </div>
  )
}

/**
 * const permissions = useRequiredPermissions('post')
 * if (!(await permissions.ensure())) return     // in the submit handler
 * {permissions.sheet}                            // in the page
 * ensure() resolves true right away when both are already allowed, otherwise after the screen.
 */
export function useRequiredPermissions(reason = 'account') {
  const [open, setOpen] = useState(false)
  const resolver = useRef(null)

  const ensure = useCallback(async () => {
    if (permissionsOk(await permissionStatus())) return true
    return new Promise((resolve) => { resolver.current = resolve; setOpen(true) })
  }, [])

  const finish = useCallback((ok) => {
    setOpen(false)
    resolver.current?.(ok)
    resolver.current = null
  }, [])
  useBackToClose(open, () => finish(false))

  const sheet = open ? <RequiredPermissionsSheet reason={reason} onDone={() => finish(true)} onClose={() => finish(false)} /> : null
  return { ensure, sheet }
}
