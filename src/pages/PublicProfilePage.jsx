import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Award, Briefcase, CheckCircle2, MapPin, MessageSquareQuote, Play, Star, UserRound, Zap } from 'lucide-react'
import { profileService } from '../services/profileService'
import { reviewService } from '../services/reviewService'
import { listingService } from '../services/listingService'
import { portfolioService } from '../services/portfolioService'
import { trustService } from '../services/trustService'
import { useAuth } from '../context/AuthContext'
import TrustBadge, { LastSeen } from '../components/TrustBadge'
import BackHome from '../components/BackHome'
import MobileNav from '../components/MobileNav'
import { formatBosnianDate, formatBosnianMonthYear } from '../utils/dateFormat'

const BADGE_META = {
  verified: { label: 'Verifikovan', icon: CheckCircle2 },
  top_rated: { label: 'Top ocjene', icon: Award },
  rising_talent: { label: 'Talenat u usponu', icon: Zap },
  reliable: { label: 'Pouzdan', icon: CheckCircle2 },
  fast_responder: { label: 'Brz odgovor', icon: Zap },
}

const formatPrice = (value, currency = 'BAM') => value == null ? 'Po dogovoru' : `${Number(value).toLocaleString('bs-BA')} ${currency === 'BAM' ? 'KM' : currency}`

const firstNameOf = (fullName) => (fullName || '').trim().split(/\s+/)[0] || 'korisnik'

function Stars({ value }) {
  const rounded = Math.round(Number(value) || 0)
  return (
    <span className="stars" aria-label={`${value} od 5`}>
      {[1, 2, 3, 4, 5].map((n) => <Star key={n} size={14} fill={n <= rounded ? 'currentColor' : 'none'} />)}
    </span>
  )
}

function PublicProfilePage() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [trust, setTrust] = useState(null)
  const [reviews, setReviews] = useState([])
  const [listings, setListings] = useState([])
  const [portfolio, setPortfolio] = useState([])
  const [showAllReviews, setShowAllReviews] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    Promise.all([
      profileService.getPublicProfile(userId),
      trustService.getSummary(userId),
      reviewService.listForUser(userId),
      listingService.listAll({ status: 'published', ownerId: userId, pageSize: 6 }),
      portfolioService.listForUser(userId),
    ])
      .then(([profileData, trustData, reviewsData, listingsData, portfolioData]) => {
        if (!active) return
        setProfile(profileData)
        setTrust(trustData)
        setReviews(reviewsData)
        setListings(listingsData.data || [])
        setPortfolio(portfolioData)
      })
      .catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [userId])

  const isOwnProfile = user?.id === userId
  const firstName = useMemo(() => firstNameOf(profile?.full_name), [profile])
  const offersServices = profile?.account_type && profile.account_type !== 'client'
  const visibleReviews = showAllReviews ? reviews : reviews.slice(0, 3)
  const badgeChips = (trust?.badges || []).filter((code) => BADGE_META[code])

  if (loading) {
    return (
      <div className="app-shell page-with-mobile-nav">
        <main className="content-container"><div className="skeleton-card" /><div className="skeleton-card" /></main>
        <MobileNav />
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="app-shell page-with-mobile-nav">
        <main className="content-container empty-state">
          <UserRound size={42} />
          <h2>Profil nije pronađen</h2>
          <p>{error || 'Ovaj profil ne postoji ili trenutno nije javan.'}</p>
        </main>
        <MobileNav />
      </div>
    )
  }

  return (
    <div className="app-shell page-with-mobile-nav public-profile-page">
      <header className="app-page-header"><BackHome /></header>

      <main className="content-container public-profile-layout">
        <aside className="meet-card">
          <span className="meet-label">Upoznaj</span>
          <div className="meet-card-top">
            <div>
              <h1>{profile.full_name || 'Korisnik Poso.ba'}</h1>
              <LastSeen value={profile.last_seen_at} />
            </div>
            {profile.avatar_url
              ? <img className="meet-avatar" src={profile.avatar_url} alt="" />
              : <div className="meet-avatar meet-avatar-fallback"><UserRound size={44} /></div>}
          </div>

          {trust && (
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

          <div className="meet-meta">
            {profile.city && <span><MapPin size={15} /> {profile.city}</span>}
            <span>Član od {formatBosnianMonthYear(profile.created_at)}</span>
            {profile.display_uid && <span className="uid-chip">{profile.display_uid}</span>}
          </div>

          {profile.trades?.length > 0 && (
            <div className="trade-list">
              {profile.trades.map((trade) => (
                <span className="trade-tag" key={trade}>
                  {trade}{profile.verified_trade === trade && <CheckCircle2 size={12} />}
                </span>
              ))}
            </div>
          )}

          {badgeChips.length > 0 && (
            <div className="badge-row">
              {badgeChips.map((code) => {
                const Icon = BADGE_META[code].icon
                return <span key={code} className={`badge-pill badge-${code}`}><Icon size={13} /> {BADGE_META[code].label}</span>
              })}
            </div>
          )}

          {profile.bio && <p className="meet-bio">{profile.bio}</p>}
        </aside>

        <section className="public-profile-main">
          <div className="review-summary-card">
            <div className="review-summary-head">
              <div>
                <h2>
                  Ukupna ocjena {trust?.review_count > 0 ? <strong>{Number(trust.avg_rating).toFixed(1)}</strong> : <strong>—</strong>}
                  <Star size={20} fill="currentColor" className="review-summary-star" />
                </h2>
                <span className="muted-text">{reviews.length} {reviews.length === 1 ? 'recenzija' : 'recenzija'}</span>
              </div>
              {trust?.completed_jobs > 0 && (
                <div className="review-summary-stat">
                  <strong>{trust.completed_jobs}</strong>
                  <span>prihvaćenih poslova</span>
                </div>
              )}
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
                          <strong>{review.reviewer?.full_name || 'Korisnik Poso.ba'}</strong>
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

          {portfolio.length > 0 && (
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
            <strong>{offersServices ? `Želiš raditi sa ${firstName}?` : `Želiš pomoći ${firstName}?`}</strong>
            <span>{offersServices ? 'Objavi posao i zatraži ponudu.' : 'Pogledaj šta traži i pošalji ponudu.'}</span>
          </div>
          <button
            type="button"
            className="primary-button"
            onClick={() => navigate(offersServices || listings.length === 0 ? '/objavi' : `/listings/${listings[0].id}`)}
          >
            {offersServices || listings.length === 0 ? 'Zatraži ponudu' : 'Pošalji ponudu'}
          </button>
        </div>
      )}
      <MobileNav />
    </div>
  )
}

export default PublicProfilePage
