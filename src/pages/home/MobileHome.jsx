import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight, BadgeCheck, ChevronDown, Hammer, Home, Laptop, Leaf, LayoutGrid, Lock, MapPin, Monitor,
  Palette, Search, ShieldCheck, Sparkles, Star, Truck, Users, Wallet, Zap,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { mockServiceCategories } from '../../data/mockData'
import { POPULAR_CITIES } from '../../data/siteMap'
import { useLiveListings } from '../../hooks/useLiveListings'
import { useRankedProviders } from '../../hooks/useRankedProviders'
import { usePlatformStats } from '../../hooks/usePlatformStats'
import { matchService } from '../../services/matchService'
import CityPicker from '../../components/CityPicker'
import EarnArt from '../../components/EarnArt'
import { haptic } from '../../utils/native'
import { prefetchRoute } from '../../utils/prefetch'
import './mobile-home.css'

const CATEGORY_ICONS = { home: Home, sparkles: Sparkles, laptop: Laptop, palette: Palette, hammer: Hammer, zap: Zap, truck: Truck, leaf: Leaf, monitor: Monitor }
const QUICK = ['Popravke', 'Čišćenje', 'Selidbe', 'IT', 'Dizajn', 'Elektrika']

const greeting = () => {
  const hour = new Date().getHours()
  if (hour < 10) return 'Dobro jutro'
  if (hour < 18) return 'Dobar dan'
  return 'Dobro veče'
}

/**
 * Phone home screen: an app-style feed (search, category "stories", nearby jobs, providers)
 * instead of the long marketing page. Rendered by HomePage at ≤768px.
 */
