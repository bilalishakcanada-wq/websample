import { useEffect } from 'react'
import {
  ChatCircleIcon as MessageCircle,
  CheckCircleIcon as CircleCheck,
  ClipboardTextIcon as ClipboardList,
  MagnifyingGlassIcon as Search,
  UserIcon as UserRound,
} from '@phosphor-icons/react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { navigateWithTransition } from '../utils/viewTransition'
import { haptic } from '../utils/native'
import './Navigation.css'
import { prefetchRoute, warmMainRoutes } from '../utils/prefetch'
import { useAuth } from '../context/AuthContext'
import { useUnreadMessages } from '../hooks/useUnreadMessages'

/* Phone tab bar. Five tabs, like the apps people already know: home, browse, my tasks, messages, account.
   On a computer the same places sit in the top bar (SiteHeader). */
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
   * Every tab is one step, like every other screen: back always returns to the screen that was
   * open before, one at a time (Početna → Pretraži → Poruke, back → Pretraži → Početna).
   * Tapping the tab you are on scrolls back to the top.
   */
  const onTab = (event, to) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    haptic('light')
    if (pathname === to) { scrollHome(); return }
    navigateWithTransition(navigate, to)
  }

  if (hidden) return null
  const active = tabs.findIndex(([to]) => (to === '/' ? pathname === '/' : pathname.startsWith(to)))

  return (
    <nav className="mobile-nav" aria-label="Mobilna navigacija">
      {tabs.map(([to, label, Icon], index) => (
        <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`} data-own-nav="" data-testid={`nav-${to === '/' ? 'home' : to.slice(1).replace(/\//g, '-')}`} onClick={(event) => onTab(event, to)} onPointerDown={() => prefetchRoute(to)}>
          <span className="mobile-nav-icon">
            <Icon size={24} weight={index === active ? "fill" : "regular"} />
            {to === '/messages' && unread > 0 && <b key={unread} className="mobile-nav-badge">{unread > 9 ? '9+' : unread}</b>}
          </span>
          <span className="mobile-nav-label" data-label={label}>{label}</span>
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
