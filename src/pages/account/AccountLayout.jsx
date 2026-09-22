import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { keys, useMyBundle } from '../../hooks/queries'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Award, Bell, Camera, ChevronRight, CreditCard, History, Home, IdCard, Images, Settings, ShieldBan, Sparkles, Trophy, UserRound, Wallet, Wrench,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { profileService } from '../../services/profileService'
import { formatBosnianDate } from '../../utils/dateFormat'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import AccountMenu from '../../app/AccountMenu'
import { ArrowLeft } from 'lucide-react'

const AccountContext = createContext(null)
export const useAccount = () => useContext(AccountContext)

export const ACCOUNT_NAV = [
  { to: '/account', label: 'Početna', icon: Home, end: true },
  { to: '/account/ploca', label: 'Ploča izvođača', icon: Trophy, providerOnly: true },
  { to: '/account/placanja', label: 'Historija plaćanja', icon: History },
  { to: '/account/nacini-placanja', label: 'Načini plaćanja', icon: CreditCard },
  { to: '/account/novcanik', label: 'Balans', icon: Wallet },
  { to: '/account/obavijesti', label: 'Obavijesti', icon: Bell },
  { to: '/account/profil', label: 'Profil', icon: IdCard },
  { to: '/account/vjestine', label: 'Vještine', icon: Wrench, providerOnly: true },
  { to: '/account/znacke', label: 'Značke', icon: Award },
  { to: '/account/portfolio', label: 'Portfolio', icon: Images, providerOnly: true },
  { to: '/account/postavke', label: 'Postavke', icon: Settings, chevron: true },
  { to: '/account/alarmi', label: 'Alarmi za poslove', icon: Bell, providerOnly: true },
  { to: '/account/informacije', label: 'Informacije o nalogu', icon: IdCard, hidden: true },
  { to: '/account/placanje', label: 'Opcije plaćanja', icon: CreditCard, hidden: true },
  { to: '/account/postavke-obavijesti', label: 'Postavke obavijesti', icon: Bell, hidden: true },
]

