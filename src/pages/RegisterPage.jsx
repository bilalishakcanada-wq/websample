import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Briefcase, Hammer, Repeat } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Turnstile } from '@marsidev/react-turnstile'
import GoogleAuthButton from '../components/GoogleAuthButton'
import AuthLayout from '../components/AuthLayout'
import { serviceCategories } from '../data/categories'

const ACCOUNT_TYPES = [
  { value: 'client', label: 'Tražim majstora', hint: 'Objavljujem poslove i biram ponude', icon: Briefcase },
  { value: 'provider', label: 'Pružam usluge', hint: 'Tražim poslove i šaljem ponude', icon: Hammer },
  { value: 'both', label: 'Oboje', hint: 'I objavljujem i radim poslove', icon: Repeat },
]

function RegisterPage() {
  const navigate = useNavigate()
  const { user, register } = useAuth()
  const [form, setForm] = useState({ fullName: '', email: '', password: '', city: '', phone: '' })
  const [accountType, setAccountType] = useState('client')
  const [trades, setTrades] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [captchaToken, setCaptchaToken] = useState('')
  const offersServices = accountType === 'provider' || accountType === 'both'

  const toggleTrade = (name) => {
    setTrades((current) => current.includes(name)
      ? current.filter((item) => item !== name)
      : [...current, name])
  }

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
      const result = await register({
        ...form,
        captchaToken,
        accountType,
        trades: offersServices ? trades : [],
      })
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
        <fieldset className="account-type-picker">
          <legend>Kako želiš koristiti Poso.ba?</legend>
          {ACCOUNT_TYPES.map(({ value, label, hint, icon: Icon }) => (
            <button
              key={value}
              type="button"
              className={`account-type-card ${accountType === value ? 'active' : ''}`}
              onClick={() => setAccountType(value)}
              aria-pressed={accountType === value}
            >
              <Icon size={20} />
              <strong>{label}</strong>
              <span>{hint}</span>
            </button>
          ))}
        </fieldset>

        {offersServices && (
          <div className="trade-picker">
            <span className="trade-picker-label">Za šta si majstor? <small>(možeš izabrati više)</small></span>
            <div className="trade-chips">
              {serviceCategories.map(({ id, name }) => (
                <button
                  key={id}
                  type="button"
                  className={`trade-chip ${trades.includes(name) ? 'active' : ''}`}
                  onClick={() => toggleTrade(name)}
                  aria-pressed={trades.includes(name)}
                >
                  {name}
                </button>
              ))}
            </div>
            <small className="trade-picker-note">
              Nakon registracije možeš poslati dokaz o struci i dobiti oznaku verifikovanog majstora.
            </small>
          </div>
        )}

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
