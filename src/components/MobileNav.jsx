import { useEffect } from 'react'
import { CircleCheck, ClipboardList, MessageCircle, Search, UserRound } from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'
import { haptic } from '../utils/native'
import { prefetchRoute, warmMainRoutes } from '../utils/prefetch'
import { useAuth } from '../context/AuthContext'
import { useUnreadMessages } from '../hooks/useUnreadMessages'

/* Five tabs, like the apps people already know: home, browse, my tasks, messages, account. */
const tabs = [
  ['/', 'Uradi', CircleCheck],
  ['/search', 'Pretraži', Search],
  ['/moji-poslovi', 'Moji poslovi', ClipboardList],
  ['/messages', 'Poruke', MessageCircle],
  ['/account', 'Nalog', UserRound],
]

// Focused flows (auth, post flow, staff console) run full-screen without the tab bar.
const HIDDEN_ON = ['/login', '/register', '/forgot-password', '/reset-password', '/admin', '/mod', '/objavi', '/start', '/intro']

function MobileNav() {
  const { pathname } = useLocation()
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

  if (hidden) return null
  const active = tabs.findIndex(([to]) => (to === '/' ? pathname === '/' : pathname.startsWith(to)))

  return (
    <nav className="mobile-nav" aria-label="Mobilna navigacija">
      {/* one pill that glides to the active tab */}
      {active >= 0 && <span className="mobile-nav-indicator" aria-hidden="true" style={{ '--tab': active }} />}
      {tabs.map(([to, label, Icon]) => (
        <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`} onClick={() => haptic('light')} onPointerDown={() => prefetchRoute(to)}>
          <span className="mobile-nav-icon">
            <Icon size={22} strokeWidth={isActiveStroke(to, pathname)} />
            {to === '/messages' && unread > 0 && <b className="mobile-nav-badge">{unread > 9 ? '9+' : unread}</b>}
          </span>
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

const isActiveStroke = (to, pathname) => ((to === '/' ? pathname === '/' : pathname.startsWith(to)) ? 2.4 : 1.8)

export default MobileNav
