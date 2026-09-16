import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Briefcase, Camera, Check, Copy, Eye, EyeOff, Hammer, IdCard, Images, LogOut, OctagonAlert, Play, Repeat,
  Settings, ShieldAlert, ShieldBan, ShieldCheck, Sparkles, Star, Trash2, UserRound, Wrench,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { isValidFullName, profileService } from '../services/profileService'
import { portfolioService } from '../services/portfolioService'
import { badgeService } from '../services/badgeService'
import { serviceCategories } from '../data/categories'
import { contactInfoMessage, scanContactInfo } from '../utils/moderation'
import { formatBosnianDate } from '../utils/dateFormat'
import BackHome from '../components/BackHome'
import BadgeChip from '../components/BadgeChip'
import RuleOneNotice from '../components/RuleOneNotice'

const ALL_TABS = {
  podaci: { id: 'podaci', label: 'Podaci', icon: IdCard },
  usluge: { id: 'usluge', label: 'Usluge', icon: Wrench },
  tip: { id: 'usluge', label: 'Tip naloga', icon: Briefcase },
  portfolio: { id: 'portfolio', label: 'Portfolio', icon: Images },
  verifikacija: { id: 'verifikacija', label: 'Verifikacija', icon: ShieldCheck },
  racun: { id: 'racun', label: 'Račun', icon: Settings },
}

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

const EVENT_LABEL = {
  masked: 'Uklonjen kontakt iz teksta',
  removed: 'Uklonjena slika sa kontaktom',
  flagged: 'Označeno za pregled',
  suspended: 'Nalog suspendovan',
  lifted: 'Suspenzija ukinuta',
}

const displayNameOf = (fullName) => {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'Korisnik Poso.ba'
  const first = parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase()
  if (parts.length === 1) return first
  return `${first} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`
}

