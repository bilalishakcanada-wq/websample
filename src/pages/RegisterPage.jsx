import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Turnstile } from '@marsidev/react-turnstile'
import GoogleAuthButton from '../components/GoogleAuthButton'
import AuthLayout from '../components/AuthLayout'

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
    <AuthLayout title="Napravi svoj račun">
      <form onSubmit={handleSubmit} className="auth-form">
        <div className="field">
          <input id="fullName" name="fullName" placeholder=" " value={form.fullName} onChange={handleChange} required />
          <label htmlFor="fullName">Ime i prezime</label>
        </div>
        <div className="field">
          <input id="email" name="email" type="email" placeholder=" " value={form.email} onChange={handleChange} required />
          <label htmlFor="email">Email adresa</label>
        </div>
        <div className="field">
          <input id="password" name="password" type="password" placeholder=" " value={form.password} onChange={handleChange} required />
          <label htmlFor="password">Lozinka</label>
          <small>Najmanje 8 znakova, veliko i malo slovo i broj.</small>
        </div>
        <div className="field-row">
          <div className="field">
            <input id="city" name="city" placeholder=" " value={form.city} onChange={handleChange} />
            <label htmlFor="city">Grad</label>
          </div>
          <div className="field">
            <input id="phone" name="phone" placeholder=" " value={form.phone} onChange={handleChange} />
            <label htmlFor="phone">Telefon</label>
          </div>
        </div>
        {import.meta.env.VITE_TURNSTILE_SITE_KEY && <Turnstile siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY} onSuccess={setCaptchaToken} onExpire={() => setCaptchaToken('')} />}
        {error && <div className="form-error">{error}</div>}
        <button type="submit" className="primary-button auth-submit" disabled={loading}>
          {loading ? 'Registracija...' : 'Nastavi'}
        </button>
      </form>

      <p className="auth-switch">
        Već imaš račun? <Link to="/login">Prijavi se</Link>
      </p>

      <GoogleAuthButton label="Nastavi sa Google računom" onError={setError} />
    </AuthLayout>
  )
}

export default RegisterPage
