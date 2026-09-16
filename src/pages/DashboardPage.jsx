import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, MapPin, Pencil, Plus, ShieldBan, Sparkles, Trash2, Users } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { listingService } from '../services/listingService'
import { matchService } from '../services/matchService'
import { profileService } from '../services/profileService'
import BackHome from '../components/BackHome'
import { formatBosnianDate } from '../utils/dateFormat'

const STATUS_LABELS = {
  published: 'Objavljen',
  draft: 'Nacrt',
  paused: 'Pauziran',
  closed: 'Zatvoren',
  archived: 'Uklonjen',
}

function DashboardPage() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [recommended, setRecommended] = useState([])
  const [recommendedLoading, setRecommendedLoading] = useState(true)
  const [suspension, setSuspension] = useState(null)

  const loadListings = () => {
    setLoading(true)
    setError('')
    listingService.listAll({ status: 'published', pageSize: 50, ownerId: user.id })
      .then((result) => setListings(result.data || []))
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadListings() }, [])

  useEffect(() => {
    let active = true
    profileService.getProfile(user.id).then((profile) => {
      if (!active || !profile) return
      if (!profile.onboarding_completed) navigate('/profile?setup=1', { replace: true })
      setSuspension(profile.account_status === 'suspended' ? { reason: profile.suspension_reason, until: profile.suspended_until } : null)
    }).catch(() => {})
    return () => { active = false }
  }, [user.id, navigate])

  useEffect(() => {
    let active = true
    matchService.recommendedListings(6)
      .then((rows) => active && setRecommended(rows))
      .finally(() => active && setRecommendedLoading(false))
    return () => { active = false }
  }, [])

  const deleteListing = async (listing) => {
    if (!window.confirm(`Obrisati oglas "${listing.title}"?`)) return
    setDeletingId(listing.id)
    setError('')
    try {
      await listingService.deleteListing(listing.id)
      setMessage('Oglas je obrisan.')
      setListings((current) => current.filter((item) => item.id !== listing.id))
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setDeletingId('')
    }
  }

  return (
    <div className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <h2>Poso.ba</h2>
        <nav>
          <Link to="/dashboard">Moji poslovi</Link>
          <Link to="/objavi">Objavi posao</Link>
          <Link to="/search">Pretraži oglase</Link>
          <Link to={`/korisnik/${user.id}`}>Moj javni profil</Link>
          <Link to="/profile">Postavke profila</Link>
          <Link to="/">Početna</Link>
          <button type="button" className="ghost-button" onClick={async () => { await logout(); navigate('/') }}>Odjava</button>
        </nav>
      </aside>

      <main className="dashboard-main">
        <BackHome />
        <div className="dashboard-topline">
          <div>
            <span className="eyebrow small-eyebrow">Nadzorna ploča</span>
            <h1>Dobrodošli, {user?.user_metadata?.full_name || user?.email}</h1>
          </div>
          <button type="button" className="primary-button" onClick={() => navigate('/objavi')}>
            <Plus size={18} /> Objavi posao
          </button>
        </div>
        {suspension && (
          <div className="profile-suspended-banner">
            <ShieldBan size={20} />
            <div>
              <strong>Nalog je suspendovan — objave, ponude i poruke su privremeno onemogućene.</strong>
              <span>{suspension.reason || 'Prekršeno je Pravilo #1.'} {suspension.until ? `Ponovo aktivan od ${formatBosnianDate(suspension.until)}.` : 'Javi se podršci ako misliš da je greška.'}</span>
            </div>
          </div>
        )}

        <div className="dashboard-grid">
          <div className="stat-card"><strong>{listings.length}</strong><span>Objavljeni poslovi</span></div>
          <div className="stat-card"><strong>{listings.reduce((sum, item) => sum + (item.bids?.[0]?.count || 0), 0)}</strong><span>Primljene ponude</span></div>
          <div className="stat-card"><strong>{listings.filter((item) => item.status === 'published').length}</strong><span>Aktivni oglasi</span></div>
        </div>

        {message && <div className="form-success">{message}</div>}
        {error && <div className="form-error">{error}</div>}

        {!recommendedLoading && recommended.length > 0 && (
          <section className="dashboard-section">
            <div className="rec-heading">
              <h2>Preporučeno za tebe</h2>
              <p>Poslovi odabrani prema tvom gradu, iskustvu i konkurenciji.</p>
            </div>
            <div className="rec-grid">
              {recommended.map((item) => (
                <Link className="rec-card" key={item.id} to={`/listings/${item.id}`}>
                  <div className="rec-card-top">
                    <span className="tag">{item.category}</span>
                    <span className="rec-score" title="Koliko posao odgovara tebi">
                      <Sparkles size={13} /> {Math.round(item.match_score)}
                    </span>
                  </div>
                  <h3>{item.title}</h3>
                  <div className="rec-card-meta">
                    <span><MapPin size={14} /> {item.location || 'Bez lokacije'}</span>
                    <strong>{item.price == null ? 'Po dogovoru' : `${Number(item.price).toLocaleString('bs-BA')} KM`}</strong>
                  </div>
                  {item.reasons?.length > 0 && (
                    <ul className="rec-reasons">
                      {item.reasons.slice(0, 3).map((reason) => <li key={reason}>{reason}</li>)}
                    </ul>
                  )}
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="dashboard-section">
          <h2>Moji oglasi</h2>
          {loading && <div className="skeleton-list">{[1, 2].map((item) => <div className="skeleton-card" key={item} />)}</div>}

          {!loading && listings.length === 0 && (
            <div className="empty-state dashboard-empty">
              <Plus size={38} />
              <h3>Još nemate objavljenih poslova</h3>
              <p>Objavite prvi posao i za par minuta počnite primati ponude od izvođača.</p>
              <button type="button" className="primary-button" onClick={() => navigate('/objavi')}>Objavi prvi posao</button>
            </div>
          )}

          {!loading && listings.map((listing) => (
            <article className="dashboard-listing" key={listing.id}>
              <div className="dashboard-listing-main">
                <span className={`status-pill status-${listing.status}`}>{STATUS_LABELS[listing.status] || listing.status}</span>
                <h3><Link to={`/listings/${listing.id}`}>{listing.title}</Link></h3>
                <div className="dashboard-listing-meta">
                  <span><MapPin size={14} /> {listing.location || 'Bez lokacije'}</span>
                  <span><Users size={14} /> {listing.bids?.[0]?.count || 0} ponuda</span>
                  <span>{formatBosnianDate(listing.created_at)}</span>
                </div>
              </div>
              <div className="dashboard-listing-actions">
                <strong>{listing.price == null ? 'Po dogovoru' : `${Number(listing.price).toLocaleString('bs-BA')} KM`}</strong>
                <div className="dashboard-listing-buttons">
                  <Link className="ghost-button" to={`/listings/${listing.id}`}><Eye size={15} /> Pogledaj</Link>
                  <Link className="ghost-button" to={`/objavi?edit=${listing.id}`}><Pencil size={15} /> Uredi</Link>
                  <button type="button" className="danger-button" disabled={deletingId === listing.id} onClick={() => deleteListing(listing)}>
                    <Trash2 size={15} /> {deletingId === listing.id ? 'Brišem...' : 'Obriši'}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </section>
      </main>
    </div>
  )
}

export default DashboardPage
