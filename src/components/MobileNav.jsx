import { useEffect } from 'react'
import { Home, MessageCircle, Plus, Search, UserRound } from 'lucide-react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'

const tabs = [
  ['/', 'Početna', Home],
  ['/search', 'Pretraga', Search],
  ['/objavi', 'Objavi', Plus],
  ['/messages', 'Poruke', MessageCircle],
  ['/account', 'Nalog', UserRound],
]

// Focused flows (auth, post wizard, staff console) run full-screen without the tab bar.
const HIDDEN_ON = ['/login', '/register', '/forgot-password', '/reset-password', '/admin', '/mod', '/objavi']

function MobileNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const hidden = HIDDEN_ON.some((prefix) => pathname.startsWith(prefix))

  // Lets CSS drop the bottom padding reserved for the bar when it is not shown.
  useEffect(() => {
    document.body.dataset.tabbar = hidden ? 'off' : 'on'
    return () => { delete document.body.dataset.tabbar }
  }, [hidden])

  if (hidden) return null

  return (
    <nav className="mobile-nav" aria-label="Mobilna navigacija">
      {tabs.map(([to, label, Icon]) => (
        <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}>
          <Icon size={20} />
          <span>{label}</span>
        </NavLink>
      ))}
      <button type="button" className="mobile-nav-publish" onClick={() => navigate('/objavi')} aria-label="Objavi oglas">
        <Plus size={24} />
      </button>
    </nav>
  )
}

export default MobileNav
