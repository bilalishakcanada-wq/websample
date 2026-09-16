import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Briefcase, CheckCircle2, ClipboardList, Flag, MapPin, MessageSquareQuote, Percent, Play, ShieldCheck, Star, UserRound } from 'lucide-react'
import { profileService } from '../services/profileService'
import { reportService } from '../services/reportService'
import { useAuth } from '../context/AuthContext'
import TrustBadge, { LastSeen } from '../components/TrustBadge'
import BadgeChip from '../components/BadgeChip'
import BackHome from '../components/BackHome'
import { formatBosnianDate, formatBosnianMonthYear } from '../utils/dateFormat'

const formatPrice = (value, currency = 'BAM') => value == null ? 'Po dogovoru' : `${Number(value).toLocaleString('bs-BA')} ${currency === 'BAM' ? 'KM' : currency}`

const firstNameOf = (displayName) => (displayName || '').trim().split(/\s+/)[0] || 'korisnik'

function Stars({ value }) {
  const rounded = Math.round(Number(value) || 0)
  return (
    <span className="stars" aria-label={`${value} od 5`}>
      {[1, 2, 3, 4, 5].map((n) => <Star key={n} size={14} fill={n <= rounded ? 'currentColor' : 'none'} />)}
    </span>
  )
}

function SuccessRing({ value, label, hint }) {
  const pct = value == null ? 0 : Math.round(Number(value))
  return (
    <div className={`success-ring ${value == null ? 'empty' : pct >= 90 ? 'great' : pct >= 70 ? 'good' : 'low'}`} style={{ '--pct': `${pct}%` }}>
      <div className="success-ring-dial"><span>{value == null ? '—' : `${pct}%`}</span></div>
      <div>
        <strong>{label}</strong>
        <small>{hint}</small>
      </div>
    </div>
  )
}

