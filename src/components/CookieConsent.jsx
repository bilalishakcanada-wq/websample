import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Cookie } from 'lucide-react'
import { onConsentChange, readConsent, saveConsent } from '../utils/consent'

/**
 * Cookie / storage choice. Shown until the visitor picks; "Samo neophodno" and "Prihvati sve"
 * (or "Sačuvaj izbor" in the settings) look exactly the same, so neither is the easy default.
 */
function CookieConsent() {
  const [open, setOpen] = useState(() => readConsent() === null)
  const [settings, setSettings] = useState(false)
  const [errors, setErrors] = useState(() => Boolean(readConsent()?.errors))
  const titleId = useId()
  const panelRef = useRef(null)

  useEffect(() => onConsentChange((choice, reopen) => {
    if (!reopen) return
    setErrors(Boolean(choice?.errors))
    setSettings(true)
    setOpen(true)
  }), [])

  useEffect(() => {
    if (open && settings) panelRef.current?.querySelector('input')?.focus()
  }, [open, settings])

  if (!open) return null

  const choose = (value) => {
    saveConsent({ errors: value })
    setOpen(false)
    setSettings(false)
  }

  return (
    <div className={`cookie-consent${settings ? ' is-settings' : ''}`} role="dialog" aria-labelledby={titleId} ref={panelRef}>
      <div className="cookie-consent-icon" aria-hidden="true"><Cookie size={22} /></div>
      <div className="cookie-consent-body">
        <h2 id={titleId}>Kolačići na Zadatku</h2>
        <p>
          Čuvamo samo ono što treba da sajt radi: prijavu, nacrte i postavke. Uz tvoj pristanak šaljemo i izvještaje
          o greškama, da kvarove popravimo brže. Reklamne kolačiće ne koristimo. <Link to="/kolacici">Više o kolačićima</Link>
        </p>
        {settings && (
          <div className="cookie-consent-options">
            <label className="cookie-consent-option">
              <span><strong>Neophodno</strong> Prijava, nacrti, postavke i zaštita od botova. Uvijek uključeno.</span>
              <input type="checkbox" className="cookie-switch" checked disabled />
            </label>
            <label className="cookie-consent-option">
              <span><strong>Izvještaji o greškama</strong> Sentry dobije opis greške, stranicu i vrstu preglednika. Bez imena i emaila.</span>
              <input type="checkbox" className="cookie-switch" checked={errors} onChange={(event) => setErrors(event.target.checked)} />
            </label>
          </div>
        )}
      </div>
      <div className="cookie-consent-actions">
        {!settings && <button type="button" className="cookie-consent-link" onClick={() => setSettings(true)}>Postavke</button>}
        <button type="button" className="cookie-consent-button" onClick={() => choose(false)}>Samo neophodno</button>
        {settings
          ? <button type="button" className="cookie-consent-button" onClick={() => choose(errors)}>Sačuvaj izbor</button>
          : <button type="button" className="cookie-consent-button" onClick={() => choose(true)}>Prihvati sve</button>}
      </div>
    </div>
  )
}

export default CookieConsent