function ProfilePage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user, logout, updateProfile, deleteAccount } = useAuth()
  const avatarInputRef = useRef(null)
  const portfolioInputRef = useRef(null)
  const verificationInputRef = useRef(null)

  const [tab, setTab] = useState(['podaci', 'usluge', 'portfolio', 'verifikacija', 'racun'].includes(searchParams.get('tab')) ? searchParams.get('tab') : 'podaci')
  const [form, setForm] = useState({ fullName: '', city: '', phone: '', bio: '' })
  const [accountType, setAccountType] = useState('client')
  const [trades, setTrades] = useState([])
  const [account, setAccount] = useState(null) // system fields: member_id, account_status, verified_trade, …
  const [avatarUrl, setAvatarUrl] = useState('')
  const [portfolio, setPortfolio] = useState([])
  const [badges, setBadges] = useState([])
  const [trust, setTrust] = useState(null)
  const [strikes, setStrikes] = useState(0)
  const [events, setEvents] = useState([])
  const [verificationStatus, setVerificationStatus] = useState(null)
  const [verificationTrade, setVerificationTrade] = useState('')
  const [showId, setShowId] = useState(false)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [uploadingPortfolio, setUploadingPortfolio] = useState(false)
  const [uploadingVerification, setUploadingVerification] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const offersServices = accountType !== 'client'
  const onboardingCompleted = Boolean(account?.onboarding_completed)
  const isSetup = searchParams.get('setup') === '1' || (account && !onboardingCompleted)
  const isSuspended = account?.account_status === 'suspended'

  const load = async () => {
    const bundle = await profileService.getMyBundle()
    const profile = bundle?.profile
    if (!profile) return
    setForm({ fullName: profile.full_name || '', city: profile.city || '', phone: profile.phone || '', bio: profile.bio || '' })
    setAvatarUrl(profile.avatar_url || '')
    setAccountType(profile.account_type || 'client')
    setTrades(profile.trades || [])
    setAccount(profile)
    setPortfolio(bundle.portfolio || [])
    setBadges(bundle.badges || [])
    setTrust(bundle.trust || null)
    setStrikes(bundle.strikes || 0)
    setEvents(bundle.events || [])
    setVerificationStatus(bundle.verification || null)
  }

  useEffect(() => {
    let active = true
    load()
      .catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setLoading(false))
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id])

  const tabs = useMemo(() => (
    offersServices
      ? [ALL_TABS.podaci, ALL_TABS.usluge, ALL_TABS.portfolio, ALL_TABS.verifikacija, ALL_TABS.racun]
      : [ALL_TABS.podaci, ALL_TABS.tip, ALL_TABS.racun]
  ), [offersServices])

  const checklist = useMemo(() => {
    const base = [
      { id: 'name', label: 'Pravo ime i prezime', done: isValidFullName(form.fullName), tab: 'podaci' },
      { id: 'city', label: 'Grad', done: form.city.trim().length > 1, tab: 'podaci' },
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

  const nameOk = form.fullName.trim() === '' || isValidFullName(form.fullName)
  const bioScan = useMemo(() => scanContactInfo(form.bio), [form.bio])
  const nameScan = useMemo(() => scanContactInfo(form.fullName), [form.fullName])

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
    setAccount((current) => ({ ...(current || {}), ...profile }))
    // the server may have masked something — reflect it
    setForm((current) => ({ ...current, fullName: profile.full_name || current.fullName, bio: profile.bio ?? current.bio }))
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

  // Ask the AI moderator about freshly uploaded images; returns the flagged results.
  const moderateMedia = async () => {
    const outcome = await profileService.checkMyMedia()
    return (outcome.results || []).filter((item) => item.status === 'flagged')
  }

  const handleAvatarChange = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setUploadingAvatar(true)
    setError('')
    setMessage('')
    try {
      const url = await profileService.uploadAvatar(user.id, file)
      await persist({ avatar_url: url })
      setAvatarUrl(url)
      const flagged = await moderateMedia()
      if (flagged.some((item) => item.kind === 'avatar')) {
        setAvatarUrl('')
        setStrikes((current) => current + 1)
        setError(`Pravilo #1: slika je uklonjena jer sadrži kontakt podatke${flagged[0].reason ? ` (${flagged[0].reason})` : ''}. Broj telefona, društvene mreže ili linkovi nisu dozvoljeni ni na slikama.`)
      } else {
        setMessage('Profilna slika je ažurirana.')
      }
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
    setMessage('')
    try {
      const item = await portfolioService.upload(user.id, file)
      setPortfolio((current) => [item, ...current])
      const flagged = await moderateMedia()
      if (flagged.some((entry) => entry.kind === 'portfolio')) {
        setPortfolio((current) => current.filter((entry) => entry.id !== item.id))
        setStrikes((current) => current + 1)
        setError('Pravilo #1: rad je uklonjen jer slika sadrži kontakt podatke (broj, društvenu mrežu ili link).')
      }
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

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(account.member_id)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      /* clipboard unavailable — the ID is still visible */
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

        {isSuspended && (
          <div className="profile-suspended-banner">
            <ShieldBan size={20} />
            <div>
              <strong>Nalog je suspendovan</strong>
              <span>
                {account.suspension_reason || 'Prekršeno je Pravilo #1.'}{' '}
                {account.suspended_until ? `Ponovo aktivan od ${formatBosnianDate(account.suspended_until)}.` : 'Suspenzija je trajna — javi se podršci ako misliš da je greška.'}
              </span>
            </div>
          </div>
        )}

        {isSetup && !isSuspended && (
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
            {avatarUrl ? <img src={avatarUrl} alt="" /> : <UserRound size={40} />}
            <span className="profile-hero-avatar-edit"><Camera size={14} /></span>
          </button>
          <input ref={avatarInputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={handleAvatarChange} />

          <div className="profile-hero-info">
            <h1>{form.fullName.trim() || 'Tvoj profil'}</h1>
            <p className="profile-public-name">Javno te drugi vide kao <strong>{displayNameOf(form.fullName)}</strong> — prezime ostaje samo tebi.</p>
            <div className="profile-hero-chips">
              <span className="profile-type-chip">{offersServices ? (accountType === 'both' ? 'Klijent + izvođač' : 'Izvođač') : 'Klijent'}</span>
              {offersServices && (
                account?.verified_trade
                  ? <span className="verify-banner verified"><ShieldCheck size={14} /> Verifikovan — {account.verified_trade}</span>
                  : <span className="verify-banner unverified"><ShieldAlert size={14} /> Nije verifikovan</span>
              )}
              {badges.map((badge) => <BadgeChip key={badge.code} badge={badge} />)}
            </div>
            <Link to={`/korisnik/${user.id}`} className="profile-public-link">Pogledaj kako te drugi vide →</Link>
          </div>

          <div className="profile-hero-progress" style={{ '--completion': `${completion}%` }}>
            <div className="profile-progress-ring"><span>{completion}%</span></div>
            <small>Profil popunjen</small>
          </div>
        </section>

        <div className="profile-side-cards">
          <div className="member-id-card">
            <div className="member-id-head">
              <IdCard size={16} />
              <strong>Tvoj privatni ID</strong>
            </div>
            <code className="member-id-value">{showId ? account?.member_id : 'PB-••••-••••'}</code>
            <div className="member-id-actions">
              <button type="button" className="ghost-button" onClick={() => setShowId((open) => !open)}>
                {showId ? <EyeOff size={14} /> : <Eye size={14} />} {showId ? 'Sakrij' : 'Prikaži'}
              </button>
              <button type="button" className="ghost-button" onClick={copyId} disabled={!showId}>
                {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Kopirano' : 'Kopiraj'}
              </button>
            </div>
            <small>Vidiš ga samo ti i podrška Poso.ba. Ne dijeli ga — koristi se za potvrdu identiteta kad kontaktiraš podršku.</small>
          </div>

          {trust && (
            <div className="profile-stats-card">
              {offersServices ? (
                <>
                  <div><strong>{trust.success_rate == null ? '—' : `${Math.round(trust.success_rate)}%`}</strong><span>uspješnost</span></div>
                  <div><strong>{trust.completed_jobs || 0}</strong><span>završenih poslova</span></div>
                  <div><strong>{trust.review_count > 0 ? Number(trust.avg_rating).toFixed(1) : '—'}</strong><span><Star size={12} /> prosjek</span></div>
                </>
              ) : (
                <>
                  <div><strong>{trust.jobs_posted || 0}</strong><span>objavljenih poslova</span></div>
                  <div><strong>{trust.jobs_completed_as_client || 0}</strong><span>završenih</span></div>
                  <div><strong>{trust.client_completion_rate == null ? '—' : `${Math.round(trust.client_completion_rate)}%`}</strong><span>dovršeno</span></div>
                </>
              )}
            </div>
          )}
        </div>

        {strikes > 0 && !isSuspended && (
          <div className="profile-strike-banner">
            <OctagonAlert size={18} />
            <div>
              <strong>Upozorenje: {strikes}/3 kršenja Pravila #1 u zadnjih 30 dana</strong>
              <span>Kod trećeg nalog se automatski suspenduje na 7 dana. Kontakti i društvene mreže se ne dijele na platformi — ni u tekstu ni na slikama.</span>
            </div>
          </div>
        )}

        {missing.length > 0 && (
          <div className="profile-checklist">
            <span className="profile-checklist-title">Šta još nedostaje</span>
            <div className="profile-checklist-items">
              {missing.map((item) => (
                <button key={item.id} type="button" onClick={() => openTab(item.tab)}>{item.label}</button>
              ))}
            </div>
          </div>
        )}

        <nav className="profile-tabs" aria-label="Sekcije profila">
          {tabs.map(({ id, label, icon: Icon }) => (
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
              <div className={`field ${!nameOk || !nameScan.clean ? 'field-invalid' : ''}`}>
                <input id="fullName" name="fullName" placeholder=" " value={form.fullName} onChange={handleChange} required autoComplete="name" />
                <label htmlFor="fullName">Ime i prezime</label>
                <small>{!nameOk ? 'Pravo ime i prezime, samo slova — npr. "Bilal Ishak".' : 'Javno se prikazuje samo ime i inicijal prezimena.'}</small>
              </div>
              <div className="field-row">
                <div className="field">
                  <input id="city" name="city" placeholder=" " value={form.city} onChange={handleChange} autoComplete="address-level2" />
                  <label htmlFor="city">Grad</label>
                </div>
                <div className="field">
                  <input id="phone" name="phone" placeholder=" " value={form.phone} onChange={handleChange} autoComplete="tel" />
                  <label htmlFor="phone">Telefon (privatno)</label>
                  <small>Nikad se ne prikazuje javno; dijeli se samo kroz poruke nakon prihvaćene ponude.</small>
                </div>
              </div>
              <div className={`field field-textarea ${!bioScan.clean ? 'field-invalid' : ''}`}>
                <textarea id="bio" name="bio" placeholder=" " value={form.bio} onChange={handleChange} maxLength={1000} rows={4} />
                <label htmlFor="bio">O meni</label>
                <small>{!bioScan.clean ? contactInfoMessage(bioScan, 'opis') : `${form.bio.length}/1000 — reci drugima ko si i šta radiš.`}</small>
              </div>
              <RuleOneNotice compact />
              <button type="submit" className="primary-button auth-submit" disabled={saving || !nameOk || !bioScan.clean || !nameScan.clean}>{saving ? 'Čuvam...' : 'Sačuvaj podatke'}</button>
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
                        {name}{account?.verified_trade === name && <Check size={12} />}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="muted-text">Klijentski profil je jednostavniji: bez struka, portfolija i verifikacije. Ako želiš i nuditi usluge, izaberi "Pružam usluge" ili "Oboje".</p>
              )}
              <button type="submit" className="primary-button auth-submit" disabled={saving}>{saving ? 'Čuvam...' : 'Sačuvaj'}</button>
            </form>
          )}

          {tab === 'portfolio' && (
            <div className="portfolio-manager">
              <div className="portfolio-manager-header">
                <div>
                  <h2>Portfolio</h2>
                  <p className="muted-text">Slike i video prethodnih radova — najjači dokaz klijentima. Slike sa brojem telefona ili društvenim mrežama se automatski uklanjaju.</p>
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
                  <strong>Pravilo #1 — istorija</strong>
                  <span>{events.length === 0 ? 'Nema zabilježenih kršenja. Tako i treba.' : `${strikes} aktivnih u zadnjih 30 dana.`}</span>
                  {events.length > 0 && (
                    <ul className="moderation-history">
                      {events.map((event) => (
                        <li key={event.id}>
                          <span className={`tag tag-${event.action}`}>{EVENT_LABEL[event.action] || event.action}</span>
                          <span>{formatBosnianDate(event.created_at)}</span>
                          {event.snippet && <em>{event.snippet}</em>}
                        </li>
                      ))}
                    </ul>
                  )}
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
