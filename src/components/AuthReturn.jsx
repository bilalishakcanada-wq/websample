import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { LANDING_PATHS, takeReturn } from '../utils/afterAuth'

/**
 * Right after a sign-in that landed on a start page by itself (Google, the confirmation mail, a fresh
 * sign-up), take the person back to what they were doing before we asked them to sign in.
 */
function AuthReturn() {
  const { user, loading, emailCheck } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  useEffect(() => {
    // an account that still has to confirm its email keeps the way back for after the confirmation
    if (loading || !user || emailCheck.pending || !LANDING_PATHS.includes(pathname)) return
    const back = takeReturn()
    if (back && back !== pathname) navigate(back, { replace: true })
  }, [user, loading, emailCheck.pending, pathname, navigate])
  return null
}

export default AuthReturn
