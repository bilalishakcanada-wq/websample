import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function ProtectedRoute({ children, allowedRoles = [] }) {
  const { user, isAdmin, isModerator, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <div className="page-state">Učitavanje...</div>
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // staff routes: ADMIN only, or ADMIN + MODERATOR when both are listed
  if (allowedRoles.length > 0) {
    const allowed = (allowedRoles.includes('ADMIN') && isAdmin) || (allowedRoles.includes('MODERATOR') && isModerator)
    if (!allowed) return <Navigate to="/403" replace />
  }

  return children
}

export default ProtectedRoute
