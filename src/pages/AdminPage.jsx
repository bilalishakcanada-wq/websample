import { useCallback, useEffect, useMemo, useState } from 'react'
import CountUp from '../components/CountUp'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Award, BellRing, Coins, IdCard, LifeBuoy, MessageSquare, Radar, ScanEye, Search, ShieldAlert, ShieldCheck, Tag, UsersRound, Users,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { adminService } from '../services/adminService'
import { desktopNotify } from '../services/notificationService'
import { StaffContext } from './admin/shared'
import OversightTab from './admin/OversightTab'
import IdentityTab from './admin/IdentityTab'
import MessagesTab from './admin/MessagesTab'
import UsersTab from './admin/UsersTab'
import TeamTab from './admin/TeamTab'
import BadgesTab from './admin/BadgesTab'
import WalletTab from './admin/WalletTab'
import { ListingsTab, ModerationTab, RegistryTab, ReportsTab, SupportTab, VerificationTab } from './admin/SimpleTabs'

const TABS = [
  { id: 'oversight', label: 'Nadzor', icon: Radar, hint: 'Sve što se dešava, uživo' },
  { id: 'users', label: 'Korisnici', icon: Users, hint: 'Pretraga i dosije svakog naloga' },
  { id: 'support', label: 'Podrška', icon: LifeBuoy, hint: 'Razgovori sa korisnicima', counter: 'support_unread' },
  { id: 'moderation', label: 'Moderacija', icon: ScanEye, hint: 'Pravilo #1, slike, suspenzije', counter: 'strikes_24h' },
  // identitet smiju provjeravati i moderatori, ne samo admin
  { id: 'identity', label: 'Identitet', icon: IdCard, hint: 'JMBG i dokumenti na provjeri', counter: 'identity_pending' },
  { id: 'reports', label: 'Prijave', icon: ShieldAlert, hint: 'Šta korisnici prijavljuju', counter: 'reports_open' },
  { id: 'messages', label: 'Poruke', icon: MessageSquare, hint: 'Svi razgovori na platformi', adminOnly: true },
  { id: 'verification', label: 'Verifikacija', icon: ShieldCheck, hint: 'Dokumenti i licence', counter: 'verifications_pending', adminOnly: true },
  { id: 'listings', label: 'Oglasi', icon: Tag, hint: 'Svi oglasi', adminOnly: true },
  { id: 'badges', label: 'Značke', icon: Award, hint: 'Katalog i dodjela', adminOnly: true },
  { id: 'wallet', label: 'Balans', icon: Coins, hint: 'Stanja računa i transakcije', adminOnly: true },
  { id: 'team', label: 'Tim', icon: UsersRound, hint: 'Admini, moderatori, dnevnik', adminOnly: true },
  { id: 'registry', label: 'ID registar', icon: IdCard, hint: 'Privatni ID-ovi, i obrisani', adminOnly: true },
]

const KPIS = [
  ['users', 'Korisnika', 'users_7d', '+{v} ove sedmice'],
  ['online_now', 'Online sada', null, 'zadnjih 5 min'],
  ['listings_open', 'Aktivnih oglasa', 'listings_completed', '{v} završenih'],
  ['messages_24h', 'Poruka / 24 h', 'logins_24h', '{v} prijava na nalog'],
  ['strikes_24h', 'Kršenja / 24 h', 'suspended', '{v} suspendovanih'],
  ['reports_open', 'Otvorenih prijava', 'verifications_pending', '{v} čeka verifikaciju'],
]

