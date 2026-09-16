import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CalendarDays, MapPin, Play, ShieldAlert, ShieldCheck, Star, UserRound } from 'lucide-react'
import { profileService } from '../services/profileService'
import { reviewService } from '../services/reviewService'
import { listingService } from '../services/listingService'
import { badgeService } from '../services/badgeService'
import { portfolioService } from '../services/portfolioService'
import ListingCard from '../components/ListingCard'
import BackHome from '../components/BackHome'
import MobileNav from '../components/MobileNav'
import { formatBosnianMonthYear } from '../utils/dateFormat'

const formatPrice = (value, currency = 'BAM') => value == null ? 'Po dogovoru' : `${Number(value).toLocaleString('bs-BA')} ${currency === 'BAM' ? 'KM' : currency}`

function PublicProfilePage() {
  const { userId } = useParams()
  const [profile, setProfile] = useState(null)
  const [summary, setSummary] = useState({ average: null, count: 0 })
  const [reviews, setReviews] = useState([])
  const [listings, setListings] = useState([])
  const [badges, setBadges] = useState([])
  const [portfolio, setPortfolio] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    Promise.all([
      profileService.getPublicProfile(userId),
      reviewService.getSummary(userId),
      reviewService.listForUser(userId),
      listingService.listAll({ status: 'published', ownerId: userId, pageSize: 12 }),
      badgeService.listForUser(userId),
      portfolioService.listForUser(userId),
    ])
      .then(([profileData, summaryData, reviewsData, listingsData, badgeData, portfolioData]) => {
        if (!active) return
        setProfile(profileData)
        setSummary(summaryData)
        setReviews(reviewsData)
        setListings(listingsData.data || [])
        setBadges(badgeData)
        setPortfolio(portfolioData)
      })
      .catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [userId])

  if (loading) return <div className="page-state">Učitavanje profila...</div>

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

  const memberSince = formatBosnianMonthYear(profile.created_at)

  return (
    <div className="app-shell page-with-mobile-nav">
      <header className="app-page-header"><BackHome /></header>
      <main className="content-container">
        <section className="public-profile-hero">
          {profile.avatar_url
            ? <img className="public-profile-avatar" src={profile.avatar_url} alt={profile.full_name || 'Korisnik'} />
            : <div className="public-profile-avatar public-profile-avatar-fallback"><UserRound size={36} /></div>}
          <div>
            <div className="public-profile-name-row">
              <h1>{profile.full_name || 'Korisnik Poso.ba'}</h1>
              {profile.display_uid && <span className="uid-chip">{profile.display_uid}</span>}
            </div>
            {profile.account_type !== 'client' && (
              <div className={`verify-banner ${profile.verified_trade ? 'verified' : 'unverified'}`}>
                {profile.verified_trade
                  ? <><ShieldCheck size={16} /> Verifikovan majstor — {profile.verified_trade}</>
                  : <><ShieldAlert size={16} /> Majstor još nije verifikovan</>}
              </div>
            )}
            <div className="public-profile-meta">
              {profile.city && <span><MapPin size={15} /> {profile.city}</span>}
              <span><CalendarDays size={15} /> Član od {memberSince}</span>
            </div>
            {profile.trades?.length > 0 && (
              <div className="trade-list">
                {profile.trades.map((trade) => (
                  <span className="trade-tag" key={trade}>
                    {trade}
                    {profile.verified_trade === trade && <ShieldCheck size={12} />}
                  </span>
                ))}
              </div>
            )}
            <div className="public-profile-rating">
              <Star size={17} fill="currentColor" />
              {summary.average
                ? <><strong>{summary.average}</strong><span>({summary.count} {summary.count === 1 ? 'recenzija' : 'recenzije'})</span></>
                : <span>Još nema recenzija</span>}
            </div>
            {badges.length > 0 && (
              <div className="badge-row">
                {badges.map((badge) => (
                  <span key={badge.code} className={`badge-pill badge-${badge.code}`} title={badge.description || ''}>
                    <ShieldCheck size={13} /> {badge.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>

        {profile.bio && (
          <section className="detail-section">
            <h2>O meni</h2>
            <p>{profile.bio}</p>
          </section>
        )}

        {portfolio.length > 0 && (
          <section className="detail-section">
            <h2>Portfolio ({portfolio.length})</h2>
            <div className="portfolio-grid">
              {portfolio.map((item) => (
                <div className="portfolio-item" key={item.id}>
                  {item.media_type === 'video'
                    ? <div className="portfolio-video-thumb"><Play size={22} /></div>
                    : <img src={item.media_url} alt={item.caption || ''} loading="lazy" />}
                  {item.caption && <span className="portfolio-caption">{item.caption}</span>}
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="detail-section">
          <h2>Aktivni oglasi ({listings.length})</h2>
          {listings.length === 0
            ? <p className="muted-text">Trenutno nema aktivnih oglasa.</p>
            : <div className="listing-grid">{listings.map((listing) => <ListingCard key={listing.id} listing={{ ...listing, price: formatPrice(listing.price, listing.currency), time: '' }} />)}</div>}
        </section>

        <section className="detail-section">
          <h2>Recenzije ({reviews.length})</h2>
          {reviews.length === 0
            ? <p className="muted-text">Još nema recenzija.</p>
            : (
              <div className="reviews-list">
                {reviews.map((review) => (
                  <div className="review-item" key={review.id}>
                    <div className="review-item-header">
                      <strong>{review.reviewer?.full_name || 'Korisnik Poso.ba'}</strong>
                      <span className="rating-inline"><Star size={13} fill="currentColor" /> {review.rating}</span>
                    </div>
                    {review.comment && <p>{review.comment}</p>}
                  </div>
                ))}
              </div>
            )}
        </section>
      </main>
      <MobileNav />
    </div>
  )
}

export default PublicProfilePage
