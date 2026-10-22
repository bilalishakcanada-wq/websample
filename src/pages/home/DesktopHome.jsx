import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  BadgeCheck,
  Check,
  MapPin,
  Search,
  ShieldCheck,
  Star,
  UserRound,
  Users,
  Wallet,
} from 'lucide-react'
import { ChatCircleIcon, ShieldCheckIcon, StarIcon } from '@phosphor-icons/react'
import { mockServiceCategories } from '../../data/mockData'
import { findCategory } from '../../utils/categoryPhoto'
import { useLocalStorage } from '../../hooks/useLocalStorage'
import HowSteps from './HowSteps'
import TrustArt from '../../components/TrustArt'
import EarnArt from '../../components/EarnArt'
import { useRevealOnScroll } from '../../hooks/useRevealOnScroll'
import { useLiveListings } from '../../hooks/useLiveListings'
import CityPicker from '../../components/CityPicker'
import { useRankedProviders } from '../../hooks/useRankedProviders'
import { usePlatformStats } from '../../hooks/usePlatformStats'
import { ArcHeadline, HeroStars } from '../../components/HeroArt'
import { BosniaArt, SCENES, useShuffle } from '../../components/BosniaArt'
import { POPULAR_CITIES } from '../../data/siteMap'
import { withBase } from '../../utils/paths'
import SpotlightCard from '../../components/reactbits/SpotlightCard'
import '../../components/reactbits/SpotlightCard.css'
import { useDesktopHomeMotion } from './homeMotion'

const categoryCards = [
  ...mockServiceCategories.map((category) => ({
    ...category,
    target: `/search?category=${encodeURIComponent(category.name)}`,
  })),
  {
    id: 'something-else',
    name: 'Nešto drugo',
    description: 'Opiši svojim riječima šta ti treba',
    image: withBase('/images/categories/profile.webp'),
    target: '/objavi',
  },
]

/** A job without its own photo: its category's icon, not a photo of some other kind of work. */
function CategoryTile({ category }) {
  const Icon = (findCategory(category) || findCategory('Ostalo')).icon
  return (
    <div className="job-card-icon-tile" aria-hidden="true">
      <Icon size={44} weight="duotone" />
    </div>
  )
}

