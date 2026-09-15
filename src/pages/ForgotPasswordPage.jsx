import { useState } from 'react'
import { Link } from 'react-router-dom'
import { authService } from '../services/authService'
import AuthLayout from '../components/AuthLayout'

function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')
    try {
      await authService.resetPassword(email)
      setMessage('Ako račun postoji, link za reset lozinke je poslan na email.')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="Zaboravljena lozinka" subtitle="Poslat ćemo ti link za postavljanje nove lozinke.">
      <form onSubmit={handleSubmit} className="auth-form">
        <div className="field">
          <input id="email" type="email" placeholder=" " value={email} onChange={(event) => setEmail(event.target.value)} required />
          <label htmlFor="email">Email adresa</label>
        </div>
        {error && <div className="form-error">{error}</div>}
        {message && <div className="form-success">{message}</div>}
        <button type="submit" className="primary-button auth-submit" disabled={loading}>{loading ? 'Šaljem...' : 'Pošalji link'}</button>
      </form>
      <p className="auth-switch"><Link to="/login">Nazad na prijavu</Link></p>
    </AuthLayout>
  )
}

export default ForgotPasswordPage