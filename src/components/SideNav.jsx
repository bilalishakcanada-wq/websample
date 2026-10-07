import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Bell, CircleCheck, ClipboardList, HelpCircle, Info, LogOut, Menu, MessageCircle, PlusSquare, Search, ShieldCheck, Tag, UserRound, Wrench } from 'lucide-react'
import BrandMark from './BrandMark'
import { useAuth } from '../context/AuthContext'
import { useUnreadMessages } from '../hooks/useUnreadMessages'
import { useUnreadNotifications } from '../hooks/useUnreadNotifications'
import { prefetchRoute } from '../utils/prefetch'
import { appConfig } from '../config/appConfig'
import './Navigation.css'

/* Computer, signed in: one fixed column on the left (like Instagram on the web) instead of the top bar.
   Icons only on narrower screens, icon + name from 1280px. Guests keep the top bar with the marketing links. */
const items = [
  ['/', 'Početna', CircleCheck],
  ['/search', 'Pretraži', Search],
  ['/moji-poslovi', 'Moji poslovi', ClipboardList],
  ['/messages', 'Poruke', MessageCircle],
  ['/account/obavijesti', 'Obavijesti', Bell],
  ['/objavi', 'Objavi posao', PlusSquare],
  ['/account', 'Nalog', UserRound],
]

const isOn = (to, pathname) => {
  if (to === '/') return pathname === '/'
  if (to === '/account') return pathname.startsWith('/account') && !pathname.startsWith('/account/obavijesti')
  return pathname.startsWith(to)
}

const count = (n) => (n > 9 ? '9+' : n)

function SideNav() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user, isAdmin, isModerator, logout } = useAuth()
  const unreadMessages = useUnreadMessages(user?.id)
  const unreadNotifications = useUnreadNotifications(user?.id)
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef(null)

  // the top bar steps aside while the sidebar is shown (see Navigation.css)
  useEffect(() => {
    document.body.dataset.sidebar = 'on'
    return () => { delete document.body.dataset.sidebar }
  }, [])

  useEffect(() => {
    if (!moreOpen) return undefined
    const onPointer = (event) => { if (!moreRef.current?.contains(event.target)) setMoreOpen(false) }
    const onKey = (event) => event.key === 'Escape' && setMoreOpen(false)
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('pointerdown', onPointer); document.removeEventListener('keydown', onKey) }
  }, [moreOpen])

  const badgeFor = (to) => (to === '/messages' ? unreadMessages : to === '/account/obavijesti' ? unreadNotifications : 0)

  return (
    <nav className="side-nav" aria-label="Glavna navigacija">
      <Link to="/" className="side-nav-logo" aria-label={`${appConfig.appName} početna`}>
        <BrandMark size={34} />
        <span className="side-nav-wordmark">{appConfig.appName}</span>
      </Link>

      <div className="side-nav-list">
        {items.map(([to, label, Icon]) => {
          const on = isOn(to, pathname)
          const badge = badgeFor(to)
          return (
            <Link key={to} to={to} className={`side-nav-item ${on ? 'active' : ''}`} aria-current={on ? 'page' : undefined} title={label} data-testid={`side-${to === '/' ? 'home' : to.slice(1).replace(/\//g, '-')}`} onPointerDown={() => prefetchRoute(to)}>
              <span className="side-nav-icon">
                <Icon size={24} strokeWidth={on ? 2.5 : 1.75} />
                {badge > 0 && <b key={badge} className="mobile-nav-badge" aria-label={`${badge} nepročitanih`}>{count(badge)}</b>}
              </span>
              <span className="side-nav-label">{label}</span>
            </Link>
          )
        })}
        {isAdmin && <NavLink to="/admin" className="side-nav-item" title="Admin panel"><span className="side-nav-icon"><ShieldCheck size={24} strokeWidth={1.75} /></span><span className="side-nav-label">Admin panel</span></NavLink>}
        {isModerator && <NavLink to="/mod" className="side-nav-item" title="Mod panel"><span className="side-nav-icon"><ShieldCheck size={24} strokeWidth={1.75} /></span><span className="side-nav-label">Mod panel</span></NavLink>}
      </div>

      <div className="side-nav-more" ref={moreRef}>
        {moreOpen && (
          <div className="side-nav-menu" role="menu" onClick={(event) => event.target.closest('a') && setMoreOpen(false)}>
            <Link role="menuitem" to="/account/profil"><UserRound size={18} /> Moj profil</Link>
            <Link role="menuitem" to="/kako-radi"><Info size={18} /> Kako radi</Link>
            <Link role="menuitem" to="/cijene"><Tag size={18} /> Cijene</Link>
            <Link role="menuitem" to="/zaradi"><Wrench size={18} /> Postani izvođač</Link>
            <Link role="menuitem" to="/pomoc"><HelpCircle size={18} /> Pomoć</Link>
            <hr />
            <button role="menuitem" type="button" onClick={async () => { setMoreOpen(false); await logout(); navigate('/') }}><LogOut size={18} /> Odjava</button>
          </div>
        )}
        <button type="button" className={`side-nav-item ${moreOpen ? 'active' : ''}`} aria-expanded={moreOpen} aria-haspopup="menu" title="Više" onClick={() => setMoreOpen((open) => !open)}>
          <span className="side-nav-icon"><Menu size={24} strokeWidth={moreOpen ? 2.5 : 1.75} /></span>
          <span className="side-nav-label">Više</span>
        </button>
      </div>
    </nav>
  )
}

export default SideNav
