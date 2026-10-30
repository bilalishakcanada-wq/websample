import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, BadgeCheck, MapPin, MoreHorizontal, Play, Star, UserRound } from 'lucide-react'
import { LastSeen } from '../components/TrustBadge'
import BadgeShowcase from '../components/BadgeShowcase'
import { formatBosnianDate, formatBosnianMonthYear, jobOutcomesLabel, reviewsLabel } from '../utils/dateFormat'
import { useFullscreen } from './useFullscreen'
import { useGoBack } from '../hooks/useGoBack'
import { useQuoteRequestsEnabled } from '../hooks/queries'
import { useBackToClose } from '../hooks/useBackToClose'
import './app.css'

const money = (value, currency = 'BAM') => (value == null ? 'Po dogovoru' : `${Number(value).toLocaleString('bs-BA')} ${currency === 'BAM' ? 'KM' : currency}`)
const firstNameOf = (name) => (name || '').trim().split(/\s+/)[0] || 'korisnik'

const Stars = ({ value, size = 15 }) => {
  const rounded = Math.round(Number(value) || 0)
  return <span className="stars" aria-label={`${value} od 5`}>{[1, 2, 3, 4, 5].map((n) => <Star key={n} size={size} fill={n <= rounded ? 'currentColor' : 'none'} />)}</span>
}

