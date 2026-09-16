import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Briefcase, Camera, Check, Hammer, IdCard, Images, LogOut, Play, Repeat,
  Settings, ShieldAlert, ShieldCheck, Sparkles, Trash2, UserRound, Wrench,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { profileService } from '../services/profileService'
import { portfolioService } from '../services/portfolioService'
import { badgeService } from '../services/badgeService'
import { serviceCategories } from '../data/categories'
import BackHome from '../components/BackHome'

const TABS = [
  { id: 'podaci', label: 'Podaci', icon: IdCard },
  { id: 'usluge', label: 'Usluge', icon: Wrench },
  { id: 'portfolio', label: 'Portfolio', icon: Images },
  { id: 'verifikacija', label: 'Verifikacija', icon: ShieldCheck },
  { id: 'racun', label: 'Račun', icon: Settings },
]

const ACCOUNT_TYPES = [
  { value: 'client', label: 'Tražim majstora', hint: 'Objavljujem poslove', icon: Briefcase },
  { value: 'provider', label: 'Pružam usluge', hint: 'Šaljem ponude', icon: Hammer },
  { value: 'both', label: 'Oboje', hint: 'I jedno i drugo', icon: Repeat },
]

const VERIFICATION_LABELS = {
  pending: 'Zahtjev je poslan — admin ga pregleda.',
  approved: 'Verifikovan si! Oznaka je vidljiva na tvom javnom profilu.',
  rejected: 'Zahtjev je odbijen. Možeš poslati novi dokument.',
}

