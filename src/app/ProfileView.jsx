import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, BadgeCheck, MapPin, MoreHorizontal, Play, Star, UserRound } from 'lucide-react'
import { LastSeen } from '../components/TrustBadge'
import BadgeChip from '../components/BadgeChip'
import { formatBosnianDate } from '../utils/dateFormat'
import { useFullscreen } from './useFullscreen'
import './app.css'

const money = (value, currency = 'BAM') => (value == null ? 'Po dogovoru' : `${Number(value).toLocaleString('bs-BA')} ${currency === 'BAM' ? 'KM' : currency}`)
const firstNameOf = (name) => (name || '').trim().split(/\s+/)[0] || 'korisnik'

const Stars = ({ value, size = 15 }) => {
  const rounded = Math.round(Number(value) || 0)
  return <span className="pv-stars" aria-label={`${value} od 5`}>{[1, 2, 3, 4, 5].map((n) => <Star key={n} size={size} fill={n <= rounded ? 'currentColor' : 'none'} />)}</span>
}

/** Phone public profile: "UPOZNAJ" + big name, rating, review cards, then a sticky call to action. */
function ProfileView({ bundle, user, onReport }) {
  useFullscreen()
  const [menu, setMenu] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const { profile, trust, badges = [], reviews = [], listings = [], portfolio = [] } = bundle
  const reviewCount = bundle.review_count ?? reviews.length
  const isOwn = user?.id === profile.user_id
  const isProvider = profile.account_type && profile.account_type !== 'client'
  const first = firstNameOf(profile.display_name)
  const isNew = profile.created_at && Date.now() - new Date(profile.created_at) < 60 * 864e5
  const verified = trust?.tier === 'verified' || trust?.tier === 'trusted' || trust?.tier === 'top'

  return (
    <div className="ap pv">
      <header className="jd-top" onClick={(event) => { if (menu && event.target === event.currentTarget) setMenu(false) }}>
        <button type="button" className="ap-back" onClick={() => (window.history.length > 1 ? window.history.back() : window.location.assign('/'))} aria-label="Nazad"><ArrowLeft size={22} /></button>
        {!isOwn && user && (
          <>
            <button type="button" className="ap-back" onClick={() => setMenu((value) => !value)} aria-label="Više"><MoreHorizontal size={22} /></button>
            {menu && <div className="jd-menu" onClick={() => setMenu(false)}><button type="button" onClick={onReport}>Prijavi profil</button></div>}
          </>
        )}
        {isOwn && <Link to="/account/profil" className="jd-link">Uredi</Link>}
      </header>

      <section className="pv-head">
        <div>
          <span className="pv-eyebrow">Upoznaj</span>
          <h1>{profile.display_name || 'Korisnik'} {verified && <BadgeCheck size={22} className="jd-verified" />}</h1>
          <LastSeen value={profile.last_seen_at} />
        </div>
        {profile.avatar_url ? <img src={profile.avatar_url} alt="" className="pv-avatar" /> : <span className="pv-avatar pv-avatar-empty"><UserRound size={34} /></span>}
      </section>

      <ul className="pv-facts">
        {profile.city && <li><MapPin size={18} /> {profile.city}</li>}
        {isNew && <li><Star size={18} /> {first} se nedavno pridružio/la Poso.ba{isProvider ? ' i spreman/na je pomoći' : ''}.</li>}
        {isProvider && trust?.completed_jobs > 0 && <li><BadgeCheck size={18} /> {trust.completed_jobs} {trust.completed_jobs === 1 ? 'završen posao' : 'završenih poslova'}{trust.success_rate != null ? ` · ${Math.round(trust.success_rate)}% uspješnost` : ''}</li>}
      </ul>

      <section className="pv-rating">
        {reviewCount > 0
          ? <><h2>Ukupna ocjena {Number(trust?.avg_rating || 0).toFixed(1).replace('.0', '')} <Star size={18} fill="currentColor" /></h2><p>{reviewCount} {reviewCount === 1 ? 'recenzija' : 'recenzija'}</p></>
          : <><h2>Još nema recenzija <Star size={18} /></h2><p>{first} se nedavno pridružio/la</p></>}
      </section>

      {reviews.length > 0 && (
        <div className="pv-reviews">
          {(showAll ? reviews : reviews.slice(0, 3)).map((review) => (
            <article key={review.id} className="pv-review">
              <div className="pv-review-head">
                {review.reviewer?.avatar_url ? <img src={review.reviewer.avatar_url} alt="" className="jd-avatar" style={{ width: 40, height: 40 }} /> : <span className="jd-avatar jd-avatar-empty" style={{ width: 40, height: 40 }}><UserRound size={18} /></span>}
                <div><strong>{review.reviewer?.display_name || 'Korisnik'}</strong><span><Stars value={review.rating} /> <small>{formatBosnianDate(review.created_at)}</small></span></div>
              </div>
              {review.comment && <blockquote>{review.comment}</blockquote>}
            </article>
          ))}
        </div>
      )}
      {reviews.length > 3 && <button type="button" className="ap-btn ap-btn-light pv-all" onClick={() => setShowAll((value) => !value)}>{showAll ? 'Prikaži manje' : `Pogledaj sve recenzije (${reviewCount})`}</button>}

      {isProvider && (profile.bio || profile.trades?.length > 0) && (
        <section className="pv-section">
          <h3>Ukratko</h3>
          {profile.bio && <p>{profile.bio}</p>}
          {profile.trades?.length > 0 && <div className="pv-chips">{profile.trades.map((trade) => <span key={trade}>{trade}</span>)}</div>}
        </section>
      )}

      {badges.length > 0 && (
        <section className="pv-section">
          <h3>Značke</h3>
          <div className="pv-chips">{badges.map((badge) => <BadgeChip key={badge.code} badge={badge} />)}</div>
        </section>
      )}

      {isProvider && portfolio.length > 0 && (
        <section className="pv-section">
          <h3>Radovi</h3>
          <div className="pv-portfolio">
            {portfolio.slice(0, 6).map((item) => (
              <a key={item.id} href={item.media_url} target="_blank" rel="noreferrer">
                {item.media_type === 'video' ? <span className="pv-video"><Play size={20} /></span> : <img src={item.media_url} alt={item.caption || ''} loading="lazy" />}
              </a>
            ))}
          </div>
        </section>
      )}

      {listings.length > 0 && (
        <section className="pv-card">
          <h3>{first} traži izvođača</h3>
          {listings.slice(0, 3).map((item) => (
            <Link key={item.id} to={`/listings/${item.id}`} className="pv-job">
              <div><strong>{item.title}</strong><span>{item.location || 'Online'} · {item.category}</span></div>
              <em>{money(item.price, item.currency)}</em>
            </Link>
          ))}
        </section>
      )}

      {!isOwn && (
        <div className="jd-sticky pv-cta">
          <strong>{isProvider ? `Želiš raditi s ${first}?` : `Želiš raditi za ${first}?`}</strong>
          <span>{isProvider ? 'Objavi posao i zatraži ponudu.' : 'Pogledaj šta traži i pošalji ponudu.'}</span>
          {isProvider
            ? <Link to="/objavi" className="ap-btn ap-btn-primary">Zatraži ponudu</Link>
            : <Link to={listings[0] ? `/listings/${listings[0].id}` : '/search'} className="ap-btn ap-btn-primary">{listings[0] ? 'Pogledaj posao' : 'Pregledaj poslove'}</Link>}
        </div>
      )}
    </div>
  )
}

export default ProfileView
