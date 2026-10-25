import { useEffect, useState } from 'react'
import { usePublicProfile, useQuoteRequestsEnabled } from '../hooks/queries'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Ban, CheckCircle2, Flag, MapPin, Play, Star, UserRound } from 'lucide-react'
import { reportService } from '../services/reportService'
import { useAuth } from '../context/AuthContext'
import TrustBadge, { LastSeen } from '../components/TrustBadge'
import AvatarWithBadges from '../components/AvatarWithBadges'
import BadgeShowcase from '../components/BadgeShowcase'
import BackHome from '../components/BackHome'
import { formatBosnianDate, formatBosnianMonthYear, jobOutcomesLabel, reviewsLabel } from '../utils/dateFormat'
import { useMediaQuery } from '../hooks/useMediaQuery'
import ProfileView from '../app/ProfileView'
import { useFullscreen } from '../app/useFullscreen'
import { SkeletonProfilePhone } from '../components/Skeleton'
import { setPageTitle } from '../utils/pageTitle'
import { promptDialog } from '../utils/dialog'
import { useBlocks } from '../hooks/useBlocks'
import { toast } from '../components/Toaster'

const formatPrice = (value, currency = 'BAM') => value == null ? 'Po dogovoru' : `${Number(value).toLocaleString('bs-BA')} ${currency === 'BAM' ? 'KM' : currency}`

const firstNameOf = (displayName) => (displayName || '').trim().split(/\s+/)[0] || 'korisnik'

