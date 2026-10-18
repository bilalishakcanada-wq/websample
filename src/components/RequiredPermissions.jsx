import { useCallback, useEffect, useRef, useState } from 'react'
import { BellRing, Check, MapPin, Settings } from 'lucide-react'
import { useBackToClose } from '../hooks/useBackToClose'
import { isNativeApp } from '../utils/native'
import { openAppSettings, permissionStatus, permissionsOk, requestLocation, requestNotifications } from '../utils/permissions'
import './RequiredPermissions.css'

const WHY = {
  account: 'Prije pravljenja računa dozvoli lokaciju i obavijesti. Bez toga Zadatak ne može raditi kako treba.',
  post: 'Prije objave posla dozvoli lokaciju i obavijesti. Tako majstori u blizini dobiju tvoj posao, a ti odmah saznaš za ponude.',
}

const blockedHelp = () => (isNativeApp()
  ? 'Android ne pita ponovo kad se jednom odbije. Otvori postavke aplikacije Zadatak, uključi dozvolu i vrati se ovdje.'
  : 'Preglednik ne pita ponovo kad se jednom odbije. Klikni na ikonu lijevo od adrese stranice (katanac), dozvoli Lokaciju i Obavijesti, pa dodirni „Provjeri ponovo“.')

function Row({ icon: Icon, title, text, state, busy, onAllow, testId }) {
  const done = state === 'granted'
  return (
    <div className={`rp-row ${done ? 'is-done' : ''} ${state === 'denied' ? 'is-denied' : ''}`}>
      <span className="rp-icon"><Icon size={20} /></span>
      <div className="rp-text">
        <strong>{title}</strong>
        <span>{state === 'unsupported' ? 'Ovaj uređaj ne podržava, obavijesti stižu u aplikaciju i na email.' : text}</span>
      </div>
      {done || state === 'unsupported'
        ? <span className="rp-ok" aria-label="Dozvoljeno"><Check size={18} /></span>
        : <button type="button" className="rp-allow" data-testid={testId} onClick={onAllow} disabled={busy}>{busy ? '…' : state === 'denied' ? 'Blokirano' : 'Dozvoli'}</button>}
    </div>
  )
}

/**
 * "Dozvoli lokaciju i obavijesti": the explanation comes first, then each system dialog only on a tap
 * (Google Play: prominent disclosure before the runtime prompt). Refusing never locks the app:
 * the sheet explains how to turn it on, and "Ne sada" only cancels this one action.
 */
export function RequiredPermissionsSheet({ reason = 'account', onDone, onClose }) {
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState('')
  const refresh = useCallback(() => permissionStatus().then(setStatus), [])

  useEffect(() => {
    refresh()
    // back from the phone settings or the browser's site settings
    const again = () => { if (document.visibilityState === 'visible') refresh() }
    document.addEventListener('visibilitychange', again)
    window.addEventListener('focus', again)
    return () => { document.removeEventListener('visibilitychange', again); window.removeEventListener('focus', again) }
  }, [refresh])

  const ask = async (kind) => {
    setBusy(kind)
    try {
      const state = kind === 'location' ? await requestLocation() : await requestNotifications()
      setStatus((current) => ({ ...current, [kind]: state }))
    } finally {
      setBusy('')
    }
  }

  const ready = permissionsOk(status)
  const denied = status && (status.location === 'denied' || status.notifications === 'denied')

  return (
    <div className="dlg-backdrop" onClick={onClose} role="presentation">
      <div className="dlg rp" role="dialog" aria-modal="true" aria-labelledby="rp-title" data-testid="required-permissions" onClick={(event) => event.stopPropagation()}>
        <span className="dlg-handle" aria-hidden="true" />
        <h2 id="rp-title">Dozvoli lokaciju i obavijesti</h2>
        <p>{WHY[reason] || WHY.account}</p>
        <Row
          icon={MapPin} title="Lokacija" testId="allow-location" state={status?.location} busy={busy === 'location'} onAllow={() => ask('location')}
          text="Po njoj mjerimo koliko si daleko od posla (doseg ponuda) i pokazujemo poslove u blizini. Koristi se samo dok je Zadatak otvoren, nikad u pozadini."
        />
        <Row
          icon={BellRing} title="Obavijesti" testId="allow-notifications" state={status?.notifications} busy={busy === 'notifications'} onAllow={() => ask('notifications')}
          text="Da odmah saznaš za nove ponude, poruke, molbe za prevoz i plaćanja."
        />
        {denied && <p className="rp-help">{blockedHelp()}</p>}
        <div className="dlg-actions">
          <button type="button" className="dlg-confirm" data-testid="permissions-continue" disabled={!ready} onClick={onDone}>Nastavi</button>
          {denied && isNativeApp() && <button type="button" className="dlg-cancel" onClick={() => openAppSettings()}><Settings size={16} /> Otvori postavke</button>}
          {denied && <button type="button" className="dlg-cancel" onClick={refresh}>Provjeri ponovo</button>}
          <button type="button" className="dlg-cancel" onClick={onClose}>Ne sada</button>
        </div>
      </div>
    </div>
  )
}

/**
 * const permissions = useRequiredPermissions('post')
 * if (!(await permissions.ensure())) return     // in the submit handler
 * {permissions.sheet}                            // in the page
 * ensure() resolves true right away when both are already allowed, otherwise after the sheet.
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
