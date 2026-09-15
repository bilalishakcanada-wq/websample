import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authService } from '../services/authService'

function ResetPasswordPage() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      await authService.updatePassword(password)
      navigate('/dashboard', { replace: true })
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h1>Nova lozinka</h1>
        <form onSubmit={handleSubmit} className="auth-form">
          <label>Nova lozinka<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
          {error && <div className="form-error">{error}</div>}
          <button type="submit" className="primary-button" disabled={loading}>{loading ? 'Čuvam...' : 'Promijeni lozinku'}</button>
        </form>
        <div className="auth-links"><Link to="/login">Prijava</Link><Link to="/">Početna</Link></div>
      </div>
    </div>
  )
}

export default ResetPasswordPage