function DesktopHome() {
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')
  const [city, setCity] = useState('Sarajevo')
  const [cityPickerOpen, setCityPickerOpen] = useState(false)
  const [savedTasks, setSavedTasks] = useLocalStorage('zadatak-saved-tasks', [])
  const isTouch = useMemo(() => typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches, [])
  const { listings: allTasks, loading: listingsLoading } = useLiveListings({ limit: 6 })
  const { providers } = useRankedProviders(6)
  const { proof, rating, loading: statsLoading } = usePlatformStats()
  const filteredTasks = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    if (!query) return allTasks
    return allTasks.filter((task) => `${task.title} ${task.category} ${task.tag} ${task.location}`.toLowerCase().includes(query))
  }, [searchTerm, allTasks])

  // the most trusted real provider, shown big only once real clients have rated them
  const featuredProvider = useMemo(() => {
    const top = providers.find((p) => p.review_count > 0)
    if (!top) return null
    return {
      userId: top.user_id,
      name: top.display_name || 'Korisnik Zadatka',
      photo: top.avatar_url,
      rating: Number(top.avg_rating).toFixed(1),
      reviewLabel: `${top.review_count} ${top.review_count === 1 ? 'ocjena' : 'ocjena'}`,
      jobsLabel: `${top.active_listings} ${top.active_listings === 1 ? 'aktivan oglas' : 'aktivnih oglasa'}`,
      city: top.city,
      badges: [top.is_verified ? 'Verifikovan' : null, top.badge_count > 0 ? `${top.badge_count} znački` : null].filter(Boolean),
    }
  }, [providers])

  const sceneIndex = useShuffle(SCENES.length, 9000)
  useRevealOnScroll()
  const shellRef = useRef(null)
  useDesktopHomeMotion(shellRef)

  return (
    <div className="marketplace-shell" ref={shellRef}>

      <main>
        <section className="hero-stage" id="pocetna">
          <HeroStars />
          {/* Mostar, Baščaršija, ćevapi i navijači: one scene at a time, a random other one every few seconds */}
          {SCENES.map((scene, i) => (
            <div key={scene.key} className={`hero-scene bz-turn ${i === sceneIndex ? 'is-on' : ''}`} aria-hidden="true">
              <BosniaArt name={scene.left} className="hero-scene-left" />
              <BosniaArt name={scene.right} className="hero-scene-right" />
            </div>
          ))}

          <div className="hero-stage-inner">
            <ArcHeadline />
            <p className="hero-stage-tagline">Objavi posao. Izaberi najboljeg. Riješeno.</p>

            <div className="hero-stage-actions">
              <Link to="/objavi" className="hero-btn hero-btn-primary">Objavi posao besplatno <ArrowRight size={18} /></Link>
              <Link to="/zaradi" className="hero-btn hero-btn-light">Zaradi kao izvođač</Link>
            </div>

            <form
              className="search-panel hero-search"
              onSubmit={(event) => {
                event.preventDefault()
                const params = new URLSearchParams()
                if (searchTerm.trim()) params.set('q', searchTerm.trim())
                if (city.trim()) params.set('city', city.trim())
                navigate(`/search${params.toString() ? `?${params.toString()}` : ''}`)
              }}
            >
              <div className="search-field">
                <Search size={18} />
                <input type="text" value={searchTerm} placeholder="Popravka kuće, web dizajn, IT podrška" aria-label="Šta ti treba?" onChange={(event) => setSearchTerm(event.target.value)} />
              </div>
              <button type="button" className="search-field location-field city-picker-trigger" onClick={() => setCityPickerOpen(true)}>
                <MapPin size={18} />
                <span>{city || 'Svi gradovi'}</span>
              </button>
              <button type="submit" className="primary-button large-button">
                Pretraži
              </button>
            </form>

            <div className="hero-cities">
              <span>Popularni gradovi:</span>
              {POPULAR_CITIES.map((name) => (
                <Link key={name} to={`/search?city=${encodeURIComponent(name)}`}>{name}</Link>
              ))}
            </div>

            <div className={`hero-proof ${statsLoading ? 'is-loading' : ''}`}>
              {proof.map(({ key, icon: Icon, value, label }) => (
                <span key={key}><Icon size={17} /> <strong>{value}</strong> {label}</span>
              ))}
            </div>

            {rating ? (
              <div className="hero-rating">
                <span className="hero-rating-stars" aria-label={`${rating.value} od 5`}>
                  {[1, 2, 3, 4, 5].map((n) => <Star key={n} size={14} className={n <= rating.stars ? 'lit' : ''} />)}
                </span>
                <strong>{rating.value}</strong> ‘{rating.word}’ <span className="hero-rating-count">({rating.count} {rating.count === 1 ? 'ocjena' : 'ocjena'})</span>
              </div>
            ) : (
              <div className="hero-rating hero-rating-trust">
                <span><BadgeCheck size={14} /> Verifikovana struka</span>
                <span><ShieldCheck size={14} /> Zaštićeni kontakti</span>
                <span><Wallet size={14} /> Objava besplatna</span>
              </div>
            )}
          </div>
        </section>

        {!listingsLoading && allTasks.length > 0 && (
          <section className="ticker-section reveal">
            <div className="section-heading">
              <div>
                <span className="eyebrow small-eyebrow">Uživo</span>
                <h2>Pogledajte šta se radi upravo sada</h2>
              </div>
            </div>
            <div className="ticker-track-wrap">
              <div className="ticker-track">
                {(isTouch ? allTasks : [...allTasks, ...allTasks]).map((task, index) => (
                  <div
                    key={`${task.id}-${index}`}
                    className="ticker-card"
                    onClick={() => navigate(`/listings/${task.id}`)}
                  >
                    <div className="ticker-card-top">
                      <div className="ticker-avatar">{(task.freelance || task.tag || 'P').charAt(0)}</div>
                      <span className="ticker-tag">{task.tag}</span>
                    </div>
                    <strong>{task.title}</strong>
                    <div className="ticker-foot">
                      <span className="rating-box"><MapPin size={12} /> {(task.location || '').split(',')[0] || 'Online'}</span>
                      <span className="ticker-price">{task.price}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="post-task-section reveal" id="kategorije">
          <div className="post-task-copy">
            <span className="eyebrow small-eyebrow">Počni odmah</span>
            <h2>Objavi svoj posao<br />za par sekundi</h2>
            <p>Uštedi sate traženja i završi svoju listu obaveza.</p>
            <ol className="post-task-steps">
              <li><span>1</span> Opiši šta ti treba</li>
              <li><span>2</span> Postavi svoj budžet</li>
              <li><span>3</span> Primi ponude i izaberi najboljeg</li>
            </ol>
            <button type="button" className="primary-button large-button" onClick={() => navigate('/objavi')}>
              Objavi posao
            </button>
            <a className="post-task-learn" href="#kako-radi">
              Pogledaj kako Zadatak radi <ArrowRight size={15} />
            </a>
          </div>

          <div className="post-task-categories">
            {categoryCards.map(({ id, name, image, description, target }) => (
              <button
                key={id}
                type="button"
                className="post-cat-card"
                onClick={() => navigate(target)}
              >
                {/* shown at 54 px: a 162 px thumbnail instead of the 720 px cover photo */}
                <img src={image.replace('/images/categories/', '/images/categories/thumb/')} alt="" width="54" height="54" loading="lazy" decoding="async" />
                <div>
                  <strong>{name}</strong>
                  <span>{description}</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        {(listingsLoading || allTasks.length > 0) && <section className="jobs-section reveal" id="poslovi">
          <div className="section-heading">
            <div>
              <span className="eyebrow small-eyebrow">Uživo na platformi</span>
              <h2>Najtraženiji poslovi u vašoj blizini</h2>
            </div>
            <a href="#" onClick={(event) => { event.preventDefault(); navigate('/search') }}>Pogledaj sve <ArrowRight size={16} /></a>
          </div>

          <div className="job-list reveal-stagger reveal">
            {listingsLoading && [1, 2].map((item) => <div className="skeleton-card" key={item} />)}
            {!listingsLoading && filteredTasks.map((task) => (
              <article
                key={task.id}
                className="job-card job-card-live"
                onClick={() => navigate(`/listings/${task.id}`)}
                role="link"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    navigate(`/listings/${task.id}`)
                  }
                }}
              >
                <div className="job-card-image">
                  {task.image
                    ? <img src={task.image} alt={task.title} loading="lazy" />
                    : <CategoryTile category={task.category} />}
                  <div className="job-topline">
                    <span className="tag">{task.tag}</span>
                    <button
                      type="button"
                      className="save-button"
                      onClick={(event) => {
                        event.stopPropagation()
                        setSavedTasks((current) => current.includes(task.id) ? current.filter((id) => id !== task.id) : [...current, task.id])
                      }}
                    >
                      {savedTasks.includes(task.id) ? 'Sačuvano' : 'Sačuvaj'}
                    </button>
                  </div>
                  <span className="live-badge">Novo</span>
                </div>
                <div className="job-card-body">
                  <h3>{task.title}</h3>
                  <div className="job-meta">
                    <span>
                      <MapPin size={14} /> {task.location}
                    </span>
                    <span>{task.time}</span>
                  </div>
                  <div className="job-footer">
                    <div className="offers-badge"><Users size={14} /> {task.offers} {task.offers === 1 ? 'ponuda' : 'ponuda'}</div>
                    <div className="job-price">{task.price}</div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>}

        <section className="trust-section reveal">
          <div className="trust-visual">
            <TrustArt />
          </div>
          <div>
            <h2>Zaštita koja vam donosi mir</h2>
            <div className="trust-list">
              <div className="trust-item">
                <div className="trust-item-icon"><ChatCircleIcon size={30} weight="duotone" /></div>
                <div>
                  <strong>Zaštićena komunikacija</strong>
                  <p>Kontakt podaci ostaju sakriveni dok zvanično ne prihvatite ponudu, bez neželjenih poziva.</p>
                </div>
              </div>
              <div className="trust-item">
                <div className="trust-item-icon"><StarIcon size={30} weight="duotone" /></div>
                <div>
                  <strong>Provjerene ocjene i recenzije</strong>
                  <p>Svaka ocjena dolazi od stvarno završenog posla, tako da birate na osnovu pravog iskustva.</p>
                </div>
              </div>
              <div className="trust-item">
                <div className="trust-item-icon"><ShieldCheckIcon size={30} weight="duotone" /></div>
                <div>
                  <strong>Moderacija i podrška 7 dana sedmično</strong>
                  <p>Naš tim i AI podrška prate platformu i tu su za svako pitanje ili prijavu problema.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {featuredProvider && (
          <section className="featured-tasker reveal">
            <div className="section-heading centered">
              <div>
                <span className="eyebrow small-eyebrow">Zajednica</span>
                <h2>Naši izvođači već grade svoj posao ovdje</h2>
              </div>
            </div>
            <div className="featured-tasker-card">
              <div className="featured-tasker-photo-wrap">
                {featuredProvider.photo
                  ? <img src={featuredProvider.photo} alt={featuredProvider.name} loading="lazy" />
                  : <div className="provider-photo-fallback featured-tasker-photo-fallback"><UserRound size={40} /></div>}
                <div className="featured-tasker-rating-card">
                  <Star size={18} fill="currentColor" color="var(--accent-strong)" />
                  <div>
                    <strong>{featuredProvider.rating}</strong>
                    <span>{featuredProvider.reviewLabel}</span>
                  </div>
                </div>
              </div>
              <div className="featured-tasker-info">
                <h3>{featuredProvider.name}</h3>
                <div className="featured-tasker-stats">
                  <div>
                    <strong>{featuredProvider.jobsLabel}</strong>
                    <span>Aktivnost</span>
                  </div>
                  {featuredProvider.city && (
                    <div>
                      <strong>{featuredProvider.city}</strong>
                      <span>Lokacija</span>
                    </div>
                  )}
                </div>
                <div className="featured-tasker-badges">
                  {featuredProvider.badges.map((badge) => (
                    <span key={badge} className="badge-pill badge-verified">{badge}</span>
                  ))}
                </div>
                <button type="button" className="ghost-button" onClick={() => navigate(`/korisnik/${featuredProvider.userId}`)}>
                  Pogledaj profil
                </button>
              </div>
            </div>
          </section>
        )}

        {providers.length > 0 && (
          <section className="providers-section reveal" id="pruzatelji">
            <div className="section-heading">
              <div>
                <span className="eyebrow small-eyebrow">Izvođači</span>
                <h2>Izvođači sa Zadatka</h2>
              </div>
              <a href="#" onClick={(event) => { event.preventDefault(); navigate('/search') }}>Svi stručnjaci <ArrowRight size={16} /></a>
            </div>

            <div className="provider-grid reveal-stagger reveal">
              {providers.map((provider) => {
                const name = provider.display_name || 'Korisnik Zadatka'
                const badgeLabel = provider.is_verified ? 'Verifikovan' : (provider.badge_count > 0 ? `${provider.badge_count} znački` : 'Aktivan')
                return (
                  <div key={provider.user_id} className="provider-card">
                    <div className="provider-header">
                      {provider.avatar_url
                        ? <img className="provider-photo" src={provider.avatar_url} alt={name} loading="lazy" />
                        : <div className="provider-photo provider-photo-fallback"><UserRound size={26} /></div>}
                      <div className={`provider-badge ${provider.is_verified ? 'provider-badge-verified' : ''}`}>{badgeLabel}</div>
                    </div>
                    <h3>{name}</h3>
                    <p>{provider.city || 'Bosna i Hercegovina'}</p>
                    <div className="provider-stats">
                      {provider.review_count > 0 && <span className="rating-inline"><Star size={14} fill="currentColor" /> {Number(provider.avg_rating).toFixed(1)}</span>}
                      <span>{provider.active_listings} {provider.active_listings === 1 ? 'aktivan oglas' : 'aktivnih oglasa'}</span>
                    </div>
                    <button type="button" className="ghost-button full-width" onClick={() => navigate(`/korisnik/${provider.user_id}`)}>
                      Pogledaj profil
                    </button>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        <section className="how-it-works reveal" id="kako-radi">
          <HowSteps />
        </section>

        <section className="boss-band reveal">
          <div className="boss-band-copy">
            <span className="eyebrow small-eyebrow">Zarada</span>
            <h2>Budi svoj šef.</h2>
            <p>Bilo da si majstor, dizajner ili IT stručnjak — pronađi svoj sljedeći posao na Zadatku.</p>
            <ul className="boss-checklist">
              <li><Check size={16} /> Besplatan pristup svim poslovima</li>
              <li><Check size={16} /> Bez pretplate za osnovno korištenje</li>
              <li><Check size={16} /> Zaradi dodatni prihod po svom rasporedu</li>
              <li><Check size={16} /> Izgradi svoj biznis i bazu klijenata</li>
            </ul>
            <button type="button" className="boss-band-button" onClick={() => navigate('/zaradi')}>
              Zaradi sa Zadatkom <ArrowRight size={16} />
            </button>
          </div>
          <div className="boss-band-visual">
            <div className="boss-band-visual-image boss-band-art">
              <EarnArt />
            </div>
          </div>
        </section>

        <section className="pricing-section reveal" id="cijene">
          <div className="section-heading centered">
            <div>
              <span className="eyebrow small-eyebrow">Cijene</span>
              <h2>Za klijente besplatno. Izvođač plaća samo kad je posao plaćen.</h2>
            </div>
          </div>

          <div className="fee-grid reveal-stagger reveal">
            <SpotlightCard className="fee-card" theme="light" spotlightColor="#1f5fff" intensity={0.5}>
              <span className="fee-card-eyebrow">Klijenti</span>
              <strong className="fee-card-big">0 KM</strong>
              <p>Objava posla, primanje ponuda, poruke i recenzije — sve bez naknade i bez pretplate.</p>
              <ul>
                <li><Check size={15} /> Neograničen broj poslova</li>
                <li><Check size={15} /> Cijenu biraš iz ponuda</li>
                <li><Check size={15} /> Uplata se čuva dok posao ne potvrdiš</li>
              </ul>
            </SpotlightCard>
            <SpotlightCard className="fee-card featured" theme="light" spotlightColor="#1f5fff" intensity={0.6}>
              <span className="fee-card-eyebrow">Izvođači</span>
              <strong className="fee-card-big">9–15%</strong>
              <p>Naknada platforme samo od plaćenog posla — nikad za slanje ponuda. Što više radiš, niža je: Bronza 15%, Srebro 13%, Zlato 11%, Platina 9%.</p>
              <ul>
                <li><Check size={15} /> Ponude i profil besplatni</li>
                <li><Check size={15} /> Zarada sjeda na Balans</li>
                <li><Check size={15} /> Nivo raste sa prometom</li>
              </ul>
              <Link to="/nivoi" className="secondary-button plan-button">Kako rade nivoi</Link>
            </SpotlightCard>
            <SpotlightCard className="fee-card" theme="light" spotlightColor="#1f5fff" intensity={0.5}>
              <span className="fee-card-eyebrow">Sigurno plaćanje</span>
              <strong className="fee-card-big">Balans</strong>
              <p>Klijent uplati unaprijed, novac stoji na Zadatku dok posao nije završen, pa se oslobađa izvođaču. Spor? Tim pregleda i odluči.</p>
              <ul>
                <li><Check size={15} /> Nema plaćanja unaprijed „na ruke“</li>
                <li><Check size={15} /> Povrat kod otkaza prije početka</li>
                <li><Check size={15} /> Historija svake uplate</li>
              </ul>
              <Link to="/cijene" className="secondary-button plan-button">Sve o cijenama</Link>
            </SpotlightCard>
          </div>
        </section>

        <section className="cta-strip reveal">
          <div>
            <span className="eyebrow small-eyebrow">Počni odmah</span>
            <h2>Napravite svoj račun i pronađite rješenje za svaki posao.</h2>
          </div>
          <button type="button" className="primary-button" onClick={() => navigate('/register')}>
            Registruj se sada
          </button>
        </section>

        <section className="country-strip reveal" aria-label="Regija">
          <span className="country-flag" title="Zastava Bosne i Hercegovine" aria-hidden="true">
            <svg viewBox="0 0 640 480" width="32" height="24" style={{ borderRadius: 3, boxShadow: '0 0 0 1px rgba(10, 31, 99, 0.12)' }}>
              <clipPath id="bih-flag-clip">
                <path d="M-85.3 0h682.6v512H-85.3z" />
              </clipPath>
              <g fillRule="evenodd" clipPath="url(#bih-flag-clip)" transform="translate(80)scale(.9375)">
                <path fill="#009" d="M-85.3 0h682.6v512H-85.3z" />
                <path fill="#FC0" d="m56.5 0 511 512.3V.3z" />
                <path fill="#FFF" d="M439.9 481.5 412 461.2l-28.6 20.2 10.8-33.2-28.2-20.5h35l10.8-33.2 10.7 33.3h35l-28 20.7zm81.3 10.4-35-.1-10.7-33.3-10.8 33.2h-35l28.2 20.5-10.8 33.2 28.6-20.2 28 20.3-10.5-33zM365.6 384.7l28-20.7-35-.1-10.7-33.2-10.8 33.2-35-.1 28.2 20.5-10.8 33.3 28.6-20.3 28 20.4zm-64.3-64.5 28-20.6-35-.1-10.7-33.3-10.9 33.2h-34.9l28.2 20.5-10.8 33.2 28.6-20.2 27.9 20.3zm-63.7-63.6 28-20.7h-35L220 202.5l-10.8 33.2h-35l28.2 20.4-10.8 33.3 28.6-20.3 28 20.4-10.5-33zm-64.4-64.3 28-20.6-35-.1-10.7-33.3-10.9 33.2h-34.9L138 192l-10.8 33.2 28.6-20.2 27.9 20.3-10.4-33zm-63.6-63.9 27.9-20.7h-35L91.9 74.3 81 107.6H46L74.4 128l-10.9 33.2L92.1 141l27.8 20.4zm-64-64 27.9-20.7h-35L27.9 10.3 17 43.6h-35L10.4 64l-11 33.3L28.1 77l27.8 20.4zm-64-64L9.4-20.3h-35l-10.7-33.3L-47-20.4h-35L-53.7 0l-10.8 33.2L-35.9 13l27.8 20.4z" />
              </g>
            </svg>
          </span>
          <span>Bosna i Hercegovina</span>
        </section>
      </main>

      {cityPickerOpen && <CityPicker value={city} onChange={setCity} onClose={() => setCityPickerOpen(false)} />}

    </div>
  )
}


export default DesktopHome
