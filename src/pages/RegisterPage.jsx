import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Briefcase, Hammer, Repeat } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useCaptcha } from '../hooks/useCaptcha'
import OAuthButtons from '../components/OAuthButtons'
import AuthLayout from '../components/AuthLayout'
import CheckEmail from '../components/CheckEmail'
import { serviceCategories } from '../data/categories'
import { getMode } from '../app/mode'
import { useMediaQuery } from '../hooks/useMediaQuery'
import PasswordField from '../components/PasswordField'
import { EMAIL_DOWN } from '../services/authService'
import { useRequiredPermissions } from '../components/RequiredPermissions'
import { forgetReturn, rememberReturn, safeNext } from '../utils/afterAuth'

const ACCOUNT_TYPES = [
  { value: 'client', label: 'Tražim majstora', hint: 'Objavljujem poslove i biram ponude', icon: Briefcase },
  { value: 'provider', label: 'Pružam usluge', hint: 'Tražim poslove i šaljem ponude', icon: Hammer },
  { value: 'both', label: 'Oboje', hint: 'I objavljujem i radim poslove', icon: Repeat },
]

function RegisterPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isPhone = useMediaQuery('(max-width: 768px)')
  const { user, register, login } = useAuth()
  // after an email sign-up that waits for the confirmation link: { email, password } (memory only)
  const [waiting, setWaiting] = useState(null)
  const [form, setForm] = useState({ fullName: '', email: '', password: '', city: '', phone: '' })
  // the goal chosen on the phone welcome flow pre-fills the account type
  const [accountType, setAccountType] = useState(() => (getMode() === 'tasker' ? 'provider' : 'client'))
  const next = safeNext(searchParams.get('next'))
  // the confirmation mail and Google sign-up come back to a start page: from there, on to `next`
  useEffect(() => { if (next) rememberReturn(next) }, [next])
  const [trades, setTrades] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const captcha = useCaptcha()
  // Google Play (UGC policy): the terms are accepted explicitly before anyone posts or messages
  const [accepted, setAccepted] = useState(false)
  const offersServices = accountType === 'provider' || accountType === 'both'
  // a new account is offered location and notifications once (both can be skipped here; posting a job,
  // an offer and the job search ask for location again, because distance depends on it)
  const permissions = useRequiredPermissions('account')

  const toggleTrade = (name) => {
    setTrades((current) => current.includes(name)
      ? current.filter((item) => item !== name)
      : [...current, name])
  }

  if (user) {
    // a brand-new account (just confirmed) goes to profile setup first
    return <Navigate to={next || (waiting ? '/account/profil?setup=1' : '/account')} replace />
  }

  if (waiting) {
    return (
      <CheckEmail
        email={waiting.email}
        password={waiting.password}
        signIn={login}
        onSignedIn={() => { forgetReturn(); navigate(next || '/account/profil?setup=1', { replace: true }) }}
        onChangeEmail={() => { setWaiting(null); setForm((current) => ({ ...current, email: '' })) }}
      />
    )
  }

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    await permissions.ensure()
    setLoading(true)

    try {
      const result = await register({
        ...form,
        captchaToken: captcha.token,
        accountType,
        trades: offersServices ? trades : [],
      })
      if (result.session) { forgetReturn(); navigate(next || '/account/profil?setup=1') }
      else setWaiting({ email: form.email.trim().toLowerCase(), password: form.password })
    } catch (err) {
      setError(err.message)
      captcha.reset()
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="Napravi svoj račun">
      <form onSubmit={handleSubmit} className="auth-form">
        <fieldset className={`account-type-picker ${isPhone && next ? 'is-collapsed' : ''}`}>
          <legend>Kako želiš koristiti Zadatak?</legend>
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
          <input id="fullName" name="fullName" autoComplete="name" autoCapitalize="words" placeholder=" " value={form.fullName} onChange={handleChange} required />
          <label htmlFor="fullName">Ime i prezime</label>
        </div>
        <div className="field">
          <input id="email" name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" placeholder=" " value={form.email} onChange={handleChange} required />
          <label htmlFor="email">Email adresa</label>
        </div>
        <PasswordField name="password" label="Lozinka" value={form.password} onChange={handleChange} isNew />
        <div className="field-row">
          <div className="field">
            <input id="city" name="city" placeholder=" " value={form.city} onChange={handleChange} />
            <label htmlFor="city">Grad</label>
          </div>
          {!isPhone && (
            <div className="field">
              <input id="phone" name="phone" placeholder=" " value={form.phone} onChange={handleChange} />
              <label htmlFor="phone">Telefon</label>
            </div>
          )}
        </div>
        <label className="auth-accept">
          <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} required />
          <span>Imam 18 ili više godina i prihvatam <Link to="/pravila">Pravila i uslove</Link>, <Link to="/pravila-zajednice">Pravila zajednice</Link> i <Link to="/privatnost">Politiku privatnosti</Link>.</span>
        </label>
        {captcha.widget}
        {error && <div className="form-error">{error}{error === EMAIL_DOWN && <> <Link to="/kontakt?tema=account">Otvori Kontakt</Link></>}</div>}
        <button data-testid="register-submit" type="submit" className="primary-button auth-submit" disabled={loading}>
          {loading ? 'Registracija...' : 'Nastavi'}
        </button>
      </form>

      <p className="auth-switch">
        Već imaš račun? <Link to={`/login${next ? `?next=${encodeURIComponent(next)}` : ''}`}>Prijavi se</Link>
      </p>

      <OAuthButtons verb="Registruj se" onError={setError} canStart={async () => {
        if (!accepted) { setError('Prvo označi da prihvataš pravila i da imaš 18 ili više godina.'); return false }
        // the permission screens (if any are left), then straight on to Google / Apple: no second tap
        await permissions.ensure()
        return true
      }} />
      {permissions.sheet}
    </AuthLayout>
  )
}

export default RegisterPage
