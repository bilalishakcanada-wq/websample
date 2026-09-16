import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Turnstile } from '@marsidev/react-turnstile'
import OAuthButtons from '../components/OAuthButtons'
import AuthLayout from '../components/AuthLayout'

function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { user, login } = useAuth()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [captchaToken, setCaptchaToken] = useState('')
  const verificationPending = searchParams.get('verification') === 'pending'

  if (user) {
    const destination = location.state?.from?.pathname || '/dashboard'
    return <Navigate to={destination} replace />
  }

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      await login({ ...form, captchaToken })
      navigate('/dashboard')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="Prijavi se na svoj račun">
      {verificationPending && (
        <div className="form-success">
          Nalog je napravljen! Provjeri email (i spam folder) i klikni na link za potvrdu prije prijave.
        </div>
      )}
      <form onSubmit={handleSubmit} className="auth-form">
        <div className="field">
          <input id="email" name="email" type="email" placeholder=" " value={form.email} onChange={handleChange} required />
          <label htmlFor="email">Email adresa</label>
        </div>
        <div className="field">
          <input id="password" name="password" type="password" placeholder=" " value={form.password} onChange={handleChange} required />
          <label htmlFor="password">Lozinka</label>
        </div>
        {import.meta.env.VITE_TURNSTILE_SITE_KEY && <Turnstile siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY} onSuccess={setCaptchaToken} onExpire={() => setCaptchaToken('')} />}
        {error && <div className="form-error">{error}</div>}
        <button type="submit" className="primary-button auth-submit" disabled={loading}>
          {loading ? 'Prijava...' : 'Nastavi'}
        </button>
      </form>

      <p className="auth-switch">
        Nemaš račun? <Link to="/register">Registruj se</Link>
      </p>

      <OAuthButtons verb="Prijavi se" onError={setError} />

      <p className="auth-switch">
        <Link to="/forgot-password">Zaboravljena lozinka?</Link>
      </p>
    </AuthLayout>
  )
}

export default LoginPage
