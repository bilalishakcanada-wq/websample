import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, PauseCircle, Trash2 } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { withBase } from '../../utils/paths'
import './CloseAccountPage.css'

const MODES = [
  {
    id: 'deactivate', icon: PauseCircle, title: 'Privremeno deaktiviraj',
    lines: ['Profil i oglasi se sakriju, ponude koje čekaju odgovor se povlače.', 'Podaci ostaju. Vratiš se kad hoćeš: prijavi se i dodirni „Ponovo aktiviraj nalog“.'],
  },
  {
    id: 'delete', icon: Trash2, title: 'Trajno obriši',
    lines: ['Briše profil, oglase, ponude, poruke, recenzije i sve fajlove koje si poslao/la.', 'Ne može se poništiti.'],
  },
]

// the same keys as account_closure_reasons.reason (supabase/security/14_account_closure.sql)
const REASONS = [
  ['complicated', 'Aplikacija mi je komplikovana'],
  ['no_jobs', 'Nema dovoljno poslova za mene'],
  ['no_providers', 'Ne nalazim izvođače koji mi trebaju'],
  ['notifications', 'Dobijam previše obavijesti ili mailova'],
  ['privacy', 'Brinem se za privatnost svojih podataka'],
  ['bad_experience', 'Imao/la sam loše iskustvo s drugim korisnikom'],
  ['other_account', 'Imam drugi nalog'],
  ['break', 'Treba mi pauza'],
  ['other', 'Nešto drugo'],
]

/**
 * Postavke > Zatvori nalog (sd, 30.10.2026.): izbor (deaktivacija ili brisanje), obavezan razlog,
 * pa kod s emaila naloga. Bez koda se nalog ne zatvara; server provjerava sve isto (functions/delete-account).
 */
