import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { onConsentChange, readConsent, saveConsent } from '../utils/consent'

/**
 * Cookie / storage choice. Shown until the visitor picks; "Prihvati sve" and "Samo neophodno"
 * are the same size and weight, so neither is the easy default.
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
    <div className="cookie-consent" role="dialog" aria-labelledby={titleId} ref={panelRef}>
      <h2 id={titleId}>Kolačići i memorija preglednika</h2>
      <p>
        Zadatak u pregledniku čuva samo ono što treba da radi: prijavu, nacrte oglasa i tvoje postavke. Uz tvoj pristanak
        šaljemo i izvještaje o greškama (Sentry), da brže popravimo ono što se pokvari. Reklamne kolačiće ne koristimo.{' '}
        <Link to="/kolacici">Politika kolačića</Link>
      </p>
      {settings && (
        <div className="cookie-consent-options">
          <label className="cookie-consent-option">
            <input type="checkbox" checked disabled />
            <span><strong>Neophodno</strong> Prijava, nacrti, postavke i zaštita od botova. Bez ovoga sajt ne radi.</span>
          </label>
          <label className="cookie-consent-option">
            <input type="checkbox" checked={errors} onChange={(event) => setErrors(event.target.checked)} />
            <span><strong>Izvještaji o greškama</strong> Kad se nešto pokvari, Sentry dobije opis greške, stranicu i vrstu preglednika. Bez imena i emaila.</span>
          </label>
        </div>
      )}
      <div className="cookie-consent-actions">
        {settings
          ? <button type="button" className="secondary-button" onClick={() => choose(errors)}>Sačuvaj izbor</button>
          : <button type="button" className="secondary-button" onClick={() => setSettings(true)}>Postavke</button>}
        <button type="button" className="secondary-button" onClick={() => choose(false)}>Samo neophodno</button>
        <button type="button" className="secondary-button" onClick={() => choose(true)}>Prihvati sve</button>
      </div>
    </div>
  )
}

export default CookieConsent
