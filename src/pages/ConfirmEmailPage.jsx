import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'
import { useAuth } from '../context/AuthContext'
import { authService } from '../services/authService'
import '../components/CheckEmail.css'
import { takeReturn } from '../utils/afterAuth'

/** "Confirm your email" for Google sign-ups: sends our link once, then offers to send it again. */
export function ConfirmEmailScreen() {
  const { user, emailCheck, refreshEmailCheck, logout } = useAuth()
  const [state, setState] = useState({ busy: false, note: '', error: '' })
  const autoSent = useRef(false)

  const send = async () => {
    setState({ busy: true, note: '', error: '' })
    try {
      const result = await authService.sendEmailConfirmation()
      setState({ busy: false, error: '', note: result === 'wait' ? 'Mail je upravo poslan. Sačekaj minutu pa probaj ponovo.' : 'Poslali smo novi mail. Link vrijedi 24 sata.' })
    } catch (err) {
      setState({ busy: false, note: '', error: err.message })
    }
  }

  // the first visit after a Google sign-up sends the mail without a tap
  useEffect(() => {
    if (emailCheck.sent || autoSent.current) return
    autoSent.current = true
    send()
  }, [emailCheck.sent])

  // the link is usually tapped in the mail app or a browser: back in Zadatak, the screen notices by itself
  useEffect(() => {
    const check = () => { if (document.visibilityState === 'visible') refreshEmailCheck().catch(() => {}) }
    const timer = window.setInterval(check, 10000)
    document.addEventListener('visibilitychange', check)
    window.addEventListener('focus', check)
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', check); window.removeEventListener('focus', check) }
  }, [refreshEmailCheck])

  return (
    <AuthLayout title="Potvrdi svoj email" subtitle={<>Poslali smo link na <strong>{user?.email}</strong>. Dodirni ga u mailu i račun je spreman (provjeri i spam). Ovaj ekran nastavlja sam čim potvrdiš.</>}>
      <div className="auth-form">
        <button type="button" className="primary-button auth-submit" onClick={async () => {
          const status = await refreshEmailCheck()
          if (status.pending) setState({ busy: false, error: '', note: 'Još nisi kliknuo link iz maila.' })
        }}>Potvrdio sam, nastavi</button>
        <p className="check-email-wait" role="status"><span className="check-email-dot" aria-hidden="true" /> Čekamo potvrdu…</p>
        <button type="button" className="link-button" onClick={send} disabled={state.busy}>{state.busy ? 'Šaljem...' : 'Nije stigao mail? Pošalji ponovo'}</button>
        {state.note && <p className="auth-subtitle">{state.note}</p>}
        {state.error && <div className="form-error">{state.error}</div>}
        <button type="button" className="link-button" onClick={logout}>Odjavi se</button>
      </div>
    </AuthLayout>
  )
}

/** /potvrdi-email?t=… — the link from the confirmation mail. */
function ConfirmEmailPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { user, refreshEmailCheck } = useAuth()
  const [result, setResult] = useState('checking')
  const token = params.get('t') || ''

  useEffect(() => {
    let active = true
    authService.confirmEmail(token)
      .then(async (ok) => {
        if (!active) return
        setResult(ok ? 'ok' : 'invalid')
        if (ok && user) {
          await refreshEmailCheck()
          // back to what they were doing before signing up (a job, the post form), else profile setup
          navigate(takeReturn() || '/account/profil?setup=1', { replace: true })
        }
      })
      .catch(() => active && setResult('invalid'))
    return () => { active = false }
    // the token is used once: the check runs for this link only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  if (result === 'checking') return <AuthLayout title="Potvrđujem email..." />
  if (result === 'ok') {
    return (
      <AuthLayout title="Email je potvrđen" subtitle="Hvala! Tvoj Zadatak račun je spreman.">
        <Link to={user ? '/account' : '/login'} className="primary-button auth-submit">{user ? 'Nastavi' : 'Prijavi se'}</Link>
      </AuthLayout>
    )
  }
  return (
    <AuthLayout title="Link ne radi" subtitle="Link je već iskorišten ili je stariji od 24 sata. Prijavi se i zatraži novi mail.">
      <Link to={user ? '/account' : '/login'} className="primary-button auth-submit">{user ? 'Pošalji novi link' : 'Prijavi se'}</Link>
    </AuthLayout>
  )
}

export default ConfirmEmailPage
