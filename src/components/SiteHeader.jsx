import BrandMark from './BrandMark'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useBackToClose } from '../hooks/useBackToClose'
import { usePresence } from '../hooks/usePresence'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { ChevronDown, HelpCircle, LayoutDashboard, LogOut, Menu, MessageCircle, ShieldCheck, UserRound, Wrench, X } from 'lucide-react'
import { useUnreadMessages } from '../hooks/useUnreadMessages'
import { useAuth } from '../context/AuthContext'
import { serviceCategories } from '../data/categories'
import NotificationBell from './NotificationBell'
import { onScroll, scrollOffset } from '../utils/scroll'
import { appConfig } from '../config/appConfig'

const HIDDEN_ON = ['/login', '/register', '/forgot-password', '/reset-password']

const NAV_LINKS = [
  ['/search', 'Pretraži poslove'],
  ['/kako-radi', 'Kako radi'],
  ['/cijene', 'Cijene'],
]
// signed in (computer): the work links, like Airtasker's top bar (Browse tasks, My tasks)
const USER_NAV_LINKS = [
  ['/search', 'Pretraži poslove'],
  ['/moji-poslovi', 'Moji poslovi'],
]

const firstNameOf = (user) => (user?.user_metadata?.full_name || user?.email || '').trim().split(/[\s@]+/)[0] || 'Profil'

