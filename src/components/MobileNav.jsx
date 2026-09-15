import { Home, MessageCircle, Plus, Search, UserRound } from 'lucide-react'
import { NavLink, useNavigate } from 'react-router-dom'

const tabs = [
  ['/', 'Početna', Home],
  ['/search', 'Pretraga', Search],
  ['/objavi', 'Objavi', Plus],
  ['/messages', 'Poruke', MessageCircle],
  ['/profile', 'Profil', UserRound],
]

function MobileNav() {
  const navigate = useNavigate()

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
