import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Briefcase, CheckCircle2, Flag, GraduationCap, Info, MapPin, MessageSquareQuote, Play, Sparkles, Star, UserRound } from 'lucide-react'
import { profileService } from '../services/profileService'
import { reportService } from '../services/reportService'
import { useAuth } from '../context/AuthContext'
import TrustBadge, { LastSeen } from '../components/TrustBadge'
import AvatarWithBadges from '../components/AvatarWithBadges'
import BadgeChip from '../components/BadgeChip'
import BackHome from '../components/BackHome'
import { formatBosnianDate, formatBosnianMonthYear } from '../utils/dateFormat'
import { useMediaQuery } from '../hooks/useMediaQuery'
import ProfileView from '../app/ProfileView'

const formatPrice = (value, currency = 'BAM') => value == null ? 'Po dogovoru' : `${Number(value).toLocaleString('bs-BA')} ${currency === 'BAM' ? 'KM' : currency}`

const firstNameOf = (displayName) => (displayName || '').trim().split(/\s+/)[0] || 'korisnik'

const TIER_HINT = {
  top: 'Verifikovan, 10+ recenzija sa prosjekom 4.8+. Najviši nivo povjerenja.',
  trusted: 'Verifikovan i dokazano pouzdan kroz recenzije.',
  verified: 'Identitet i struka provjereni od strane Poso.ba tima.',
  new: 'Novi korisnik — još nema dovoljno istorije za ocjenu.',
  unverified: 'Struka još nije provjerena. Traži recenzije i portfolio prije dogovora.',
}

function Stars({ value, size = 14 }) {
  const rounded = Math.round(Number(value) || 0)
  return (
    <span className="stars" aria-label={`${value} od 5`}>
      {[1, 2, 3, 4, 5].map((n) => <Star key={n} size={size} fill={n <= rounded ? 'currentColor' : 'none'} />)}
    </span>
  )
}

function SectionList({ icon: Icon, title, items, emptyHint, editHref }) {
  if ((!items || items.length === 0) && !editHref) return null
  return (
    <section className="pp-section">
      <h3>{title}</h3>
      {items?.length > 0 ? (
        <ul className="pp-list">
          {items.map((item) => <li key={item}><span className="pp-list-icon"><Icon size={16} /></span><span>{item}</span></li>)}
        </ul>
      ) : (
        <Link to={editHref} className="pp-empty-link">{emptyHint}</Link>
      )}
    </section>
  )
}

