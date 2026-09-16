import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Play, ShieldCheck, Trash2, UserRound } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { profileService } from '../services/profileService'
import { portfolioService } from '../services/portfolioService'
import { badgeService } from '../services/badgeService'
import { serviceCategories } from '../data/categories'
import MobileNav from '../components/MobileNav'
import BackHome from '../components/BackHome'

const VERIFICATION_LABELS = {
  pending: 'Zahtjev je poslan — na čekanju je pregled admina.',
  approved: 'Verifikovani ste! Značka je vidljiva na vašem javnom profilu.',
  rejected: 'Zahtjev je odbijen. Možete poslati novi dokument.',
}

function ProfilePage() {
  const navigate = useNavigate()
  const { user, logout, updateProfile, deleteAccount } = useAuth()
  const avatarInputRef = useRef(null)
  const portfolioInputRef = useRef(null)
  const verificationInputRef = useRef(null)
  const [portfolio, setPortfolio] = useState([])
  const [uploadingPortfolio, setUploadingPortfolio] = useState(false)
  const [verificationStatus, setVerificationStatus] = useState(null)
  const [verificationTrade, setVerificationTrade] = useState('')
  const [uploadingVerification, setUploadingVerification] = useState(false)
  const [form, setForm] = useState({
    fullName: user?.user_metadata?.full_name || '',
    city: user?.user_metadata?.city || '',
    phone: user?.user_metadata?.phone || '',
    bio: '',
  })
  const [avatarUrl, setAvatarUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let active = true
    profileService.getProfile(user.id)
      .then((profile) => {
        if (!active || !profile) return
        setForm({ fullName: profile.full_name || '', city: profile.city || '', phone: profile.phone || '', bio: profile.bio || '' })
        setAvatarUrl(profile.avatar_url || '')
      })
      .catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setLoading(false))
    portfolioService.listForUser(user.id).then((items) => active && setPortfolio(items))
    badgeService.myVerificationStatus(user.id).then((status) => active && setVerificationStatus(status))
    return () => { active = false }
  }, [user.id])

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  const handleAvatarChange = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setUploadingAvatar(true)
    setError('')
    try {
      const url = await profileService.uploadAvatar(user.id, file)
      await profileService.upsertProfile({ ...form, user_id: user.id, email: user.email, avatar_url: url })
      setAvatarUrl(url)
      setMessage('Profilna slika je ažurirana.')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setUploadingAvatar(false)
      if (avatarInputRef.current) avatarInputRef.current.value = ''
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const profile = await profileService.upsertProfile({ ...form, user_id: user.id, email: user.email, avatar_url: avatarUrl })
      updateProfile({ ...form, user_metadata: { ...user.user_metadata, full_name: profile.full_name, city: profile.city, phone: profile.phone } })
      setMessage('Profil je sačuvan.')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
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
    if (!window.confirm('Ovo trajno briše vaš nalog i sve lične podatke. Nastaviti?')) return
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

  return (
    <div className="page-shell page-with-mobile-nav">
      <div className="page-card">
        <BackHome />
        <h1>Profil</h1>
        {loading && <div className="page-state">Učitavanje profila...</div>}
        {!loading && (
          <>
            <div className="profile-avatar-row">
              {avatarUrl
                ? <img src={avatarUrl} alt="Profilna slika" className="public-profile-avatar" />
                : <div className="public-profile-avatar public-profile-avatar-fallback"><UserRound size={32} /></div>}
              <div>
                <button type="button" className="ghost-button" onClick={() => avatarInputRef.current?.click()} disabled={uploadingAvatar}>
                  {uploadingAvatar ? 'Učitavam...' : 'Promijeni sliku'}
                </button>
                <input ref={avatarInputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={handleAvatarChange} />
                <Link to={`/korisnik/${user.id}`} className="text-link profile-public-link">Pogledaj javni profil</Link>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="auth-form">
              <label>
                Ime i prezime
                <input name="fullName" value={form.fullName} onChange={handleChange} />
              </label>
              <label>
                Grad
                <input name="city" value={form.city} onChange={handleChange} />
              </label>
              <label>
                Telefon
                <input name="phone" value={form.phone} onChange={handleChange} />
              </label>
              <label>
                O meni
                <textarea name="bio" value={form.bio} onChange={handleChange} maxLength={1000} placeholder="Recite drugima nešto o sebi i svom iskustvu..." />
              </label>
              {error && <div className="form-error">{error}</div>}
              {message && <div className="form-success">{message}</div>}
              <button type="submit" className="primary-button" disabled={saving}>{saving ? 'Čuvam...' : 'Sačuvaj'}</button>
            </form>

            <div className="portfolio-manager">
              <div className="portfolio-manager-header">
                <h2>Portfolio</h2>
                <button type="button" className="ghost-button" onClick={() => portfolioInputRef.current?.click()} disabled={uploadingPortfolio}>
                  {uploadingPortfolio ? 'Učitavam...' : '+ Dodaj sliku/video'}
                </button>
                <input ref={portfolioInputRef} type="file" accept="image/png,image/jpeg,image/webp,video/mp4,video/webm" hidden onChange={handlePortfolioUpload} />
              </div>
              {portfolio.length === 0
                ? <p className="muted-text">Dodajte slike ili video prethodnih radova da izgradite povjerenje kod klijenata.</p>
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
            <div className="portfolio-manager">
              <div className="portfolio-manager-header">
                <h2><ShieldCheck size={18} /> Verifikacija</h2>
              </div>
              {verificationStatus ? (
                <div className={`verification-status status-${verificationStatus.status}`}>
                  {VERIFICATION_LABELS[verificationStatus.status]}
                </div>
              ) : (
                <p className="muted-text">Pošaljite dokaz o struci (diploma, uvjerenje, licenca) da na profilu dobijete oznaku verifikovanog majstora za svoju struku.</p>
              )}
              {(!verificationStatus || verificationStatus.status === 'rejected') && (
                <>
                  <label className="verify-trade-select">
                    Struka za koju se verifikuješ
                    <select value={verificationTrade} onChange={(event) => setVerificationTrade(event.target.value)}>
                      <option value="">Odaberi struku...</option>
                      {serviceCategories.map((category) => (
                        <option key={category.id} value={category.name}>{category.name}</option>
                      ))}
                    </select>
                  </label>
                  <button type="button" className="ghost-button" onClick={() => verificationInputRef.current?.click()} disabled={uploadingVerification || !verificationTrade}>
                    {uploadingVerification ? 'Šaljem...' : 'Pošalji dokaz o struci'}
                  </button>
                  <input ref={verificationInputRef} type="file" accept="image/png,image/jpeg,image/webp,application/pdf" hidden onChange={handleVerificationUpload} />
                </>
              )}
            </div>
          </>
        )}
        <div className="profile-danger-zone">
          <button type="button" className="ghost-button" onClick={async () => { await logout(); navigate('/') }}>Odjavi se</button>
          <button type="button" className="danger-button" onClick={handleDeleteAccount} disabled={deleting}>{deleting ? 'Brišem nalog...' : 'Obriši nalog'}</button>
        </div>
      </div>
      <MobileNav />
    </div>
  )
}

export default ProfilePage
