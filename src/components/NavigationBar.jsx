import { useLocation } from 'react-router-dom'
import MobileNav from './MobileNav'
import SideNav from './SideNav'
import { useAuth } from '../context/AuthContext'
import { useMediaQuery } from '../hooks/useMediaQuery'

// sign-in screens and the staff console run without the sidebar (the console has its own menu)
const SIDEBAR_HIDDEN_ON = ['/login', '/register', '/forgot-password', '/reset-password', '/admin', '/mod']

/** The app's navigation: the tab bar at the bottom on phones, a sidebar on the left on computers. */
function NavigationBar() {
  const { pathname } = useLocation()
  const { user, loading } = useAuth()
  const isPhone = useMediaQuery('(max-width: 768px)')
  if (isPhone) return <MobileNav />
  // a stored session is still being read: keep the sidebar's place so the page doesn't jump from the top bar
  const signedIn = Boolean(user) || loading
  if (!signedIn || SIDEBAR_HIDDEN_ON.some((prefix) => pathname.startsWith(prefix))) return null
  return <SideNav />
}

export default NavigationBar