/** Phone public profile: photo and name, two numbers, about, badges, reviews, then a sticky call to action. */
function ProfileView({ bundle, user, onReport, onBlock, blocked = false }) {
  const goBack = useGoBack()
  useFullscreen()
  const quoteEnabled = useQuoteRequestsEnabled()
  const [menu, setMenu] = useState(false)
  useBackToClose(menu, () => setMenu(false))
  const [showAll, setShowAll] = useState(false)
  const { profile, trust, badges = [], reviews = [], listings = [], portfolio = [] } = bundle
  const reviewCount = bundle.review_count ?? reviews.length
  const isOwn = user?.id === profile.user_id
  const isProvider = profile.account_type && profile.account_type !== 'client'
  const first = firstNameOf(profile.display_name)
  const isNew = profile.created_at && Date.now() - new Date(profile.created_at) < 60 * 864e5
  const verified = trust?.tier === 'verified' || trust?.tier === 'trusted' || trust?.tier === 'top'

  return (
    <div className="ap pv pf-phone">
      <header className="jd-top" onClick={(event) => { if (menu && event.target === event.currentTarget) setMenu(false) }}>
        <button type="button" className="ap-back" onClick={goBack} aria-label="Nazad"><ArrowLeft size={22} /></button>
        {!isOwn && user && (
          <>
            <button type="button" className="ap-back" onClick={() => setMenu((value) => !value)} aria-label="Više"><MoreHorizontal size={22} /></button>
            {menu && <div className="jd-menu" onClick={() => setMenu(false)}><button type="button" onClick={onReport}>Prijavi profil</button>{onBlock && <button type="button" onClick={onBlock}>{blocked ? 'Odblokiraj korisnika' : 'Blokiraj korisnika'}</button>}</div>}
          </>
        )}
        {isOwn && <Link to="/account/profil" className="jd-link">Uredi</Link>}
      </header>

      <section className="pv-head">
        {profile.avatar_url ? <img src={profile.avatar_url} alt="" className="pv-avatar" /> : <span className="pv-avatar pv-avatar-empty"><UserRound size={30} strokeWidth={1.6} /></span>}
        <div className="pv-id">
          <h1>{profile.display_name || 'Korisnik'} {verified && <BadgeCheck size={20} className="pv-verified" aria-label="Verifikovan" />}</h1>
          <div className="pv-meta">
            {profile.city && <span><MapPin size={14} /> {profile.city}</span>}
            {profile.created_at && <span>Član od {formatBosnianMonthYear(profile.created_at)}</span>}
          </div>
          <LastSeen value={profile.last_seen_at} />
        </div>
      </section>

      <dl className="pv-stats">
        <div>
          <dt>Ocjena</dt>
          <dd>{reviewCount > 0 ? <>{Number(trust?.avg_rating || 0).toFixed(1)} <Star size={14} fill="currentColor" className="pf-star" /></> : '-'}</dd>
          <small>{reviewsLabel(reviewCount)}</small>
        </div>
        {isProvider ? (
          <div>
            <dt>Uspješnost</dt>
            <dd>{trust?.success_rate == null ? '-' : `${Math.round(trust.success_rate)}%`}</dd>
            <small>{(trust?.completed_jobs || 0) + (trust?.failed_jobs || 0) > 0 ? jobOutcomesLabel(trust.completed_jobs || 0, trust.failed_jobs || 0) : isNew ? 'nedavno se pridružio/la' : 'još nema završenih'}</small>
          </div>
        ) : (
          <div>
            <dt>Dovršeni poslovi</dt>
            <dd>{trust?.client_completion_rate == null ? '-' : `${Math.round(trust.client_completion_rate)}%`}</dd>
            <small>{trust?.jobs_posted || 0} objavljenih</small>
          </div>
        )}
      </dl>

      {(profile.bio || (isProvider && profile.trades?.length > 0)) && (
        <section className="pv-section">
          <h2>O meni</h2>
          {profile.bio && <p>{profile.bio}</p>}
          {isProvider && profile.trades?.length > 0 && <div className="chip-row">{profile.trades.map((trade) => <span key={trade} className="chip">{trade}</span>)}</div>}
        </section>
      )}

      {(badges.length > 0 || isOwn) && (
        <section className="pv-section">
          <h2>Značke</h2>
          <BadgeShowcase badges={badges} isOwn={isOwn} userId={profile.user_id} compact />
        </section>
      )}

      <section className="pv-section">
        <h2>Recenzije</h2>
        {reviews.length === 0 ? <p className="muted-text">{first} još nema recenzija.</p> : (
          <ul className="pf-reviews">
            {(showAll ? reviews : reviews.slice(0, 3)).map((review) => (
              <li key={review.id} className="pf-review">
                {review.reviewer?.avatar_url ? <img loading="lazy" decoding="async" src={review.reviewer.avatar_url} alt="" className="pf-review-avatar" /> : <span className="pf-review-avatar"><UserRound size={16} /></span>}
                <div>
                  <div className="pf-review-head"><strong>{review.reviewer?.display_name || 'Korisnik'}</strong><span>{formatBosnianDate(review.created_at)}</span></div>
                  <Stars value={review.rating} size={13} />
                  {review.comment && <p>{review.comment}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
        {reviews.length > 3 && <button type="button" className="pf-more" onClick={() => setShowAll((value) => !value)}>{showAll ? 'Prikaži manje' : `Prikaži sve recenzije (${reviewCount})`}</button>}
      </section>

      {isProvider && portfolio.length > 0 && (
        <section className="pv-section">
          <h2>Radovi</h2>
          <div className="pf-portfolio">
            {portfolio.slice(0, 6).map((item) => (
              <a key={item.id} href={item.media_url} target="_blank" rel="noreferrer" className="pf-portfolio-item">
                {item.media_type === 'video' ? <span className="pf-portfolio-video"><Play size={20} /></span> : <img src={item.media_url} alt={item.caption || ''} loading="lazy" />}
              </a>
            ))}
          </div>
        </section>
      )}

      {listings.length > 0 && (
        <section className="pv-section">
          <h2>{first} traži izvođača</h2>
          <ul className="pf-jobs">
            {listings.slice(0, 3).map((item) => (
              <li key={item.id}>
                <Link to={`/listings/${item.id}`} className="pf-job">
                  <div><strong>{item.title}</strong><small>{item.category} · {item.location || 'Online'}</small></div>
                  <b>{money(item.price, item.currency)}</b>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!isOwn && (
        <div className="jd-sticky pv-cta">
          {isProvider
            ? <Link to={quoteEnabled ? `/objavi?za=${profile.user_id}` : '/objavi'} className="ap-btn ap-btn-primary">Zatraži ponudu</Link>
            : <Link to={listings[0] ? `/listings/${listings[0].id}` : '/search'} className="ap-btn ap-btn-primary">{listings[0] ? 'Pogledaj posao' : 'Pregledaj poslove'}</Link>}
        </div>
      )}
    </div>
  )
}

export default ProfileView
