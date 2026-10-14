import { useState } from 'react'
import { CheckCircle2, Circle } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useSimpleMode } from '../../hooks/useSimpleMode'
import '../../components/SimpleOfferSheet.css'

/**
 * Jednostavan način: posebna opcija u Postavkama za uključivanje i isključivanje.
 * Za majstore od 40 godina naviše uključen je sam; izbor ovdje važi umjesto toga.
 */
function SimpleModePage() {
  const { user } = useAuth()
  const simple = useSimpleMode(user.id)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState('')
  const [error, setError] = useState('')

  const choose = async (on) => {
    if (busy || on === simple.enabled) return
    setBusy(true); setError(''); setSaved('')
    try {
      const next = await simple.setChoice(on)
      setSaved(next.enabled ? 'Sačuvano: jednostavan način je uključen.' : 'Sačuvano: jednostavan način je isključen.')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  const options = [
    [true, 'Uključeno', 'Velika dugmad. Na posao se prijaviš u 2 dodira, bez pisanja.'],
    [false, 'Isključeno', 'Običan izgled. Ponudu pišeš sam/a, s cijenom i porukom.'],
  ]

  return (
    <div className="account-section simple-mode-page">
      <div className="account-section-head"><h1>Jednostavan način</h1></div>
      <p className="simple-mode-intro">Za majstore koji žele lakše: krupno, jasno i bez kucanja. Kad se pojavi novi posao, dodirneš „Želim ovaj posao“, pa „Da“, i prijava je poslana.</p>

      <div className="simple-mode-choice" role="radiogroup" aria-label="Jednostavan način">
        {options.map(([on, label, hint]) => {
          const active = simple.enabled === on
          return (
            <button
              key={label} type="button" role="radio" aria-checked={active} data-testid={on ? 'simple-mode-on' : 'simple-mode-off'}
              className={active ? 'active' : ''} disabled={busy} onClick={() => choose(on)}
            >
              {active ? <CheckCircle2 size={30} /> : <Circle size={30} />}
              <span><strong>{label}</strong><small>{hint}</small></span>
            </button>
          )
        })}
      </div>

      <p className="simple-mode-note">
        {simple.auto && simple.choice == null
          ? 'Uključen je sam, jer imaš 40 ili više godina. Možeš ga isključiti kad hoćeš.'
          : 'Majstorima od 40 godina i više uključuje se sam. Ovdje ga svako može uključiti ili isključiti.'}
      </p>
      {saved && <div className="form-success" role="status">{saved}</div>}
      {error && <div className="form-error">{error}</div>}
    </div>
  )
}

export default SimpleModePage