function SectionChips({ title, items, emptyHint, editHref }) {
  if ((!items || items.length === 0) && !editHref) return null
  return (
    <section className="pp-section">
      <h3>{title}</h3>
      {items?.length > 0
        ? <div className="pp-chips">{items.map((item) => <span key={item} className="pp-chip">{item}</span>)}</div>
        : <Link to={editHref} className="pp-empty-link">{emptyHint}</Link>}
    </section>
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
  const isPhone = useMediaQuery('(max-width: 768px)')

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
  const editHref = isOwnProfile ? '/account/vjestine' : null
  const tier = isProvider ? (trust?.tier || 'unverified') : 'client'

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

  if (isPhone) return <ProfileView bundle={bundle} user={user} onReport={reportProfile} />

  return (
    <div className={`app-shell page-with-mobile-nav public-profile-page ${isProvider ? 'is-provider' : 'is-client'}`}>
      <header className="app-page-header"><BackHome /></header>

      <main className="content-container public-profile-layout">
        <aside className="meet-card">
          <span className="meet-label">Upoznaj</span>
          <div className="meet-card-top">
            <div>
              <h1>{profile.display_name}</h1>
              <LastSeen value={profile.last_seen_at} />
            </div>
            <AvatarWithBadges src={profile.avatar_url} tier={tier} badges={badges} size={120} />
          </div>

          <div className="meet-meta">
            {profile.city && <span><MapPin size={15} /> {profile.city}</span>}
            <span>Član od {formatBosnianMonthYear(profile.created_at)}</span>
          </div>

          <div className="meet-stats">
            <div className="meet-stat">
              <strong>{reviewCount > 0 ? Number(trust.avg_rating).toFixed(1) : '—'} <Star size={18} fill="currentColor" /></strong>
              <span>Ukupna ocjena <Info size={13} title="Prosjek svih recenzija koje su ostavili klijenti nakon posla." /></span>
              <small>{reviewCount} {reviewCount === 1 ? 'recenzija' : 'recenzija'}</small>
            </div>
            {isProvider ? (
              <div className="meet-stat">
                <strong>{trust?.success_rate == null ? '—' : `${Math.round(trust.success_rate)}%`}</strong>
                <span>Uspješnost <Info size={13} title="Udio prihvaćenih poslova koji su završeni, bez otkazivanja od strane izvođača." /></span>
                <small>{trust?.completed_jobs || 0} {trust?.completed_jobs === 1 ? 'posao' : 'poslova'}{jobsDecided === 0 ? ' — još nema završenih' : ''}</small>
              </div>
            ) : (
              <div className="meet-stat">
                <strong>{trust?.client_completion_rate == null ? '—' : `${Math.round(trust.client_completion_rate)}%`}</strong>
                <span>Dovršeni poslovi <Info size={13} title="Udio objavljenih poslova sa prihvaćenom ponudom koji su dovršeni." /></span>
                <small>{trust?.jobs_posted || 0} objavljenih</small>
              </div>
            )}
          </div>

          {isProvider && trust && (
            <div className="meet-trust-line" title={TIER_HINT[trust.tier]}>
              <TrustBadge tier={trust.tier} label={trust.label} trade={trust.verified_trade} />
              <small>{TIER_HINT[trust.tier]}</small>
            </div>
          )}

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
            <details className="badge-legend-box">
              <summary><Sparkles size={14} /> Šta znače značke na slici ({badges.length})</summary>
              <ul className="badge-legend">
                {badges.map((badge) => <li key={badge.code}><BadgeChip badge={badge} /><span>{badge.description}</span></li>)}
              </ul>
            </details>
          )}

          {!isOwnProfile && user && (
            <button type="button" className="meet-report" onClick={reportProfile}><Flag size={13} /> Prijavi profil</button>
          )}
          {notice && <small className="meet-notice">{notice}</small>}
        </aside>

        <section className="public-profile-main pp-card">
          <section className="pp-section">
            <h3>O meni</h3>
            {profile.bio
              ? <p className="pp-about">{profile.bio}</p>
              : isOwnProfile ? <Link to="/account/profil" className="pp-empty-link">Dodaj kratak opis o sebi →</Link> : <p className="muted-text">{firstName} još nije dodao/la opis.</p>}
          </section>

          <section className="pp-section">
            <h3>Ukupna ocjena {reviewCount > 0 ? <strong>{Number(trust.avg_rating).toFixed(1)}</strong> : <strong>—</strong>} <Star size={18} fill="currentColor" className="review-summary-star" /></h3>
            <span className="muted-text">{reviewCount} {reviewCount === 1 ? 'recenzija' : 'recenzija'}</span>

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
                    {showAllReviews ? 'Prikaži manje' : `Pogledaj svih ${reviews.length} recenzija`}
                  </button>
                )}
              </>
            )}
          </section>

          {isProvider && (
            <>
              <SectionList icon={GraduationCap} title="Obrazovanje" items={profile.education} emptyHint="Dodaj obrazovanje →" editHref={editHref} />
              <SectionList icon={Briefcase} title="Radno iskustvo" items={profile.work_experience} emptyHint="Dodaj radno iskustvo →" editHref={editHref} />
              <SectionChips title="Specijalnosti" items={profile.specialties} emptyHint="Dodaj specijalnosti →" editHref={editHref} />
              <SectionChips title="Prevoz" items={profile.transportation} emptyHint="Označi kako dolaziš do klijenta →" editHref={editHref} />
            </>
          )}

          {isProvider && portfolio.length > 0 && (
            <section className="pp-section">
              <h3>Portfolio radova</h3>
              <div className="portfolio-grid">
                {portfolio.map((item) => (
                  <div className="portfolio-item" key={item.id}>
                    {item.media_type === 'video'
                      ? <div className="portfolio-video-thumb"><Play size={22} /></div>
                      : <img src={item.media_url} alt={item.caption || ''} loading="lazy" />}
                  </div>
                ))}
              </div>
            </section>
          )}

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

          {listings.length > 0 && (
            <section className="pp-section" id="aktivni-oglasi">
              <h3>Aktivni oglasi ({listings.length})</h3>
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
            </section>
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