const TIER_HINT = {
  top: 'Verifikovan, 10+ recenzija sa prosjekom 4.8+. Najviši nivo povjerenja.',
  trusted: 'Verifikovan i dokazano pouzdan kroz recenzije.',
  verified: 'Identitet i struka provjereni od strane Zadatak tima.',
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

/** A titled list (education, work) on the profile; the owner sees a link to fill an empty one. */
function SectionList({ title, items, emptyHint, editHref }) {
  if ((!items || items.length === 0) && !editHref) return null
  return (
    <div className="pf-sub">
      <h3>{title}</h3>
      {items?.length > 0
        ? <ul className="pf-list">{items.map((item) => <li key={item}>{item}</li>)}</ul>
        : <Link to={editHref} className="pf-empty-link">{emptyHint}</Link>}
    </div>
  )
}

/** A titled row of chips (specialties, transport). */
function SectionChips({ title, items, emptyHint, editHref }) {
  if ((!items || items.length === 0) && !editHref) return null
  return (
    <div className="pf-sub">
      <h3>{title}</h3>
      {items?.length > 0
        ? <div className="chip-row">{items.map((item) => <span key={item} className="chip">{item}</span>)}</div>
        : <Link to={editHref} className="pf-empty-link">{emptyHint}</Link>}
    </div>
  )
}

function PublicProfilePage() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const profileQuery = usePublicProfile(userId)
  const quoteEnabled = useQuoteRequestsEnabled()
  const bundle = profileQuery.data ?? null
  const loading = profileQuery.isPending
  const [showAllReviews, setShowAllReviews] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const { isBlocked, toggle: toggleBlockUser } = useBlocks()
  const isPhone = useMediaQuery('(max-width: 768px)')

  // the phone profile screen draws its own top bar (skeleton included); the not-found state keeps the tab bar
  useFullscreen(isPhone && (loading || Boolean(bundle?.profile)))
  useEffect(() => { if (bundle?.profile?.display_name) setPageTitle(bundle.profile.display_name) }, [bundle])
  useEffect(() => { setError(profileQuery.error && !profileQuery.data ? profileQuery.error.message : '') }, [profileQuery.error, profileQuery.data])

  if (loading) {
    if (isPhone) return <SkeletonProfilePhone />
    return (
      <div className="app-shell page-with-mobile-nav">
        <main className="content-container"><div className="skeleton-card" /><div className="skeleton-card" /></main>
      </div>
    )
  }

  if (error || !bundle?.profile) {
    // a failed request is not a missing profile: offer a retry instead of a dead end
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false
    return (
      <div className="app-shell page-with-mobile-nav">
        <main className="content-container empty-state">
          <UserRound size={42} />
          <h2>{error ? 'Profil se nije učitao' : 'Profil nije pronađen'}</h2>
          <p>{error ? (offline ? 'Nema internet veze. Provjeri vezu i pokušaj ponovo.' : 'Veza sa serverom je prekinuta. Pokušaj ponovo.') : 'Ovaj profil ne postoji ili trenutno nije javan.'}</p>
          {error && <button type="button" className="primary-button" onClick={() => profileQuery.refetch()} disabled={profileQuery.isFetching}>{profileQuery.isFetching ? 'Učitavam…' : 'Pokušaj ponovo'}</button>}
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
    const reason = await promptDialog({ title: 'Prijavi profil', text: 'Zašto prijavljuješ ovaj profil? (npr. dijeli broj telefona, lažni identitet, uznemiravanje)', placeholder: 'Opiši ukratko…', confirmLabel: 'Prijavi' })
    if (!reason) return
    try {
      await reportService.createReport({ reporterId: user.id, targetType: 'profile', targetId: userId, reason })
      setNotice('Hvala — prijava je poslana našem timu.')
    } catch (requestError) {
      setNotice(requestError.message)
    }
  }

  const blocked = isBlocked(userId)
  const toggleBlock = async () => {
    try {
      if (await toggleBlockUser(userId, profile.display_name || 'ovog korisnika')) {
        const text = blocked ? 'Korisnik je odblokiran.' : 'Korisnik je blokiran.'
        setNotice(text); toast(text)
      }
    } catch (requestError) {
      setNotice(requestError.message); toast(requestError.message, { kind: 'error' })
    }
  }

  if (isPhone) return <ProfileView bundle={bundle} user={user} onReport={reportProfile} onBlock={toggleBlock} blocked={blocked} />

  const reviewLabel = reviewsLabel(reviewCount)
  const ctaLabel = isProvider || listings.length === 0 ? 'Zatraži ponudu' : 'Pošalji ponudu'
  const cta = () => navigate(isProvider ? (quoteEnabled ? `/objavi?za=${userId}` : '/objavi') : listings.length === 0 ? '/objavi' : `/listings/${listings[0].id}`)
  const hasExperience = isProvider && (profile.education?.length || profile.work_experience?.length || profile.specialties?.length || profile.transportation?.length || editHref)

  return (
    <div className={`app-shell page-with-mobile-nav pf-page ${isProvider ? 'is-provider' : 'is-client'}`}>
      <main className="pf">
        <div className="pf-back"><BackHome /></div>

        <header className="pf-head">
          <AvatarWithBadges src={profile.avatar_url} tier={tier} size={104} />
          <div className="pf-id">
            <h1>{profile.display_name}</h1>
            <div className="pf-meta">
              {profile.city && <span><MapPin size={15} /> {profile.city}</span>}
              <span>Član od {formatBosnianMonthYear(profile.created_at)}</span>
              <LastSeen value={profile.last_seen_at} />
            </div>
            <dl className="pf-stats">
              <div>
                <dt>Ocjena</dt>
                <dd>{reviewCount > 0 ? <>{Number(trust.avg_rating).toFixed(1)} <Star size={15} fill="currentColor" className="pf-star" /></> : '—'}<small>{reviewLabel}</small></dd>
              </div>
              {isProvider ? (
                <div title="Udio uspješnih poslova: završeni i isplaćeni, prema onima koje je izvođač prekinuo ili izgubio u sporu.">
                  <dt>Uspješnost</dt>
                  <dd>{trust?.success_rate == null ? '—' : `${Math.round(trust.success_rate)}%`}<small>{jobsDecided === 0 ? 'još nema završenih poslova' : jobOutcomesLabel(trust?.completed_jobs || 0, trust?.failed_jobs || 0)}</small></dd>
                </div>
              ) : (
                <div title="Udio objavljenih poslova sa prihvaćenom ponudom koji su dovršeni.">
                  <dt>Dovršeni poslovi</dt>
                  <dd>{trust?.client_completion_rate == null ? '—' : `${Math.round(trust.client_completion_rate)}%`}<small>{trust?.jobs_posted || 0} objavljenih</small></dd>
                </div>
              )}
            </dl>
          </div>
          <div className="pf-actions">
            {isOwnProfile
              ? <Link to="/account/profil" className="ghost-button">Uredi profil</Link>
              : <button type="button" className="primary-button" onClick={cta}>{ctaLabel}</button>}
            {!isOwnProfile && user && (
              <div className="pf-quiet-actions">
                <button type="button" onClick={reportProfile}><Flag size={13} /> Prijavi</button>
                <button type="button" onClick={toggleBlock}><Ban size={13} /> {blocked ? 'Odblokiraj' : 'Blokiraj'}</button>
              </div>
            )}
          </div>
        </header>
        {notice && <p className="pf-notice">{notice}</p>}

        <div className="pf-body">
          <div className="pf-main">
            <section className="pf-section">
              <h2>O meni</h2>
              {profile.bio
                ? <p className="pf-about">{profile.bio}</p>
                : isOwnProfile ? <Link to="/account/profil" className="pf-empty-link">Dodaj kratak opis o sebi</Link> : <p className="muted-text">{firstName} još nije dodao/la opis.</p>}
            </section>

            <section className="pf-section">
              <div className="pf-section-head">
                <h2>Recenzije</h2>
                {reviewCount > 0 && <span className="pf-section-note"><Star size={14} fill="currentColor" className="pf-star" /> {Number(trust.avg_rating).toFixed(1)} · {reviewLabel}</span>}
              </div>
              {reviews.length === 0 ? (
                <p className="muted-text">{firstName} još nema recenzija. Prva dolazi nakon prvog završenog posla.</p>
              ) : (
                <>
                  <ul className="pf-reviews">
                    {visibleReviews.map((review) => (
                      <li className="pf-review" key={review.id}>
                        {review.reviewer?.avatar_url
                          ? <img loading="lazy" decoding="async" src={review.reviewer.avatar_url} alt="" className="pf-review-avatar" />
                          : <span className="pf-review-avatar"><UserRound size={16} /></span>}
                        <div>
                          <div className="pf-review-head">
                            <strong>{review.reviewer?.display_name || 'Korisnik Zadatka'}</strong>
                            <span>{formatBosnianDate(review.created_at)}</span>
                          </div>
                          <Stars value={review.rating} size={13} />
                          {review.comment && <p>{review.comment}</p>}
                        </div>
                      </li>
                    ))}
                  </ul>
                  {reviews.length > 3 && (
                    <button type="button" className="pf-more" onClick={() => setShowAllReviews((open) => !open)}>
                      {showAllReviews ? 'Prikaži manje' : `Prikaži sve recenzije (${reviews.length})`}
                    </button>
                  )}
                </>
              )}
            </section>

            {isProvider && portfolio.length > 0 && (
              <section className="pf-section">
                <h2>Radovi</h2>
                <div className="pf-portfolio">
                  {portfolio.map((item) => (
                    <a key={item.id} href={item.media_url} target="_blank" rel="noreferrer" className="pf-portfolio-item">
                      {item.media_type === 'video'
                        ? <span className="pf-portfolio-video"><Play size={20} /></span>
                        : <img src={item.media_url} alt={item.caption || ''} loading="lazy" />}
                    </a>
                  ))}
                </div>
              </section>
            )}

            {hasExperience && (
              <section className="pf-section">
                <h2>Iskustvo</h2>
                <SectionList title="Obrazovanje" items={profile.education} emptyHint="Dodaj obrazovanje" editHref={editHref} />
                <SectionList title="Radno iskustvo" items={profile.work_experience} emptyHint="Dodaj radno iskustvo" editHref={editHref} />
                <SectionChips title="Specijalnosti" items={profile.specialties} emptyHint="Dodaj specijalnosti" editHref={editHref} />
                <SectionChips title="Prevoz" items={profile.transportation} emptyHint="Označi kako dolaziš do klijenta" editHref={editHref} />
              </section>
            )}

            {listings.length > 0 && (
              <section className="pf-section" id="aktivni-oglasi">
                <div className="pf-section-head"><h2>Aktivni oglasi</h2><span className="pf-section-note">{listings.length}</span></div>
                <ul className="pf-jobs">
                  {listings.map((listing) => (
                    <li key={listing.id}>
                      <Link className="pf-job" to={`/listings/${listing.id}`}>
                        <div>
                          <strong>{listing.title}</strong>
                          <small>{listing.category} · {listing.location || 'Bez lokacije'}</small>
                        </div>
                        <b>{formatPrice(listing.price, listing.currency)}</b>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          <aside className="pf-side">
            {isProvider && trust && (
              <section className="pf-card">
                <h2>Povjerenje</h2>
                <TrustBadge tier={trust.tier} label={trust.label} trade={trust.verified_trade} />
                <p className="pf-card-note">{TIER_HINT[trust.tier]}</p>
              </section>
            )}
            {(badges.length > 0 || isOwnProfile) && (
              <section className="pf-card">
                <h2>Značke</h2>
                <BadgeShowcase badges={badges} isOwn={isOwnProfile} userId={userId} />
              </section>
            )}
            {isProvider && profile.trades?.length > 0 && (
              <section className="pf-card">
                <h2>Struka</h2>
                <div className="chip-row">
                  {profile.trades.map((trade) => (
                    <span className="chip" key={trade}>{trade}{profile.verified_trade === trade && <CheckCircle2 size={13} className="chip-check" aria-label="provjerena" />}</span>
                  ))}
                </div>
              </section>
            )}
          </aside>
        </div>
      </main>
    </div>
  )
}

export default PublicProfilePage