function PublicProfilePage() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [bundle, setBundle] = useState(null)
  const [showAllReviews, setShowAllReviews] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    profileService.getPublicBundle(userId)
      .then((data) => active && setBundle(data))
      .catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [userId])

  if (loading) {
    return (
      <div className="app-shell page-with-mobile-nav">
        <main className="content-container"><div className="skeleton-card" /><div className="skeleton-card" /></main>
      </div>
    )
  }

  if (error || !bundle?.profile) {
    return (
      <div className="app-shell page-with-mobile-nav">
        <main className="content-container empty-state">
          <UserRound size={42} />
          <h2>Profil nije pronađen</h2>
          <p>{error || 'Ovaj profil ne postoji ili trenutno nije javan.'}</p>
        </main>
      </div>
    )
  }

  const { profile, trust, badges = [], reviews = [], listings = [], portfolio = [] } = bundle
  const reviewCount = bundle.review_count ?? reviews.length
  const isOwnProfile = user?.id === userId
  const isProvider = profile.account_type && profile.account_type !== 'client'
  const firstName = firstNameOf(profile.display_name)
  const visibleReviews = showAllReviews ? reviews : reviews.slice(0, 3)
  const jobsDecided = (trust?.completed_jobs || 0) + (trust?.failed_jobs || 0)

  const reportProfile = async () => {
    const reason = window.prompt('Zašto prijavljuješ ovaj profil? (npr. dijeli broj telefona, lažni identitet, prevara)')
    if (!reason) return
    try {
      await reportService.createReport({ reporterId: user.id, targetType: 'profile', targetId: userId, reason })
      setNotice('Hvala — prijava je poslana našem timu.')
    } catch (requestError) {
      setNotice(requestError.message)
    }
  }

  return (
    <div className={`app-shell page-with-mobile-nav public-profile-page ${isProvider ? 'is-provider' : 'is-client'}`}>
      <header className="app-page-header"><BackHome /></header>

      <main className="content-container public-profile-layout">
        <aside className="meet-card">
          <span className="meet-label">{isProvider ? 'Upoznaj izvođača' : 'Upoznaj klijenta'}</span>
          <div className="meet-card-top">
            <div>
              <h1>{profile.display_name}</h1>
              <LastSeen value={profile.last_seen_at} />
            </div>
            {profile.avatar_url
              ? <img className="meet-avatar" src={profile.avatar_url} alt="" />
              : <div className="meet-avatar meet-avatar-fallback"><UserRound size={44} /></div>}
          </div>

          {isProvider && trust && (
            <div className="meet-trust">
              <TrustBadge tier={trust.tier} label={trust.label} trade={trust.verified_trade} size="lg" />
              <div className="trust-meter" style={{ '--score': `${trust.score}%` }}>
                <div className="trust-meter-bar"><span /></div>
                <small>Povjerenje {trust.score}/100</small>
              </div>
              {trust.reasons?.length > 0 && (
                <ul className="trust-reasons">
                  {trust.reasons.map((reason) => <li key={reason}>{reason}</li>)}
                </ul>
              )}
            </div>
          )}

          {!isProvider && (
            <div className="meet-client-note">
              <ShieldCheck size={15} />
              <span>Klijent — objavljuje poslove i bira izvođače. Kontakt se otvara tek kad prihvati ponudu.</span>
            </div>
          )}

          <div className="meet-meta">
            {profile.city && <span><MapPin size={15} /> {profile.city}</span>}
            <span>Član od {formatBosnianMonthYear(profile.created_at)}</span>
          </div>

          {isProvider && profile.trades?.length > 0 && (
            <div className="trade-list">
              {profile.trades.map((trade) => (
                <span className="trade-tag" key={trade}>
                  {trade}{profile.verified_trade === trade && <CheckCircle2 size={12} />}
                </span>
              ))}
            </div>
          )}

          {badges.length > 0 && (
            <div className="badge-showcase">
              <span className="badge-showcase-title">Značke</span>
              <div className="badge-row">
                {badges.map((badge) => <BadgeChip key={badge.code} badge={badge} size="lg" />)}
              </div>
              <ul className="badge-legend">
                {badges.map((badge) => <li key={badge.code}><strong>{badge.label}</strong> — {badge.description}</li>)}
              </ul>
            </div>
          )}

          {profile.bio && <p className="meet-bio">{profile.bio}</p>}

          {!isOwnProfile && user && (
            <button type="button" className="meet-report" onClick={reportProfile}><Flag size={13} /> Prijavi profil</button>
          )}
          {notice && <small className="meet-notice">{notice}</small>}
        </aside>

        <section className="public-profile-main">
          {isProvider ? (
            <div className="profile-kpis">
              <SuccessRing
                value={trust?.success_rate}
                label="Uspješnost poslova"
                hint={jobsDecided === 0 ? 'Još nema završenih poslova' : `${trust.completed_jobs} završeno${trust.failed_jobs ? `, ${trust.failed_jobs} otkazano` : ''}`}
              />
              <div className="kpi-tile">
                <Briefcase size={18} />
                <strong>{trust?.completed_jobs || 0}</strong>
                <span>završenih poslova</span>
              </div>
              <div className="kpi-tile">
                <Star size={18} />
                <strong>{reviewCount > 0 ? Number(trust.avg_rating).toFixed(1) : '—'}</strong>
                <span>{reviewCount} {reviewCount === 1 ? 'recenzija' : 'recenzija'}</span>
              </div>
              <div className="kpi-tile">
                <Percent size={18} />
                <strong>{trust?.accepted_bids || 0}</strong>
                <span>prihvaćenih ponuda</span>
              </div>
            </div>
          ) : (
            <div className="profile-kpis">
              <SuccessRing
                value={trust?.client_completion_rate}
                label="Dovršeni poslovi"
                hint={trust?.jobs_completed_as_client ? `${trust.jobs_completed_as_client} dovršeno` : 'Još nema dovršenih poslova'}
              />
              <div className="kpi-tile">
                <ClipboardList size={18} />
                <strong>{trust?.jobs_posted || 0}</strong>
                <span>objavljenih poslova</span>
              </div>
              <div className="kpi-tile">
                <Star size={18} />
                <strong>{reviewCount > 0 ? Number(trust.avg_rating).toFixed(1) : '—'}</strong>
                <span>ocjena izvođača</span>
              </div>
            </div>
          )}

          <div className="review-summary-card">
            <div className="review-summary-head">
              <div>
                <h2>
                  Ukupna ocjena {reviewCount > 0 ? <strong>{Number(trust.avg_rating).toFixed(1)}</strong> : <strong>—</strong>}
                  <Star size={20} fill="currentColor" className="review-summary-star" />
                </h2>
                <span className="muted-text">{reviewCount} {reviewCount === 1 ? 'recenzija' : 'recenzija'}</span>
              </div>
            </div>

            {reviews.length === 0 ? (
              <div className="review-empty">
                <MessageSquareQuote size={26} />
                <p>{firstName} još nema recenzija. Prva recenzija dolazi nakon prvog završenog posla.</p>
              </div>
            ) : (
              <>
                <div className={`review-strip ${showAllReviews ? 'expanded' : ''}`}>
                  {visibleReviews.map((review) => (
                    <article className="review-card" key={review.id}>
                      <div className="review-card-head">
                        {review.reviewer?.avatar_url
                          ? <img src={review.reviewer.avatar_url} alt="" className="review-avatar" />
                          : <div className="review-avatar review-avatar-fallback"><UserRound size={16} /></div>}
                        <div>
                          <strong>{review.reviewer?.display_name || 'Korisnik Poso.ba'}</strong>
                          <div className="review-card-rating">
                            <Stars value={review.rating} />
                            <span>{formatBosnianDate(review.created_at)}</span>
                          </div>
                        </div>
                      </div>
                      {review.comment && <blockquote>{review.comment}</blockquote>}
                    </article>
                  ))}
                </div>
                {reviews.length > 3 && (
                  <button type="button" className="ghost-button review-see-all" onClick={() => setShowAllReviews((open) => !open)}>
                    {showAllReviews ? 'Prikaži manje' : `Pogledaj sve ${reviews.length} recenzije`}
                  </button>
                )}
              </>
            )}
          </div>

          {listings.length > 0 && (
            <div className="looking-card">
              <div>
                <h2>{firstName} traži majstora</h2>
                <p>
                  {firstName} traži pomoć za <strong>{listings[0].title}</strong>
                  {listings.length > 1 && ` i još ${listings.length - 1} ${listings.length - 1 === 1 ? 'posao' : 'posla'}`}. Jesi li ti prava osoba?
                </p>
                <div className="looking-card-actions">
                  <Link className="primary-button" to={`/listings/${listings[0].id}`}>Pogledaj posao</Link>
                  {listings.length > 1 && <a className="ghost-button" href="#aktivni-oglasi">Svi oglasi ({listings.length})</a>}
                </div>
              </div>
              <div className="looking-card-art"><Briefcase size={54} /></div>
            </div>
          )}

          {isProvider && portfolio.length > 0 && (
            <div className="portfolio-card">
              <h2>Portfolio radova</h2>
              <div className="portfolio-grid">
                {portfolio.map((item) => (
                  <div className="portfolio-item" key={item.id}>
                    {item.media_type === 'video'
                      ? <div className="portfolio-video-thumb"><Play size={22} /></div>
                      : <img src={item.media_url} alt={item.caption || ''} loading="lazy" />}
                  </div>
                ))}
              </div>
            </div>
          )}

          {listings.length > 0 && (
            <div className="profile-listings-card" id="aktivni-oglasi">
              <h2>Aktivni oglasi ({listings.length})</h2>
              <div className="profile-listing-list">
                {listings.map((listing) => (
                  <Link className="profile-listing-row" key={listing.id} to={`/listings/${listing.id}`}>
                    <div>
                      <span className="tag">{listing.category}</span>
                      <strong>{listing.title}</strong>
                      <small><MapPin size={12} /> {listing.location || 'Bez lokacije'}</small>
                    </div>
                    <b>{formatPrice(listing.price, listing.currency)}</b>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>
      </main>

      {!isOwnProfile && (
        <div className="profile-cta-bar">
          <div>
            <strong>{isProvider ? `Želiš raditi sa ${firstName}?` : `Želiš pomoći ${firstName}?`}</strong>
            <span>{isProvider ? 'Objavi posao i zatraži ponudu.' : 'Pogledaj šta traži i pošalji ponudu.'}</span>
          </div>
          <button
            type="button"
            className="primary-button"
            onClick={() => navigate(isProvider || listings.length === 0 ? '/objavi' : `/listings/${listings[0].id}`)}
          >
            {isProvider || listings.length === 0 ? 'Zatraži ponudu' : 'Pošalji ponudu'}
          </button>
        </div>
      )}
    </div>
  )
}

export default PublicProfilePage