function CloseAccountPage() {
  const { user, closeAccount } = useAuth()
  const [mode, setMode] = useState('')
  const [reason, setReason] = useState('')
  const [detail, setDetail] = useState('')
  const [sentFor, setSentFor] = useState('') // the mode the last code was sent for
  const [code, setCode] = useState('')
  const [wait, setWait] = useState(0)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (wait <= 0) return undefined
    const timer = window.setTimeout(() => setWait((left) => left - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [wait])

  const detailNeeded = reason === 'other'
  const reasonDone = reason !== '' && (!detailNeeded || detail.trim().length >= 3)
  // a code belongs to one choice: switching between deactivation and deletion asks for a new one
  const codeSent = sentFor !== '' && sentFor === mode
  const deleting = mode === 'delete'

  const chooseMode = (next) => { setMode(next); setError(''); if (next !== sentFor) setCode('') }

  const sendCode = async () => {
    setBusy('send'); setError('')
    try {
      const result = await closeAccount('send_code', { mode })
      setSentFor(mode); setCode(''); setWait(result?.wait || 60)
    } catch (requestError) {
      setError(requestError.message)
      if (requestError.wait) setWait(requestError.wait)
    } finally { setBusy('') }
  }

  const confirm = async (event) => {
    event.preventDefault()
    if (code.length !== 6) { setError('Upiši svih 6 cifara iz maila.'); return }
    setBusy('confirm'); setError('')
    try {
      await closeAccount(mode, { code, reason, detail: detail.trim() })
      // deactivation: the app switches to the "Nalog je deaktiviran" screen by itself
      if (deleting) window.location.assign(withBase('/'))
    } catch (requestError) {
      setError(requestError.message)
      if (requestError.expired) { setSentFor(''); setCode('') }
      setBusy('')
    }
  }

  return (
    <div className="account-section ca">
      <div className="account-section-head"><h1>Zatvori nalog</h1></div>
      <p className="ca-intro">Za zatvaranje naloga treba razlog i kod koji šaljemo na tvoj email. Tako niko drugi ne može zatvoriti nalog umjesto tebe.</p>

      <form className="ca-form" onSubmit={confirm}>
        <fieldset className="ca-step">
          <legend><span className="ca-num">1</span> Šta želiš uraditi?</legend>
          <div className="ca-modes">
            {MODES.map(({ id, icon: Icon, title, lines }) => (
              <label key={id} className={`ca-mode${mode === id ? ' is-on' : ''}${id === 'delete' ? ' ca-mode-delete' : ''}`}>
                <input type="radio" name="ca-mode" value={id} checked={mode === id} onChange={() => chooseMode(id)} data-testid={`close-mode-${id}`} />
                <span className="ca-mode-icon" aria-hidden="true"><Icon size={20} /></span>
                <span className="ca-mode-text">
                  <strong>{title}</strong>
                  {lines.map((line) => <span key={line}>{line}</span>)}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="ca-step" disabled={!mode}>
          <legend><span className="ca-num">2</span> Zašto {deleting ? 'brišeš' : 'zatvaraš'} nalog?</legend>
          <p className="ca-hint">Obavezno. Odgovor čita samo tim Zadatka, da znamo šta popraviti.</p>
          <div className="ca-reasons" role="radiogroup" aria-label="Razlog">
            {REASONS.map(([id, label]) => (
              <label key={id} className={`ca-reason${reason === id ? ' is-on' : ''}`}>
                <input type="radio" name="ca-reason" value={id} checked={reason === id} onChange={() => { setReason(id); setError('') }} data-testid={`close-reason-${id}`} />
                <span>{label}</span>
              </label>
            ))}
          </div>
          <label className="ca-detail">
            <span>{detailNeeded ? 'Napiši razlog' : 'Želiš li nešto dodati? (nije obavezno)'}</span>
            <textarea value={detail} onChange={(event) => setDetail(event.target.value)} maxLength={500} rows={3} required={detailNeeded} data-testid="close-detail" />
          </label>
        </fieldset>

        <fieldset className="ca-step" disabled={!mode || !reasonDone}>
          <legend><span className="ca-num">3</span> Potvrdi kodom s emaila</legend>
          <p className="ca-hint"><Mail size={15} aria-hidden="true" /> Kod šaljemo na <strong>{user?.email}</strong>. Vrijedi 15 minuta.</p>
          {codeSent ? (
            <>
              <label className="ca-code">
                <span>Kod iz maila (6 cifara)</span>
                <input type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={6} value={code}
                  onChange={(event) => { setCode(event.target.value.replace(/\D/g, '').slice(0, 6)); setError('') }} data-testid="close-code" />
              </label>
              <button type="button" className="ca-link" onClick={sendCode} disabled={wait > 0 || busy !== ''}>
                {wait > 0 ? `Novi kod za ${wait} s` : busy === 'send' ? 'Šaljem…' : 'Pošalji novi kod'}
              </button>
            </>
          ) : (
            <button type="button" className="ap-btn ap-btn-light ca-send" onClick={sendCode} disabled={busy !== '' || wait > 0} data-testid="close-send-code">
              {busy === 'send' ? 'Šaljem…' : wait > 0 ? `Pošalji kod (${wait} s)` : 'Pošalji kod na email'}
            </button>
          )}
        </fieldset>

        {error && <div className="form-error" role="alert">{error}</div>}

        <div className="ca-actions">
          <button type="submit" className={`ap-btn ca-confirm${deleting ? ' ca-confirm-delete' : ''}`} disabled={!codeSent || code.length !== 6 || !reasonDone || busy !== ''} data-testid="close-confirm">
            {busy === 'confirm' ? (deleting ? 'Brišem…' : 'Deaktiviram…') : !mode ? 'Zatvori nalog' : deleting ? 'Trajno obriši nalog' : 'Deaktiviraj nalog'}
          </button>
          <Link to="/account/postavke" className="ap-btn ap-btn-light ca-cancel">Odustani</Link>
        </div>
      </form>
    </div>
  )
}

export default CloseAccountPage
