import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authService } from '../services/authService'
import AuthLayout from '../components/AuthLayout'
import PasswordField from '../components/PasswordField'

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
      navigate('/account', { replace: true })
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="Postavi novu lozinku">
      <form onSubmit={handleSubmit} className="auth-form">
        <PasswordField label="Nova lozinka" value={password} onChange={(event) => setPassword(event.target.value)} isNew />
        {error && <div className="form-error">{error}</div>}
        <button type="submit" className="primary-button auth-submit" disabled={loading}>{loading ? 'Čuvam...' : 'Promijeni lozinku'}</button>
      </form>
      <p className="auth-switch"><Link to="/login">Nazad na prijavu</Link></p>
    </AuthLayout>
  )
}

export default ResetPasswordPage