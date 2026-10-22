import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Turnstile } from '@marsidev/react-turnstile'
import OAuthButtons from '../components/OAuthButtons'
import AuthLayout from '../components/AuthLayout'
import { useMediaQuery } from '../hooks/useMediaQuery'
import PasswordField from '../components/PasswordField'
import { authService } from '../services/authService'
import { forgetReturn, rememberReturn, safeNext } from '../utils/afterAuth'

/** "Didn't get the mail?" — sends the signup confirmation again, with a short cooldown. */
function ResendConfirmation({ email }) {
  const [state, setState] = useState({ busy: false, sent: false, error: '' })
  if (!email) return null
  const resend = async () => {
    setState({ busy: true, sent: false, error: '' })
    try {
      await authService.resendConfirmation(email)
      setState({ busy: false, sent: true, error: '' })
    } catch (err) {
      setState({ busy: false, sent: false, error: err.message })
    }
  }
  return (
    <div className="resend-confirmation">
      {state.sent
        ? <span>Poslali smo novi mail na <strong>{email}</strong>. Link vrijedi 24 sata.</span>
        : <button type="button" className="link-button" onClick={resend} disabled={state.busy}>{state.busy ? 'Šaljem...' : 'Nije stigao mail? Pošalji ponovo'}</button>}
      {state.error && <div className="form-error">{state.error}</div>}
    </div>
  )
}

function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { user, login } = useAuth()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [captchaToken, setCaptchaToken] = useState('')
  const [unconfirmed, setUnconfirmed] = useState(false)
  const pendingEmail = location.state?.email || ''
  const verificationPending = searchParams.get('verification') === 'pending'
  const oauthFailed = searchParams.get('oauth') === 'failed'
  const isPhone = useMediaQuery('(max-width: 768px)')

  // ?next=/objavi (phone flows) or the guarded page that sent us here
  const wanted = safeNext(searchParams.get('next')) || safeNext(location.state?.from?.pathname ? `${location.state.from.pathname}${location.state.from.search || ''}` : '')
  // phones land on the app home, the website on the account dashboard
  const destination = wanted || (isPhone ? '/' : '/account')
  // kept on the device too: signing up instead, or with Google, still comes back here
  useEffect(() => { if (wanted) rememberReturn(wanted) }, [wanted])

  if (user) return <Navigate to={destination} replace />

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    setUnconfirmed(false)

    try {
      await login({ ...form, captchaToken })
      forgetReturn()
      navigate(destination)
    } catch (err) {
      setError(err.message)
      setUnconfirmed(err.code === 'email_not_confirmed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="Prijavi se na svoj račun">
      {verificationPending && (
        <div className="form-success">
          Nalog je napravljen! Poslali smo ti mail{pendingEmail ? <> na <strong>{pendingEmail}</strong></> : ''}. Klikni dugme <strong>Potvrdi email</strong> u njemu i odmah si prijavljen/a. Ne vidiš ga? Pogledaj i spam.
          <ResendConfirmation email={pendingEmail} />
        </div>
      )}
      {oauthFailed && (
        <div className="form-error">
          Google prijava nije uspjela. Pokušaj ponovo — ili se prijavi emailom i lozinkom.
        </div>
      )}
      <form onSubmit={handleSubmit} className="auth-form">
        <div className="field">
          <input data-testid="login-email" id="email" name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" placeholder=" " value={form.email} onChange={handleChange} required />
          <label htmlFor="email">Email adresa</label>
        </div>
        <PasswordField name="password" label="Lozinka" value={form.password} onChange={handleChange} />
        {import.meta.env.VITE_TURNSTILE_SITE_KEY && <Turnstile siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY} onSuccess={setCaptchaToken} onExpire={() => setCaptchaToken('')} />}
        {error && <div className="form-error">{error}{unconfirmed && <ResendConfirmation email={form.email.trim().toLowerCase()} />}</div>}
        <button data-testid="login-submit" type="submit" className="primary-button auth-submit" disabled={loading}>
          {loading ? 'Prijava...' : 'Nastavi'}
        </button>
      </form>

      <p className="auth-switch">
        Nemaš račun? <Link to={`/register${wanted ? `?next=${encodeURIComponent(wanted)}` : ''}`}>Registruj se</Link>
      </p>

      <OAuthButtons verb="Prijavi se" onError={setError} />

      <p className="auth-switch">
        <Link to="/forgot-password">Zaboravljena lozinka?</Link>
      </p>
    </AuthLayout>
  )
}

export default LoginPage