function ProfilePage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user, logout, updateProfile, deleteAccount } = useAuth()
  const avatarInputRef = useRef(null)
  const portfolioInputRef = useRef(null)
  const verificationInputRef = useRef(null)

  const [tab, setTab] = useState(TABS.some((item) => item.id === searchParams.get('tab')) ? searchParams.get('tab') : 'podaci')
  const [form, setForm] = useState({ fullName: '', city: '', phone: '', bio: '' })
  const [accountType, setAccountType] = useState('client')
  const [trades, setTrades] = useState([])
  const [verifiedTrade, setVerifiedTrade] = useState('')
  const [displayUid, setDisplayUid] = useState('')
  const [onboardingCompleted, setOnboardingCompleted] = useState(true)
  const [avatarUrl, setAvatarUrl] = useState('')
  const [portfolio, setPortfolio] = useState([])
  const [verificationStatus, setVerificationStatus] = useState(null)
  const [verificationTrade, setVerificationTrade] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [uploadingPortfolio, setUploadingPortfolio] = useState(false)
  const [uploadingVerification, setUploadingVerification] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const offersServices = accountType !== 'client'
  const isSetup = searchParams.get('setup') === '1' || !onboardingCompleted

  useEffect(() => {
    let active = true
    profileService.getProfile(user.id)
      .then((profile) => {
        if (!active || !profile) return
        setForm({ fullName: profile.full_name || '', city: profile.city || '', phone: profile.phone || '', bio: profile.bio || '' })
        setAvatarUrl(profile.avatar_url || '')
        setAccountType(profile.account_type || 'client')
        setTrades(profile.trades || [])
        setVerifiedTrade(profile.verified_trade || '')
        setDisplayUid(profile.display_uid || '')
        setOnboardingCompleted(Boolean(profile.onboarding_completed))
      })
      .catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setLoading(false))
    portfolioService.listForUser(user.id).then((items) => active && setPortfolio(items))
    badgeService.myVerificationStatus(user.id).then((status) => active && setVerificationStatus(status))
    return () => { active = false }
  }, [user.id])

  const checklist = useMemo(() => {
    const base = [
      { id: 'name', label: 'Ime i prezime', done: form.fullName.trim().length > 1, tab: 'podaci' },
      { id: 'city', label: 'Grad', done: form.city.trim().length > 1, tab: 'podaci' },
      { id: 'phone', label: 'Telefon', done: form.phone.trim().length > 5, tab: 'podaci' },
      { id: 'avatar', label: 'Profilna slika', done: Boolean(avatarUrl), tab: 'podaci' },
      { id: 'bio', label: 'Kratki opis o sebi', done: form.bio.trim().length >= 20, tab: 'podaci' },
    ]
    if (!offersServices) return base
    return [
      ...base,
      { id: 'trades', label: 'Odabrana struka', done: trades.length > 0, tab: 'usluge' },
      { id: 'portfolio', label: 'Bar jedan rad u portfoliju', done: portfolio.length > 0, tab: 'portfolio' },
      { id: 'verified', label: 'Verifikacija struke', done: verificationStatus?.status === 'approved', tab: 'verifikacija' },
    ]
  }, [form, avatarUrl, offersServices, trades, portfolio, verificationStatus])

  const completion = Math.round((checklist.filter((item) => item.done).length / checklist.length) * 100)
  const missing = checklist.filter((item) => !item.done)

  const openTab = (id) => {
    setTab(id)
    setMessage('')
    setError('')
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      next.set('tab', id)
      return next
    }, { replace: true })
  }

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  const toggleTrade = (name) => {
    setTrades((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name])
  }

  const persist = async (overrides = {}) => {
    const profile = await profileService.upsertProfile({
      ...form,
      user_id: user.id,
      email: user.email,
      avatar_url: avatarUrl,
      account_type: accountType,
      trades,
      ...overrides,
    })
    updateProfile({ user_metadata: { ...user.user_metadata, full_name: profile.full_name, city: profile.city, phone: profile.phone } })
    setOnboardingCompleted(true)
    return profile
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')
    try {
      await persist()
      setMessage('Profil je sačuvan.')
      if (searchParams.get('setup') === '1') {
        setSearchParams((current) => { const next = new URLSearchParams(current); next.delete('setup'); return next }, { replace: true })
      }
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  const handleAvatarChange = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setUploadingAvatar(true)
    setError('')
    try {
      const url = await profileService.uploadAvatar(user.id, file)
      await persist({ avatar_url: url })
      setAvatarUrl(url)
      setMessage('Profilna slika je ažurirana.')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setUploadingAvatar(false)
      if (avatarInputRef.current) avatarInputRef.current.value = ''
    }
  }

  const handlePortfolioUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setUploadingPortfolio(true)
    setError('')
    try {
      const item = await portfolioService.upload(user.id, file)
      setPortfolio((current) => [item, ...current])
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setUploadingPortfolio(false)
      if (portfolioInputRef.current) portfolioInputRef.current.value = ''
    }
  }

  const handlePortfolioRemove = async (itemId) => {
    try {
      await portfolioService.remove(itemId)
      setPortfolio((current) => current.filter((item) => item.id !== itemId))
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const handleVerificationUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setUploadingVerification(true)
    setError('')
    try {
      const documentUrl = await badgeService.uploadVerificationDocument(user.id, file)
      const request = await badgeService.requestVerification({ userId: user.id, documentUrl, trade: verificationTrade })
      setVerificationStatus({ status: request.status, created_at: new Date().toISOString() })
      setMessage('Zahtjev za verifikaciju je poslan.')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setUploadingVerification(false)
      if (verificationInputRef.current) verificationInputRef.current.value = ''
    }
  }

  const handleDeleteAccount = async () => {
    if (!window.confirm('Ovo trajno briše tvoj nalog i sve lične podatke. Nastaviti?')) return
    setDeleting(true)
    setError('')
    try {
      await deleteAccount()
      navigate('/')
    } catch (requestError) {
      setError(requestError.message)
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="page-shell page-with-mobile-nav">
        <div className="profile-shell"><div className="skeleton-card" /><div className="skeleton-card" /></div>
      </div>
    )
  }

  return (
    <div className="page-shell page-with-mobile-nav">
      <div className="profile-shell">
        <BackHome />

        {isSetup && (
          <div className="profile-setup-banner reveal reveal-visible">
            <Sparkles size={18} />
            <div>
              <strong>Dobrodošao/la na Poso.ba!</strong>
              <span>Dopuni osnovne podatke da klijenti i izvođači znaju s kim rade. Traje minutu.</span>
            </div>
          </div>
        )}

        <section className="profile-hero">
          <button type="button" className="profile-hero-avatar" onClick={() => avatarInputRef.current?.click()} disabled={uploadingAvatar} aria-label="Promijeni profilnu sliku">
            {avatarUrl
              ? <img src={avatarUrl} alt="" />
              : <UserRound size={40} />}
            <span className="profile-hero-avatar-edit"><Camera size={14} /></span>
          </button>
          <input ref={avatarInputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={handleAvatarChange} />

          <div className="profile-hero-info">
            <h1>{form.fullName.trim() || 'Tvoj profil'}</h1>
            <div className="profile-hero-chips">
              {displayUid && <span className="uid-chip">{displayUid}</span>}
              {offersServices && (
                verifiedTrade
                  ? <span className="verify-banner verified"><ShieldCheck size={14} /> Verifikovan — {verifiedTrade}</span>
                  : <span className="verify-banner unverified"><ShieldAlert size={14} /> Nije verifikovan</span>
              )}
            </div>
            <Link to={`/korisnik/${user.id}`} className="profile-public-link">Pogledaj kako te drugi vide →</Link>
          </div>

          <div className="profile-hero-progress" style={{ '--completion': `${completion}%` }}>
            <div className="profile-progress-ring"><span>{completion}%</span></div>
            <small>Profil popunjen</small>
          </div>
        </section>

        {missing.length > 0 && (
          <div className="profile-checklist">
            <span className="profile-checklist-title">Šta još nedostaje</span>
            <div className="profile-checklist-items">
              {missing.map((item) => (
                <button key={item.id} type="button" onClick={() => openTab(item.tab)}>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <nav className="profile-tabs" aria-label="Sekcije profila">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" className={`profile-tab ${tab === id ? 'active' : ''}`} onClick={() => openTab(id)} aria-pressed={tab === id}>
              <Icon size={16} /> {label}
            </button>
          ))}
        </nav>

        {error && <div className="form-error">{error}</div>}
        {message && <div className="form-success">{message}</div>}

        <section className="profile-panel" key={tab}>
          {tab === 'podaci' && (
            <form onSubmit={handleSubmit} className="auth-form">
              <div className="field">
                <input id="fullName" name="fullName" placeholder=" " value={form.fullName} onChange={handleChange} required />
                <label htmlFor="fullName">Ime i prezime</label>
              </div>
              <div className="field-row">
                <div className="field">
                  <input id="city" name="city" placeholder=" " value={form.city} onChange={handleChange} />
                  <label htmlFor="city">Grad</label>
                </div>
                <div className="field">
                  <input id="phone" name="phone" placeholder=" " value={form.phone} onChange={handleChange} />
                  <label htmlFor="phone">Telefon</label>
                </div>
              </div>
              <div className="field field-textarea">
                <textarea id="bio" name="bio" placeholder=" " value={form.bio} onChange={handleChange} maxLength={1000} rows={4} />
                <label htmlFor="bio">O meni</label>
                <small>{form.bio.length}/1000 — reci drugima ko si i šta radiš.</small>
              </div>
              <button type="submit" className="primary-button auth-submit" disabled={saving}>{saving ? 'Čuvam...' : 'Sačuvaj podatke'}</button>
            </form>
          )}

          {tab === 'usluge' && (
            <form onSubmit={handleSubmit} className="auth-form">
              <fieldset className="account-type-picker">
                <legend>Kako koristiš Poso.ba?</legend>
                {ACCOUNT_TYPES.map(({ value, label, hint, icon: Icon }) => (
                  <button key={value} type="button" className={`account-type-card ${accountType === value ? 'active' : ''}`} onClick={() => setAccountType(value)} aria-pressed={accountType === value}>
                    <Icon size={20} />
                    <strong>{label}</strong>
                    <span>{hint}</span>
                  </button>
                ))}
              </fieldset>

              {offersServices ? (
                <div className="trade-picker">
                  <span className="trade-picker-label">Tvoje struke <small>(možeš više)</small></span>
                  <div className="trade-chips">
                    {serviceCategories.map(({ id, name }) => (
                      <button key={id} type="button" className={`trade-chip ${trades.includes(name) ? 'active' : ''}`} onClick={() => toggleTrade(name)} aria-pressed={trades.includes(name)}>
                        {name}{verifiedTrade === name && <Check size={12} />}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="muted-text">Ako želiš i nuditi usluge, izaberi "Pružam usluge" ili "Oboje" i otvorit će se izbor struka.</p>
              )}
              <button type="submit" className="primary-button auth-submit" disabled={saving}>{saving ? 'Čuvam...' : 'Sačuvaj usluge'}</button>
            </form>
          )}

          {tab === 'portfolio' && (
            <div className="portfolio-manager">
              <div className="portfolio-manager-header">
                <div>
                  <h2>Portfolio</h2>
                  <p className="muted-text">Slike i video prethodnih radova — najjači dokaz klijentima.</p>
                </div>
                <button type="button" className="primary-button" onClick={() => portfolioInputRef.current?.click()} disabled={uploadingPortfolio}>
                  {uploadingPortfolio ? 'Učitavam...' : '+ Dodaj'}
                </button>
                <input ref={portfolioInputRef} type="file" accept="image/png,image/jpeg,image/webp,video/mp4,video/webm" hidden onChange={handlePortfolioUpload} />
              </div>
              {portfolio.length === 0
                ? (
                  <button type="button" className="portfolio-empty" onClick={() => portfolioInputRef.current?.click()}>
                    <Images size={28} />
                    <strong>Još nema radova</strong>
                    <span>Klikni da dodaš prvu sliku ili video</span>
                  </button>
                )
                : (
                  <div className="portfolio-grid">
                    {portfolio.map((item) => (
                      <div className="portfolio-item" key={item.id}>
                        {item.media_type === 'video'
                          ? <div className="portfolio-video-thumb"><Play size={22} /></div>
                          : <img src={item.media_url} alt={item.caption || ''} loading="lazy" />}
                        <button type="button" className="portfolio-remove" onClick={() => handlePortfolioRemove(item.id)} aria-label="Ukloni"><Trash2 size={14} /></button>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          )}

          {tab === 'verifikacija' && (
            <div className="portfolio-manager">
              <div className="portfolio-manager-header">
                <div>
                  <h2>Verifikacija struke</h2>
                  <p className="muted-text">Pošalji diplomu, uvjerenje ili licencu. Nakon pregleda na profilu dobiješ oznaku verifikovanog majstora.</p>
                </div>
              </div>
              {verificationStatus && (
                <div className={`verification-status status-${verificationStatus.status}`}>
                  {VERIFICATION_LABELS[verificationStatus.status]}
                </div>
              )}
              {(!verificationStatus || verificationStatus.status === 'rejected') && (
                <>
                  <label className="verify-trade-select">
                    Struka za koju se verifikuješ
                    <select value={verificationTrade} onChange={(event) => setVerificationTrade(event.target.value)}>
                      <option value="">Odaberi struku...</option>
                      {(trades.length > 0 ? serviceCategories.filter((category) => trades.includes(category.name)) : serviceCategories).map((category) => (
                        <option key={category.id} value={category.name}>{category.name}</option>
                      ))}
                    </select>
                  </label>
                  <button type="button" className="primary-button" onClick={() => verificationInputRef.current?.click()} disabled={uploadingVerification || !verificationTrade}>
                    {uploadingVerification ? 'Šaljem...' : 'Pošalji dokaz o struci'}
                  </button>
                  <input ref={verificationInputRef} type="file" accept="image/png,image/jpeg,image/webp,application/pdf" hidden onChange={handleVerificationUpload} />
                </>
              )}
            </div>
          )}

          {tab === 'racun' && (
            <div className="profile-account">
              <div className="profile-account-row">
                <div>
                  <strong>Email</strong>
                  <span>{user.email}</span>
                </div>
              </div>
              <div className="profile-account-row">
                <div>
                  <strong>Odjava</strong>
                  <span>Odjavi se sa ovog uređaja.</span>
                </div>
                <button type="button" className="ghost-button" onClick={async () => { await logout(); navigate('/') }}><LogOut size={15} /> Odjavi se</button>
              </div>
              <div className="profile-account-row danger">
                <div>
                  <strong>Brisanje naloga</strong>
                  <span>Trajno briše nalog, oglase, ponude i poruke. Nema povratka.</span>
                </div>
                <button type="button" className="danger-button" onClick={handleDeleteAccount} disabled={deleting}>
                  <Trash2 size={15} /> {deleting ? 'Brišem...' : 'Obriši nalog'}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

export default ProfilePage
