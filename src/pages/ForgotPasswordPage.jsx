import { useState } from 'react'
import { Link } from 'react-router-dom'
import { authService } from '../services/authService'

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
    <div className="auth-shell">
      <div className="auth-card">
        <h1>Zaboravljena lozinka</h1>
        <form onSubmit={handleSubmit} className="auth-form">
          <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          {error && <div className="form-error">{error}</div>}
          {message && <div className="form-success">{message}</div>}
          <button type="submit" className="primary-button" disabled={loading}>{loading ? 'Šaljem...' : 'Pošalji link'}</button>
        </form>
        <div className="auth-links"><Link to="/login">Nazad na prijavu</Link><Link to="/">Početna</Link></div>
      </div>
    </div>
  )
}

export default ForgotPasswordPage