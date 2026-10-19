import { useEffect, useRef, useState } from 'react'
import { MailCheck } from 'lucide-react'
import AuthLayout from './AuthLayout'
import { authService } from '../services/authService'
import { isNativeApp } from '../utils/native'
import './CheckEmail.css'

const POLL_MS = 15 * 1000          // Supabase allows ~30 sign-ins per 5 min per IP: well under it
const GIVE_UP_MS = 30 * 60 * 1000  // after that, "Prijavi se" by hand
const RESEND_WAIT_S = 60

/**
 * Right after an email sign-up: "Potvrdi svoj email", and the screen waits for it. In the app the link in the
 * mail hands the session straight back (index.html, ?native=1); when the mail is opened somewhere else (a
 * computer, another browser), this screen quietly tries the sign-in again every few seconds and whenever the
 * app comes back to the front, so the person lands in profile setup without typing anything again.
 * The password stays only in this screen's memory.
 */
function CheckEmail({ email, password, onSignedIn, onChangeEmail, signIn }) {
  const [resend, setResend] = useState({ busy: false, note: '', error: '', wait: 0 })
  const [gaveUp, setGaveUp] = useState(false)
  const trying = useRef(false)
  const started = useRef(0)
  // the parent's callbacks change every render; the timer must not restart for that
  const latest = useRef({ signIn, onSignedIn })
  useEffect(() => { latest.current = { signIn, onSignedIn } })

  useEffect(() => {
    let alive = true
    started.current = Date.now()
    const attempt = async () => {
      if (!alive || trying.current || document.visibilityState !== 'visible') return
      if (Date.now() - started.current > GIVE_UP_MS) { setGaveUp(true); return }
      trying.current = true
      try {
        await latest.current.signIn({ email, password })
        if (alive) latest.current.onSignedIn()
      } catch { /* not confirmed yet */ } finally {
        trying.current = false
      }
    }
    const timer = window.setInterval(attempt, POLL_MS)
    const onVisible = () => { if (document.visibilityState === 'visible') attempt() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      alive = false
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [email, password])

  useEffect(() => {
    if (resend.wait <= 0) return undefined
    const id = window.setTimeout(() => setResend((current) => ({ ...current, wait: current.wait - 1 })), 1000)
    return () => window.clearTimeout(id)
  }, [resend.wait])

  const sendAgain = async () => {
    setResend({ busy: true, note: '', error: '', wait: 0 })
    try {
      await authService.resendConfirmation(email)
      setResend({ busy: false, note: 'Poslali smo novi mail. Link vrijedi 24 sata.', error: '', wait: RESEND_WAIT_S })
    } catch (err) {
      setResend({ busy: false, note: '', error: err.message, wait: 0 })
    }
  }

  return (
    <AuthLayout title="Potvrdi svoj email">
      <div className="check-email" data-testid="check-email">
        <div className="check-email-art" aria-hidden="true">
          <span className="check-email-ring" />
          <span className="check-email-badge"><MailCheck size={40} strokeWidth={2.1} /></span>
        </div>
        <p className="check-email-lead">Poslali smo link na <strong>{email}</strong>.</p>
        <ol className="check-email-steps">
          <li>Otvori mail od Zadatka (ako ga nema, pogledaj i spam).</li>
          <li>Dodirni <strong>Potvrdi email</strong>.</li>
          <li>{isNativeApp() ? 'Vraćamo te u aplikaciju i prijavljujemo te sami.' : 'Prijavljujemo te sami, i na ovoj stranici.'}</li>
        </ol>
        {!gaveUp
          ? <p className="check-email-wait" role="status"><span className="check-email-dot" aria-hidden="true" /> Čekamo potvrdu…</p>
          : <p className="check-email-wait" role="status">Kad potvrdiš email, dodirni dugme ispod.</p>}
        <button type="button" className="primary-button auth-submit" onClick={async () => {
          try { await signIn({ email, password }); onSignedIn() } catch (err) { setResend((current) => ({ ...current, note: '', error: err.code === 'email_not_confirmed' ? 'Email još nije potvrđen. Dodirni link u mailu.' : err.message })) }
        }}>Potvrdio sam, nastavi</button>
        <button type="button" className="link-button" onClick={sendAgain} disabled={resend.busy || resend.wait > 0}>
          {resend.busy ? 'Šaljem…' : resend.wait > 0 ? `Pošalji ponovo za ${resend.wait} s` : 'Nije stigao mail? Pošalji ponovo'}
        </button>
        {resend.note && <p className="auth-subtitle">{resend.note}</p>}
        {resend.error && <div className="form-error">{resend.error}</div>}
        <button type="button" className="link-button" onClick={onChangeEmail}>Pogrešan email? Ispravi ga</button>
      </div>
    </AuthLayout>
  )
}

export default CheckEmail
