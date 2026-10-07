import { useEffect } from 'react'
import { CircleCheck, ClipboardList, MessageCircle, Search, UserRound } from 'lucide-react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { navigateWithTransition } from '../utils/viewTransition'
import { haptic } from '../utils/native'
import './Navigation.css'
import { prefetchRoute, warmMainRoutes } from '../utils/prefetch'
import { useAuth } from '../context/AuthContext'
import { useUnreadMessages } from '../hooks/useUnreadMessages'

/* Phone tab bar. Five tabs, like the apps people already know: home, browse, my tasks, messages, account.
   On a computer the same places sit in the left sidebar (SideNav). */
const tabs = [
  ['/', 'Uradi', CircleCheck],
  ['/search', 'Pretraži', Search],
  ['/moji-poslovi', 'Moji poslovi', ClipboardList],
  ['/messages', 'Poruke', MessageCircle],
  ['/account', 'Nalog', UserRound],
]

const TAB_ROOTS = tabs.map(([to]) => to)

// Focused flows (auth, post flow, staff console) run full-screen without the tab bar.
const HIDDEN_ON = ['/login', '/register', '/forgot-password', '/reset-password', '/admin', '/mod', '/objavi', '/start', '/intro']

function MobileNav() {
  const location = useLocation()
  const { pathname } = location
  const navigate = useNavigate()
  const { user } = useAuth()
  const unread = useUnreadMessages(user?.id)
  const hidden = HIDDEN_ON.some((prefix) => pathname.startsWith(prefix))

  // Lets CSS drop the bottom padding reserved for the bar when it is not shown.
  useEffect(() => {
    document.body.dataset.tabbar = hidden ? 'off' : 'on'
    return () => { delete document.body.dataset.tabbar }
  }, [hidden])

  // instant tab switches: warm the main screens once, and the tapped one on touch-down
  useEffect(() => { warmMainRoutes() }, [])

  /*
   * Tabs don't stack up: from home a tab is one step (back returns home); hopping between the
   * other tabs replaces that step, and the home tab steps back to home instead of adding it again.
   * From a deeper screen (a job, a profile) a tab is a normal new step.
   */
  const onTab = (event, to, index) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    haptic('light')
    if (index === active) {
      if (pathname === to) scrollHome()
      else navigateWithTransition(navigate, to, { replace: true, state: location.state, dir: 'back' }) // tab root again
      return
    }
    const onTabRoot = TAB_ROOTS.includes(pathname)
    const fromHome = pathname === '/' || Boolean(location.state?.tabFromHome)
    if (to === '/' && onTabRoot && location.state?.tabFromHome && (window.history.state?.idx ?? 0) > 0) { navigate(-1); return }
    if (to === '/') { navigateWithTransition(navigate, '/'); return }
    navigateWithTransition(navigate, to, { replace: onTabRoot && pathname !== '/', state: { tabFromHome: onTabRoot && fromHome } })
  }

  if (hidden) return null
  const active = tabs.findIndex(([to]) => (to === '/' ? pathname === '/' : pathname.startsWith(to)))

  return (
    <nav className="mobile-nav" aria-label="Mobilna navigacija">
      {tabs.map(([to, label, Icon], index) => (
        <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`} data-own-nav="" data-testid={`nav-${to === '/' ? 'home' : to.slice(1).replace(/\//g, '-')}`} onClick={(event) => onTab(event, to, index)} onPointerDown={() => prefetchRoute(to)}>
          <span className="mobile-nav-icon">
            <Icon size={24} strokeWidth={index === active ? 2.5 : 1.75} />
            {to === '/messages' && unread > 0 && <b key={unread} className="mobile-nav-badge">{unread > 9 ? '9+' : unread}</b>}
          </span>
          <span className="mobile-nav-label">{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

// tapping the tab you're already on jumps back to the top, like every social app
const scrollHome = () => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
}

export default MobileNav
