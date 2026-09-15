import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Turnstile } from '@marsidev/react-turnstile'
import GoogleAuthButton from '../components/GoogleAuthButton'

function RegisterPage() {
  const navigate = useNavigate()
  const { user, register } = useAuth()
  const [form, setForm] = useState({ fullName: '', email: '', password: '', city: '', phone: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [captchaToken, setCaptchaToken] = useState('')

  if (user) {
    return <Navigate to="/dashboard" replace />
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
      const result = await register({ ...form, captchaToken })
      navigate(result.session ? '/dashboard' : '/login?verification=pending')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h1>Registracija</h1>
        <p>Napravite račun i počnite koristiti aplikaciju.</p>
        <GoogleAuthButton label="Registruj se sa Google računom" onError={setError} />
        <div className="auth-divider"><span>ili</span></div>
        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            Ime i prezime
            <input name="fullName" value={form.fullName} onChange={handleChange} required />
          </label>
          {import.meta.env.VITE_TURNSTILE_SITE_KEY && <Turnstile siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY} onSuccess={setCaptchaToken} onExpire={() => setCaptchaToken('')} />}
          <label>
            Email
            <input name="email" type="email" value={form.email} onChange={handleChange} required />
          </label>
          <label>
            Lozinka
            <input name="password" type="password" value={form.password} onChange={handleChange} required />
          </label>
          <label>
            Grad
            <input name="city" value={form.city} onChange={handleChange} />
          </label>
          <label>
            Telefon
            <input name="phone" value={form.phone} onChange={handleChange} />
          </label>
          {error && <div className="form-error">{error}</div>}
          <button type="submit" className="primary-button" disabled={loading}>
            {loading ? 'Registracija...' : 'Registruj se'}
          </button>
        </form>
        <div className="auth-links">
          <Link to="/login">Već imam račun</Link>
          <Link to="/">Nazad na početnu</Link>
        </div>
      </div>
    </div>
  )
}

export default RegisterPage