function SiteHeader() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user, logout, isAdmin, isModerator } = useAuth()
  const [categoriesOpen, setCategoriesOpen] = useState(false)
  const [menuPinned, setMenuPinned] = useState(false)
  const [navMode, setNavMode] = useState('client')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const accountRef = useRef(null)
  const unreadMessages = useUnreadMessages(user?.id)
  useBackToClose(mobileOpen, () => setMobileOpen(false))
  const drawer = usePresence(mobileOpen, 180)
  const [scrolled, setScrolled] = useState(false)
  const headerRef = useRef(null)
  const megaMenuRef = useRef(null)
  const closeTimerRef = useRef(null)
  const isTouch = useMemo(() => typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches, [])

  // Close everything on navigation.
  useEffect(() => {
    setCategoriesOpen(false)
    setMenuPinned(false)
    setMobileOpen(false)
    setAccountOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!accountOpen) return undefined
    const onPointer = (event) => { if (!accountRef.current?.contains(event.target)) setAccountOpen(false) }
    const onKey = (event) => event.key === 'Escape' && setAccountOpen(false)
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('pointerdown', onPointer); document.removeEventListener('keydown', onKey) }
  }, [accountOpen])

  // Subtle elevation once the page is scrolled.
  useEffect(() => {
    const update = () => setScrolled(scrollOffset() > 8)
    update()
    return onScroll(update)
  }, [])

  // Outside click / Escape closes the categories panel and the mobile drawer.
  useEffect(() => {
    if (!categoriesOpen && !mobileOpen) return undefined
    const closeAll = () => { setCategoriesOpen(false); setMenuPinned(false); setMobileOpen(false) }
    const onPointer = (event) => {
      if (megaMenuRef.current && !megaMenuRef.current.contains(event.target)) { setCategoriesOpen(false); setMenuPinned(false) }
      if (headerRef.current && !headerRef.current.contains(event.target)) setMobileOpen(false)
    }
    const onKey = (event) => event.key === 'Escape' && closeAll()
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [categoriesOpen, mobileOpen])

  if (HIDDEN_ON.some((prefix) => pathname.startsWith(prefix))) return null

  const pickCategory = (name) => {
    setCategoriesOpen(false)
    setMenuPinned(false)
    navigate(navMode === 'provider' ? '/zaradi' : `/search?category=${encodeURIComponent(name)}`)
  }

  return (
    <>
      <header ref={headerRef} className={`site-header ${scrolled ? 'scrolled' : ''} ${user ? 'is-signed-in' : ''}`}>
        <div className="site-header-inner">
          <Link to="/" className="site-logo" aria-label="Zadatak početna">
            <BrandMark size={34} className="site-logo-mark" />
            <span className="site-logo-text">{appConfig.appName}</span>
          </Link>

          <Link data-testid="header-post-job" to="/objavi" className="site-header-cta">Objavi posao</Link>

          <nav className="site-nav" aria-label="Glavna navigacija">
            <div
              className="nav-mega"
              ref={megaMenuRef}
              onMouseEnter={() => { if (isTouch) return; window.clearTimeout(closeTimerRef.current); setCategoriesOpen(true) }}
              onMouseLeave={() => {
                if (isTouch || menuPinned) return
                window.clearTimeout(closeTimerRef.current)
                closeTimerRef.current = window.setTimeout(() => setCategoriesOpen(false), 220)
              }}
            >
              <button
                type="button"
                className={`site-nav-link nav-mega-trigger ${categoriesOpen ? 'active' : ''}`}
                aria-expanded={categoriesOpen}
                onClick={() => {
                  window.clearTimeout(closeTimerRef.current)
                  const next = !(categoriesOpen && menuPinned)
                  setCategoriesOpen(next)
                  setMenuPinned(next)
                }}
              >
                Kategorije <ChevronDown size={14} className={categoriesOpen ? 'rotated' : ''} />
              </button>
              {categoriesOpen && (
                <div className="nav-mega-panel">
                  <div className="nav-mega-side">
                    <h4>Šta vam treba?</h4>
                    <p>Izaberite kategoriju da vidite ponudu.</p>
                    <button type="button" className={`nav-mega-mode ${navMode === 'client' ? 'active' : ''}`} onClick={() => setNavMode('client')}>
                      <span>KAO KLIJENT</span>Tražim izvođača za...
                    </button>
                    <button type="button" className={`nav-mega-mode ${navMode === 'provider' ? 'active' : ''}`} onClick={() => setNavMode('provider')}>
                      <span>KAO IZVOĐAČ</span>Tražim posao u...
                    </button>
                  </div>
                  <div className="nav-mega-grid">
                    {serviceCategories.map(({ id, name, icon: Icon }) => (
                      <button key={id} type="button" onClick={() => pickCategory(name)}><Icon size={15} /> {name}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {(user ? USER_NAV_LINKS : NAV_LINKS).map(([to, label]) => (
              <NavLink key={to} to={to} className={({ isActive }) => `site-nav-link ${isActive ? 'active' : ''}`}>{label}</NavLink>
            ))}
          </nav>

          <div className="site-header-right">
            {user ? (
              <>
                <NavLink to="/pomoc" className={({ isActive }) => `site-nav-link ${isActive ? 'active' : ''}`}>Pomoć</NavLink>
                <NotificationBell />
                <NavLink to="/messages" className={({ isActive }) => `site-nav-link site-nav-messages ${isActive ? 'active' : ''}`}>
                  Poruke{unreadMessages > 0 && <b className="site-nav-count" aria-label={`${unreadMessages} nepročitanih`}>{unreadMessages > 9 ? '9+' : unreadMessages}</b>}
                </NavLink>
                <div className="site-account" ref={accountRef}>
                  <button type="button" className="site-user-chip" aria-haspopup="menu" aria-expanded={accountOpen} onClick={() => setAccountOpen((open) => !open)}>
                    <span className="site-user-avatar"><UserRound size={15} /></span>{firstNameOf(user)} <ChevronDown size={14} />
                  </button>
                  {accountOpen && (
                    <div className="site-account-menu" role="menu">
                      <Link role="menuitem" to="/account"><LayoutDashboard size={16} /> Moj nalog</Link>
                      <Link role="menuitem" to="/account/profil"><UserRound size={16} /> Moj profil</Link>
                      <Link role="menuitem" to="/zaradi"><Wrench size={16} /> Postani izvođač</Link>
                      <Link role="menuitem" to="/pomoc"><HelpCircle size={16} /> Pomoć</Link>
                      {isAdmin && <Link role="menuitem" to="/admin"><ShieldCheck size={16} /> Admin panel</Link>}
                      {isModerator && <Link role="menuitem" to="/mod"><ShieldCheck size={16} /> Mod panel</Link>}
                      <hr />
                      <button role="menuitem" type="button" onClick={async () => { setAccountOpen(false); await logout(); navigate('/') }}><LogOut size={16} /> Odjava</button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link to="/register" className="site-nav-link">Registruj se</Link>
                <Link to="/login" className="site-nav-link">Prijavi se</Link>
              </>
            )}
            {!user && <Link to="/zaradi" className="site-header-secondary">Postani izvođač</Link>}
          </div>

          {user && <div className="site-mobile-bell"><NotificationBell /></div>}
          {!user && <Link to="/login" className="site-phone-login">Prijava</Link>}
          <button type="button" className="site-burger" aria-label="Meni" aria-expanded={mobileOpen} onClick={() => setMobileOpen((open) => !open)}>
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {drawer.mounted && (
          <div className={`site-drawer ${drawer.closing ? 'is-closing' : ''}`} inert={drawer.closing || undefined}>
            <Link to="/objavi" className="primary-button">Objavi posao</Link>
            <Link to="/search">Pretraži poslove</Link>
            <Link to="/kako-radi">Kako radi</Link>
            <Link to="/cijene">Cijene</Link>
            <Link to="/zaradi">Postani izvođač</Link>
            <Link to="/pomoc">Pomoć</Link>
            <div className="site-drawer-divider" />
            {user ? (
              <>
                <Link to="/account"><LayoutDashboard size={16} /> Moj nalog</Link>
                <Link to="/messages"><MessageCircle size={16} /> Poruke</Link>
                <Link to="/account/profil"><UserRound size={16} /> Moj profil</Link>
                {isAdmin && <Link to="/admin"><ShieldCheck size={16} /> Admin panel</Link>}
                {isModerator && <Link to="/mod"><ShieldCheck size={16} /> Mod panel</Link>}
                <button type="button" onClick={async () => { await logout(); navigate('/') }}><LogOut size={16} /> Odjava</button>
              </>
            ) : (
              <>
                <Link to="/login">Prijavi se</Link>
                <Link to="/register">Registruj se</Link>
              </>
            )}
          </div>
        )}
      </header>
      <div className="site-header-spacer" aria-hidden="true" />
    </>
  )
}

export default SiteHeader