/** Staff console. `mode` decides the menu: admins get everything, moderators a short list. */
function AdminPage({ mode = 'admin' }) {
  const { user, isAdmin } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const isAdminMode = mode === 'admin' && isAdmin
  const tabs = useMemo(() => TABS.filter((item) => isAdminMode || !item.adminOnly), [isAdminMode])
  const tabParam = searchParams.get('tab')
  const tab = tabs.some((item) => item.id === tabParam) ? tabParam : 'oversight'
  const openUserId = searchParams.get('user') || ''
  const [overview, setOverview] = useState(null)
  const [quick, setQuick] = useState('')
  const [quickTerm, setQuickTerm] = useState('')
  const [notifState, setNotifState] = useState(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission)

  const setTab = useCallback((next, extra = {}) => {
    setSearchParams({ tab: next, ...extra })
  }, [setSearchParams])

  const openUser = useCallback((userId) => setSearchParams({ tab: 'users', user: userId }), [setSearchParams])

  const loadOverview = useCallback(() => { adminService.overview().then(setOverview) }, [])
  useEffect(() => { loadOverview() }, [loadOverview])
  useEffect(() => adminService.subscribeFeed(() => loadOverview()), [loadOverview])
  useEffect(() => { const timer = window.setInterval(loadOverview, 60000); return () => window.clearInterval(timer) }, [loadOverview])

  const enableDesktop = async () => {
    if (typeof Notification === 'undefined') return
    const result = await Notification.requestPermission()
    setNotifState(result)
    if (result === 'granted') desktopNotify('Poso.ba obavijesti uključene', 'Dobit ćeš obavijest za svaku poruku podrške i suspenziju.')
  }

  const quickSearch = (event) => {
    event.preventDefault()
    if (!quick.trim()) return
    setQuickTerm(quick.trim())
    setTab('users')
  }

  const active = tabs.find((item) => item.id === tab)
  const context = useMemo(() => ({ mode: isAdminMode ? 'admin' : 'moderator', isAdmin: isAdminMode, openUser }), [isAdminMode, openUser])

  return (
    <StaffContext.Provider value={context}>
      <div className="adm">
        <aside className="adm-rail">
          <div className="adm-brand">
            <span className="adm-brand-mark"><ShieldCheck size={18} /></span>
            <div><strong>{isAdminMode ? 'Kontrolna soba' : 'Mod panel'}</strong><small>Poso.ba tim</small></div>
          </div>
          <nav className="adm-nav" aria-label="Panel">
            {tabs.map(({ id, label, icon: Icon, counter }) => {
              const count = counter && overview ? Number(overview[counter]) : 0
              return (
                <button key={id} type="button" className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
                  <Icon size={17} /> <span>{label}</span>{count > 0 && <em className="adm-nav-count">{count}</em>}
                </button>
              )
            })}
          </nav>
          <div className="adm-rail-foot">
            {notifState !== 'granted' && notifState !== 'unsupported' && (
              <button type="button" className="adm-notif" onClick={enableDesktop}><BellRing size={14} /> Uključi obavijesti</button>
            )}
            <Link to="/" className="adm-rail-link">← Nazad na stranicu</Link>
            <small>{user.email}</small>
          </div>
        </aside>

        <main className="adm-main">
          <header className="adm-topbar">
            <div>
              <h1>{active?.label}</h1>
              <p>{active?.hint}</p>
            </div>
            <form className="adm-quick" onSubmit={quickSearch}>
              <Search size={15} />
              <input value={quick} onChange={(event) => setQuick(event.target.value)} placeholder="Nađi korisnika: ime, PB-ID, email…" />
            </form>
            <span className="adm-live"><span className="admin-live-dot" /> uživo</span>
          </header>

          {overview && !openUserId && (
            <div className="adm-kpis">
              {KPIS.map(([key, label, subKey, subTemplate]) => (
                <div key={key} className={`adm-kpi kpi-${key}`}>
                  <strong><CountUp value={overview[key] ?? 0} /></strong>
                  <span>{label}</span>
                  <small>{subKey ? subTemplate.replace('{v}', overview[subKey] ?? 0) : subTemplate}</small>
                </div>
              ))}
            </div>
          )}

          <section className="adm-content">
            {tab === 'oversight' && <OversightTab />}
            {tab === 'users' && <UsersTab openUserId={openUserId} onOpenUser={openUser} onCloseUser={() => setTab('users')} initialTerm={quickTerm} />}
            {tab === 'support' && <SupportTab />}
            {tab === 'moderation' && <ModerationTab />}
            {tab === 'identity' && <IdentityTab />}
            {tab === 'reports' && <ReportsTab />}
            {isAdminMode && tab === 'messages' && <MessagesTab />}
            {isAdminMode && tab === 'verification' && <VerificationTab />}
            {isAdminMode && tab === 'listings' && <ListingsTab />}
            {isAdminMode && tab === 'badges' && <BadgesTab />}
            {isAdminMode && tab === 'wallet' && <WalletTab />}
            {isAdminMode && tab === 'team' && <TeamTab />}
            {isAdminMode && tab === 'registry' && <RegistryTab />}
          </section>
        </main>
      </div>
    </StaffContext.Provider>
  )
}

export default AdminPage