function AccountLayout() {
  const isPhone = useMediaQuery('(max-width: 768px)')
  const { user } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  // the profile bundle is cached: coming back to any account page paints instantly, then refreshes
  const queryClient = useQueryClient()
  const bundleQuery = useMyBundle(user?.id)
  const bundle = bundleQuery.data ?? null
  const loading = bundleQuery.isPending
  const [error, setError] = useState('')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarNotice, setAvatarNotice] = useState('')
  const avatarInputRef = useRef(null)
  useEffect(() => { if (bundleQuery.error) setError(bundleQuery.error.message) }, [bundleQuery.error])

  const setBundle = useCallback((next) => {
    queryClient.setQueryData(keys.myBundle(user?.id), (current) => (typeof next === 'function' ? next(current) : next))
  }, [queryClient, user?.id])
  const reload = useCallback(async () => {
    const data = await profileService.getMyBundle()
    setBundle(data)
    return data
  }, [setBundle])

  // first visit after registration: profile must be filled in
  // On phones the nav is a horizontal strip: keep the active item in view.
  const navRef = useRef(null)
  useEffect(() => {
    const active = navRef.current?.querySelector('a.active')
    if (active && window.matchMedia('(max-width: 960px)').matches) {
      active.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
    }
  }, [pathname, bundle])

  useEffect(() => {
    if (bundle?.profile && !bundle.profile.onboarding_completed && pathname !== '/account/profil') {
      navigate('/account/profil?setup=1', { replace: true })
    }
  }, [bundle, pathname, navigate])

  const profile = bundle?.profile || null
  const isProvider = profile?.account_type && profile.account_type !== 'client'

  /** Save the profile with some fields changed; everything else stays as stored. */
  const saveProfile = useCallback(async (overrides = {}) => {
    const current = profile || {}
    const saved = await profileService.upsertProfile({
      user_id: user.id,
      email: user.email,
      full_name: current.full_name,
      city: current.city,
      phone: current.phone,
      bio: current.bio,
      avatar_url: current.avatar_url,
      account_type: current.account_type,
      trades: current.trades,
      education: current.education,
      work_experience: current.work_experience,
      specialties: current.specialties,
      transportation: current.transportation,
      languages: current.languages,
      birth_date: current.birth_date,
      tax_id: current.tax_id,
      notify_email: current.notify_email,
      notify_push: current.notify_push,
      ...overrides,
    })
    await reload()
    return saved
  }, [profile, user, reload])

  const handleAvatarChange = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setUploadingAvatar(true)
    setAvatarNotice('')
    try {
      const url = await profileService.uploadAvatar(user.id, file)
      await saveProfile({ avatar_url: url })
      const outcome = await profileService.checkMyMedia()
      if ((outcome.results || []).some((item) => item.kind === 'avatar' && item.status === 'flagged')) {
        await reload()
        setAvatarNotice('Pravilo #1: slika je uklonjena jer sadrži kontakt podatke.')
      } else {
        setAvatarNotice('Profilna slika je ažurirana.')
      }
    } catch (requestError) {
      setAvatarNotice(requestError.message)
    } finally {
      setUploadingAvatar(false)
      if (avatarInputRef.current) avatarInputRef.current.value = ''
    }
  }

  const value = useMemo(() => ({ bundle, profile, isProvider, reload, saveProfile, openAvatarPicker: () => avatarInputRef.current?.click(), uploadingAvatar }), [bundle, profile, isProvider, reload, saveProfile, uploadingAvatar])

  if (loading) {
    return <div className="page-shell"><div className="account-shell"><div className="skeleton-card" /><div className="skeleton-card" /></div></div>
  }

  if (error || !profile) {
    return <div className="page-shell"><div className="empty-state"><h2>Profil nije učitan</h2><p>{error || 'Pokušaj osvježiti stranicu.'}</p></div></div>
  }

  const isSuspended = profile.account_status === 'suspended'
  const nav = ACCOUNT_NAV.filter((item) => !item.hidden && (!item.providerOnly || isProvider))

  // phones: /account is a plain menu; sub-pages get a back bar instead of the sidebar
  if (isPhone) {
    const current = ACCOUNT_NAV.find((item) => item.to === pathname)
    return (
      <AccountContext.Provider value={value}>
        <input ref={avatarInputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={handleAvatarChange} />
        {pathname === '/account' ? (
          <AccountMenu onPickAvatar={() => avatarInputRef.current?.click()} uploadingAvatar={uploadingAvatar} />
        ) : (
          <div className="ap ap-page ap-sub">
            <div className="ap-subbar">
              <button type="button" className="ap-back" onClick={() => navigate('/account')} aria-label="Nazad na nalog"><ArrowLeft size={22} /></button>
              <strong>{current?.label || 'Nalog'}</strong>
            </div>
            {isSuspended && (
              <div className="profile-suspended-banner">
                <ShieldBan size={20} />
                <div><strong>Nalog je suspendovan</strong><span>{profile.suspension_reason || 'Prekršeno je Pravilo #1.'}</span></div>
              </div>
            )}
            {avatarNotice && <small className="account-avatar-notice">{avatarNotice}</small>}
            <Outlet />
          </div>
        )}
      </AccountContext.Provider>
    )
  }

  return (
    <AccountContext.Provider value={value}>
      <div className="page-shell account-page">
        <div className="account-shell">
          <aside className="account-sidebar">
            <button type="button" className="account-avatar" onClick={() => avatarInputRef.current?.click()} disabled={uploadingAvatar} aria-label="Promijeni profilnu sliku">
              {profile.avatar_url ? <img src={profile.avatar_url} alt="" /> : <UserRound size={52} />}
              <span className="account-avatar-edit"><Camera size={14} /></span>
            </button>
            <input ref={avatarInputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={handleAvatarChange} />
            <strong className="account-name">{profile.full_name || 'Tvoj nalog'}</strong>
            <span className="account-type">{isProvider ? (profile.account_type === 'both' ? 'Klijent i izvođač' : 'Izvođač') : 'Klijent'}</span>
            {avatarNotice && <small className="account-avatar-notice">{avatarNotice}</small>}
            <nav ref={navRef} className="account-nav" aria-label="Nalog">
              {nav.map(({ to, label, icon: Icon, end, chevron }) => (
                <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'active' : '')}>
                  <Icon size={16} /> <span>{label}</span>{chevron && <ChevronRight size={16} className="account-nav-chevron" />}
                </NavLink>
              ))}
            </nav>
          </aside>

          <main className="account-main">
            {isSuspended && (
              <div className="profile-suspended-banner">
                <ShieldBan size={20} />
                <div>
                  <strong>Nalog je suspendovan</strong>
                  <span>{profile.suspension_reason || 'Prekršeno je Pravilo #1.'} {profile.suspended_until ? `Ponovo aktivan od ${formatBosnianDate(profile.suspended_until)}.` : 'Suspenzija je trajna — javi se podršci ako misliš da je greška.'}</span>
                </div>
              </div>
            )}
            {!profile.onboarding_completed && pathname === '/account/profil' && (
              <div className="profile-setup-banner">
                <Sparkles size={18} />
                <div><strong>Dobrodošao/la na Poso.ba!</strong><span>Dopuni osnovne podatke — traje minutu.</span></div>
              </div>
            )}
            <Outlet />
          </main>
        </div>
      </div>
    </AccountContext.Provider>
  )
}

export default AccountLayout
