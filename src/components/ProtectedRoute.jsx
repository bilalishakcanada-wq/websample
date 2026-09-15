import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function ProtectedRoute({ children, allowedRoles = [] }) {
  const { user, isAdmin, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <div className="page-state">Učitavanje...</div>
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (allowedRoles.includes('ADMIN') && !isAdmin) {
    return <Navigate to="/403" replace />
  }

  return children
}

export default ProtectedRoute
