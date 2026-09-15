import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Turnstile } from '@marsidev/react-turnstile'

function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, login } = useAuth()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [captchaToken, setCaptchaToken] = useState('')

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
    <div className="auth-shell">
      <div className="auth-card">
        <h1>Prijava</h1>
        <p>Pristupite svom korisničkom profilu.</p>
        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            Email
            <input name="email" type="email" value={form.email} onChange={handleChange} required />
          </label>
          {import.meta.env.VITE_TURNSTILE_SITE_KEY && <Turnstile siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY} onSuccess={setCaptchaToken} onExpire={() => setCaptchaToken('')} />}
          <label>
            Lozinka
            <input name="password" type="password" value={form.password} onChange={handleChange} required />
          </label>
          {error && <div className="form-error">{error}</div>}
          <button type="submit" className="primary-button" disabled={loading}>
            {loading ? 'Prijava...' : 'Prijavi se'}
          </button>
        </form>
        <div className="auth-links">
          <Link to="/forgot-password">Zaboravljena lozinka?</Link>
          <Link to="/register">Napravi račun</Link>
          <Link to="/">Nazad na početnu</Link>
        </div>
      </div>
    </div>
  )
}

export default LoginPage