function MobileHome() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [city, setCity] = useState(() => { try { return localStorage.getItem('poso-city') || 'Sarajevo' } catch { return 'Sarajevo' } })
  const [cityOpen, setCityOpen] = useState(false)
  const { combined: jobs, hasLive, loading } = useLiveListings({ limit: 8 })
  const { combined: providers, hasLive: hasLiveProviders, loading: providersLoading } = useRankedProviders(6)
  const { stats, rating } = usePlatformStats()
  const [recommended, setRecommended] = useState([])
  const jobsRailRef = useRef(null)

  // live jobs are inserted in front of the demo cards; keep the rail at its start when they arrive
  useEffect(() => { if (jobsRailRef.current) jobsRailRef.current.scrollLeft = 0 }, [hasLive])

  useEffect(() => { try { localStorage.setItem('poso-city', city) } catch { /* ignore */ } }, [city])

  useEffect(() => {
    if (!user) { setRecommended([]); return undefined }
    let alive = true
    matchService.recommendedListings(4).then((rows) => alive && setRecommended(rows || [])).catch(() => {})
    return () => { alive = false }
  }, [user])

  const firstName = useMemo(() => (user?.user_metadata?.full_name || '').split(' ')[0], [user])

  const search = (event) => {
    event?.preventDefault()
    const params = new URLSearchParams()
    if (query.trim()) params.set('q', query.trim())
    if (city && city !== 'Cijela BiH') params.set('city', city)
    haptic('light')
    navigate(`/search${params.toString() ? `?${params}` : ''}`)
  }

  const openListings = stats?.open_listings
  const proofLine = [
    openListings > 0 ? `${openListings} otvoren${openListings === 1 ? '' : openListings < 5 ? 'a' : 'ih'} posl${openListings === 1 ? 'ao' : openListings < 5 ? 'a' : 'ova'}` : null,
    rating ? `${rating.value} ★ prosjek` : null,
    'Sigurna uplata',
  ].filter(Boolean)

  return (
    <div className="mh">
      {/* ---------- hero ---------- */}
      <section className="mh-hero">
        <div className="mh-aurora" aria-hidden="true"><span /><span /><span /></div>
        <div className="mh-top">
          <div>
            <span className="mh-greet">{greeting()}{firstName ? `, ${firstName}` : ''} 👋</span>
            <h1>Šta ti treba<br />danas?</h1>
          </div>
          <button type="button" className="mh-city" onClick={() => setCityOpen(true)} aria-label="Promijeni grad">
            <MapPin size={15} /> <span>{city}</span> <ChevronDown size={14} />
          </button>
        </div>

        <form className="mh-search" onSubmit={search}>
          <Search size={20} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Popravka, čišćenje, web dizajn…" enterKeyHint="search" />
          <button type="submit" aria-label="Pretraži"><ArrowRight size={18} /></button>
        </form>

        <div className="mh-quick" role="list">
          {QUICK.map((item) => (
            <button key={item} type="button" role="listitem" onClick={() => { setQuery(item); navigate(`/search?q=${encodeURIComponent(item)}${city && city !== 'Cijela BiH' ? `&city=${encodeURIComponent(city)}` : ''}`) }}>{item}</button>
          ))}
        </div>

        <div className="mh-proof">
          {proofLine.map((item, index) => <span key={item}>{index > 0 && <i>·</i>}{item}</span>)}
        </div>
      </section>

      {/* ---------- categories as stories ---------- */}
      <section className="mh-section">
        <div className="mh-head"><h2>Kategorije</h2><Link to="/search">Sve <ArrowRight size={14} /></Link></div>
        <div className="mh-stories">
          {mockServiceCategories.map((category, index) => {
            const Icon = CATEGORY_ICONS[category.icon] || LayoutGrid
            return (
              <Link key={category.id} to={`/search?category=${encodeURIComponent(category.name)}`} className="mh-story" style={{ '--i': index }} onClick={() => haptic('light')}>
                <span className="mh-story-ring"><span className="mh-story-icon"><Icon size={22} /></span></span>
                <span className="mh-story-label">{category.name.split(' i ')[0].split(' za ')[0]}</span>
              </Link>
            )
          })}
          <Link to="/objavi" className="mh-story mh-story-other" style={{ '--i': mockServiceCategories.length }}>
            <span className="mh-story-ring"><span className="mh-story-icon"><LayoutGrid size={22} /></span></span>
            <span className="mh-story-label">Nešto drugo</span>
          </Link>
        </div>
      </section>

      {/* ---------- post CTA ---------- */}
      <section className="mh-section">
        <Link to="/objavi" className="mh-post" onClick={() => haptic('medium')}>
          <div className="mh-post-glow" aria-hidden="true" />
          <div>
            <span className="mh-post-eyebrow"><Sparkles size={14} /> Besplatno</span>
            <strong>Objavi posao, ponude stižu za manje od sat</strong>
            <span className="mh-post-sub">Opiši šta treba, izaberi najboljeg, plati kad je gotovo.</span>
          </div>
          <span className="mh-post-arrow"><ArrowRight size={20} /></span>
        </Link>
      </section>

      {/* ---------- recommended (signed in) ---------- */}
      {recommended.length > 0 && (
        <section className="mh-section">
          <div className="mh-head"><h2>Preporučeno za tebe</h2><Link to="/account">Zašto? <ArrowRight size={14} /></Link></div>
          <div className="mh-rail">
            {recommended.map((item) => (
              <Link key={item.id} to={`/listings/${item.id}`} className="mh-rec">
                <span className="mh-rec-score"><Sparkles size={12} /> {Math.round(item.match_score)}% match</span>
                <strong>{item.title}</strong>
                <span className="mh-rec-meta"><MapPin size={13} /> {item.location || 'Bez lokacije'} · {item.price == null ? 'Po dogovoru' : `${Number(item.price).toLocaleString('bs-BA')} KM`}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ---------- jobs ---------- */}
      <section className="mh-section">
        <div className="mh-head"><h2>{hasLive ? 'Novi poslovi' : 'Primjeri poslova'}</h2><Link to="/search">Vidi sve <ArrowRight size={14} /></Link></div>
        <div className="mh-rail mh-rail-jobs" ref={jobsRailRef}>
          {loading && jobs.length === 0 && [1, 2, 3].map((n) => <div key={n} className="mh-job mh-skeleton" />)}
          {jobs.map((job, index) => (
            <Link key={job.id} to={job.isLive ? `/listings/${job.id}` : '/search'} className="mh-job" style={{ '--i': index }} onPointerDown={() => prefetchRoute(job.isLive ? '/listings' : '/search')}>
              <div className="mh-job-media">
                <img src={job.image} alt="" loading="lazy" decoding="async" />
                <span className="mh-job-price">{job.price}</span>
                {job.isLive && <span className="mh-job-live">Uživo</span>}
              </div>
              <strong>{job.title}</strong>
              <span className="mh-job-meta"><MapPin size={13} /> {job.location.split(',')[0]}</span>
              <span className="mh-job-foot"><span className="mh-job-tag">{job.tag}</span><span><Users size={13} /> {job.offers ?? job.reviews ?? 0} ponuda</span></span>
            </Link>
          ))}
        </div>
      </section>

      {/* ---------- providers ---------- */}
      <section className="mh-section">
        <div className="mh-head"><h2>Top izvođači</h2><Link to="/search">Pronađi <ArrowRight size={14} /></Link></div>
        <div className="mh-rail mh-rail-pro">
          {providersLoading && [1, 2, 3].map((n) => <div key={n} className="mh-pro mh-skeleton mh-skeleton-pro" />)}
          {!providersLoading && providers.slice(0, 6).map((pro, index) => {
            const live = hasLiveProviders && !pro.isDemo
            const name = live ? (pro.display_name || 'Korisnik Poso.ba') : pro.name
            const photo = live ? pro.avatar_url : pro.photo
            const ratingValue = live ? (pro.avg_rating > 0 ? Number(pro.avg_rating).toFixed(1) : null) : pro.rating
            const sub = live ? (pro.city || 'BiH') : pro.role
            const verified = live ? pro.is_verified : true
            const to = live ? `/korisnik/${pro.user_id}` : '/zaradi'
            return (
              <Link key={live ? pro.user_id : pro.id} to={to} className="mh-pro" style={{ '--i': index }}>
                <span className={`mh-pro-avatar ${verified ? 'is-verified' : ''}`}>
                  {photo ? <img src={photo} alt="" loading="lazy" /> : <span className="mh-pro-initial">{name.slice(0, 1)}</span>}
                  {verified && <BadgeCheck size={16} className="mh-pro-check" />}
                </span>
                <strong>{name}</strong>
                <span className="mh-pro-sub">{sub}</span>
                {ratingValue ? <span className="mh-pro-rating"><Star size={12} /> {ratingValue}</span> : <span className="mh-pro-rating is-new">Novo</span>}
              </Link>
            )
          })}
        </div>
      </section>

      {/* ---------- how it works ---------- */}
      <section className="mh-section">
        <div className="mh-head"><h2>Kako radi</h2><Link to="/kako-radi">Detalji <ArrowRight size={14} /></Link></div>
        <div className="mh-rail mh-rail-steps">
          {[
            ['1', 'Objavi posao', 'Opiši šta treba, dodaj slike i okvirni budžet.', Sparkles],
            ['2', 'Izaberi ponudu', 'Uporedi cijene, ocjene i značke izvođača.', Users],
            ['3', 'Plati sigurno', 'Novac se čuva na Poso.ba dok posao ne bude gotov.', Lock],
          ].map(([n, title, text, Icon]) => (
            <div key={n} className="mh-step">
              <span className="mh-step-n">{n}</span>
              <Icon size={20} className="mh-step-icon" />
              <strong>{title}</strong>
              <span>{text}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- trust ---------- */}
      <section className="mh-section">
        <div className="mh-trust">
          <div><span className="mh-trust-icon"><Wallet size={18} /></span><div><strong>Poso.ba Pay</strong><span>Uplata je rezervisana i oslobađa se tek kad potvrdiš da je posao urađen.</span></div></div>
          <div><span className="mh-trust-icon"><ShieldCheck size={18} /></span><div><strong>Pravilo #1</strong><span>Brojevi i kontakti se razmjenjuju tek nakon prihvaćene ponude — bez prevara.</span></div></div>
          <div><span className="mh-trust-icon"><BadgeCheck size={18} /></span><div><strong>Provjereni izvođači</strong><span>Značke, ocjene i istorija poslova na svakom profilu.</span></div></div>
        </div>
      </section>

      {/* ---------- earn ---------- */}
      <section className="mh-section">
        <Link to="/zaradi" className="mh-earn">
          <div className="mh-earn-art"><EarnArt /></div>
          <div>
            <strong>Zaradi kao izvođač</strong>
            <span>Biraj poslove u svom gradu, šalji ponude, naplati preko balansa.</span>
            <span className="mh-earn-cta">Postani izvođač <ArrowRight size={14} /></span>
          </div>
        </Link>
      </section>

      {/* ---------- cities ---------- */}
      <section className="mh-section mh-section-last">
        <div className="mh-head"><h2>Gradovi</h2></div>
        <div className="mh-cities">
          {POPULAR_CITIES.map((name) => <Link key={name} to={`/search?city=${encodeURIComponent(name)}`}>{name}</Link>)}
        </div>
      </section>

      {cityOpen && <CityPicker value={city} onChange={setCity} onClose={() => setCityOpen(false)} />}
    </div>
  )
}

export default MobileHome
