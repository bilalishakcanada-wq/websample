import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  BadgeCheck,
  Bell,
  BriefcaseBusiness,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronRight,
  CreditCard,
  Hammer,
  Home,
  Laptop,
  Leaf,
  MapPin,
  MessageCircle,
  MonitorPlay,
  Paintbrush,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Truck,
  UserRound,
  Users,
  Wallet,
  Zap,
} from 'lucide-react'
import { mockCredits, mockPlans, mockProfessionals, mockServiceCategories, mockTasks } from '../data/mockData'
import { serviceCategories } from '../data/categories'
import MobileNav from '../components/MobileNav'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { useRevealOnScroll } from '../hooks/useRevealOnScroll'
import { useLiveListings } from '../hooks/useLiveListings'
import CitySlideshow from '../components/CitySlideshow'
import CityPicker from '../components/CityPicker'
import { useRankedProviders } from '../hooks/useRankedProviders'

const categories = mockServiceCategories.map((category) => ({
  ...category,
  icon: {
    home: Home,
    laptop: Laptop,
    palette: Paintbrush,
    hammer: Hammer,
    monitor: MonitorPlay,
    users: Users,
    sparkles: Sparkles,
    zap: Zap,
    truck: Truck,
    leaf: Leaf,
  }[category.icon],
}))

function HomePage() {
  const navigate = useNavigate()
  const [selectedPlan, setSelectedPlan] = useState('plus')
  const [selectedCredit, setSelectedCredit] = useState('50')
  const [searchTerm, setSearchTerm] = useState('')
  const [city, setCity] = useState('Sarajevo')
  const [cityPickerOpen, setCityPickerOpen] = useState(false)
  const [savedTasks, setSavedTasks] = useLocalStorage('poso-saved-tasks', [])
  const [notice, setNotice] = useState('')
  const [categoriesOpen, setCategoriesOpen] = useState(false)
  const [navMode, setNavMode] = useState('client')
  const { combined: allTasks, hasLive, loading: listingsLoading } = useLiveListings({ limit: 6 })
  const { combined: providers, hasLive: hasLiveProviders } = useRankedProviders(6)
  const filteredTasks = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    if (!query) return allTasks
    return allTasks.filter((task) => `${task.title} ${task.category} ${task.tag} ${task.location}`.toLowerCase().includes(query))
  }, [searchTerm, allTasks])

  const featuredProvider = useMemo(() => {
    if (hasLiveProviders && providers.length > 0) {
      const top = providers[0]
      return {
        isLive: true,
        userId: top.user_id,
        name: top.full_name || 'Korisnik Poso.ba',
        photo: top.avatar_url,
        rating: top.avg_rating > 0 ? Number(top.avg_rating).toFixed(1) : '—',
        reviewLabel: top.review_count > 0 ? `${top.review_count} ${top.review_count === 1 ? 'ocjena' : 'ocjena'}` : 'Nova na platformi',
        jobsLabel: `${top.active_listings} ${top.active_listings === 1 ? 'aktivan oglas' : 'aktivnih oglasa'}`,
        city: top.city,
        specialties: null,
        badges: [top.is_verified ? 'Verifikovan' : null, top.badge_count > 0 ? `${top.badge_count} znački` : null].filter(Boolean),
        quote: null,
      }
    }
    const demo = mockProfessionals[0]
    return {
      isLive: false,
      userId: null,
      name: demo.name,
      photo: demo.photo,
      rating: demo.rating,
      reviewLabel: `${demo.jobs} ocjena`,
      jobsLabel: `${demo.jobs} završenih poslova`,
      city: 'Sarajevo',
      specialties: demo.role,
      badges: [demo.badge, 'Verifikovan'],
      quote: 'Brz, profesionalan i tačno onako kako smo se dogovorili. Preporučujem svima.',
    }
  }, [hasLiveProviders, providers])

  useRevealOnScroll()

  const showNotice = (message) => {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 3000)
  }

  return (
    <div className="marketplace-shell">
      <header className="topbar">
        <div className="brand-wrap">
          <div className="brand-mark">P</div>
          <div>
            <div className="brand-name">Poso.ba</div>
            <div className="brand-subtitle">Marketplace za usluge</div>
          </div>
        </div>

        <nav className="main-nav" aria-label="Glavna navigacija">
          <div
            className="nav-mega"
            onMouseEnter={() => setCategoriesOpen(true)}
            onMouseLeave={() => setCategoriesOpen(false)}
          >
            <button type="button" className="nav-mega-trigger" onClick={() => setCategoriesOpen(true)}>
              Kategorije <ChevronDown size={14} className={categoriesOpen ? 'rotated' : ''} />
            </button>
            {categoriesOpen && (
              <div className="nav-mega-panel">
                <div className="nav-mega-side">
                  <h4>Šta vam treba?</h4>
                  <p>Izaberite kategoriju da vidite ponudu.</p>
                  <button
                    type="button"
                    className={`nav-mega-mode ${navMode === 'client' ? 'active' : ''}`}
                    onClick={() => setNavMode('client')}
                  >
                    <span>KAO KLIJENT</span>
                    Tražim izvođača za...
                  </button>
                  <button
                    type="button"
                    className={`nav-mega-mode ${navMode === 'provider' ? 'active' : ''}`}
                    onClick={() => setNavMode('provider')}
                  >
                    <span>KAO IZVOĐAČ</span>
                    Tražim posao u...
                  </button>
                </div>
                <div className="nav-mega-grid">
                  {serviceCategories.map(({ id, name, icon: Icon }) => (
                    <a
                      key={id}
                      href="#"
                      onClick={(event) => {
                        event.preventDefault()
                        setCategoriesOpen(false)
                        navigate(navMode === 'provider' ? '/zaradi' : `/search?category=${encodeURIComponent(name)}`)
                      }}
                    >
                      <Icon size={15} /> {name}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
          <a href="#poslovi">Poslovi</a>
          <a href="#" onClick={(event) => { event.preventDefault(); navigate('/zaradi') }}>Zaradi</a>
          <a href="#cijene">Cijene</a>
          <a href="#" onClick={(event) => { event.preventDefault(); navigate('/login') }}>Prijava</a>
        </nav>

        <div className="header-actions">
          <button type="button" className="icon-button" aria-label="Obavijesti" onClick={() => showNotice('Obavijesti će biti dostupne nakon prijave.')}>
            <Bell size={18} />
          </button>
          <button type="button" className="ghost-button" onClick={() => navigate('/login')}>
            Uloguj se
          </button>
          <button type="button" className="primary-button" onClick={() => navigate('/objavi')}>
            Postavi posao
          </button>
        </div>
      </header>

      <main>
        <section className="hero-band" id="pocetna">
          <div className="hero-section">
            <div className="hero-copy">
              <div className="eyebrow">
                <Sparkles size={14} />
                Najbrži način za pronaći pomoć u BiH
              </div>
              <h1 className="hero-headline">
                Uradi bilo šta.<br />
                <span className="hero-headline-accent">Odmah.</span>
              </h1>
              <p>
                Povezujemo vas sa provjerenim stručnjacima za kućne poslove, IT, dizajn,
                popravke i još mnogo toga. Sve u jednom mjestu, na bosanskom jeziku.
              </p>

              <form
                className="search-panel"
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
                  <input type="text" value={searchTerm} placeholder="Popravka kuće, web dizajn, IT podrška" onChange={(event) => setSearchTerm(event.target.value)} />
                </div>
                <button type="button" className="search-field location-field city-picker-trigger" onClick={() => setCityPickerOpen(true)}>
                  <MapPin size={18} />
                  <span>{city || 'Svi gradovi'}</span>
                </button>
                <button type="submit" className="primary-button large-button">
                  Pretraži
                </button>
              </form>

              <div className="hero-stats">
                <div>
                  <strong><Users size={16} /> 18k+</strong>
                  <span>aktivnih pružalaca</span>
                </div>
                <div>
                  <strong><Star size={16} /> 4.9/5</strong>
                  <span>prosječna ocjena</span>
                </div>
                <div>
                  <strong><CalendarClock size={16} /> 2h</strong>
                  <span>prosječno vrijeme odgovora</span>
                </div>
              </div>
            </div>

            <div className="hero-card">
              <div className="hero-image-wrap">
                <CitySlideshow onSelectCity={(selected) => navigate(`/search?city=${encodeURIComponent(selected)}`)} />
              </div>

              <div className="float-card float-card-payment">
                <Wallet size={16} />
                <div>
                  <strong>Isplata primljena!</strong>
                  <span>Montaža namještaja · 180 KM</span>
                </div>
              </div>

              <div className="float-card float-card-earnings">
                <div className="float-card-earnings-top">
                  <span>Ukupna zarada</span>
                  <span className="float-card-trend"><ChevronRight size={12} style={{ transform: 'rotate(-90deg)' }} /> 18%</span>
                </div>
                <strong>2.450 KM</strong>
                <svg viewBox="0 0 100 28" className="float-card-sparkline" preserveAspectRatio="none">
                  <polyline points="0,22 15,18 30,20 45,10 60,14 75,4 90,8 100,2" />
                </svg>
              </div>

              <div className="float-pill float-pill-alert">
                <Bell size={13} /> Nova ponuda!
              </div>

              <div className="mini-panel">
                <div className="status-badge">
                  <BadgeCheck size={16} />
                  Usluga potvrđena
                </div>
                <h3>"IT pomoć za naš ured"</h3>
                <div className="mini-metrics">
                  <span>
                    <Users size={14} /> 28 aplikacija
                  </span>
                  <span>
                    <CalendarClock size={14} /> 1-3 dana
                  </span>
                </div>
                <div className="provider-row">
                  <div className="avatar avatar-one">A</div>
                  <div className="avatar avatar-two">N</div>
                  <div className="avatar avatar-three">L</div>
                </div>
                <button type="button" className="secondary-button" onClick={() => document.getElementById('poslovi')?.scrollIntoView({ behavior: 'smooth' })}>
                  Pogledaj ponude <ChevronRight size={16} />
                </button>
              </div>
            </div>
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
                {[...allTasks, ...allTasks].map((task, index) => (
                  <div
                    key={`${task.id}-${index}`}
                    className="ticker-card"
                    onClick={() => task.isLive && navigate(`/listings/${task.id}`)}
                  >
                    <div className="ticker-card-top">
                      <div className="ticker-avatar">{(task.freelance || task.tag || 'P').charAt(0)}</div>
                      <span className="ticker-tag">{task.tag}</span>
                    </div>
                    <strong>{task.title}</strong>
                    <div className="ticker-foot">
                      <span className="rating-box"><Star size={12} fill="currentColor" /> {task.rating ?? '5.0'}</span>
                      <span className="ticker-price">{task.price}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="categories-section reveal" id="kategorije">
          <div className="section-heading">
            <div>
              <span className="eyebrow small-eyebrow">Popularne kategorije</span>
              <h2>Pronađite uslugu koja vam treba</h2>
            </div>
            <a href="#" onClick={(event) => { event.preventDefault(); navigate('/search') }}>Pregledaj sve <ArrowRight size={16} /></a>
          </div>

          <div className="category-scroll reveal-stagger reveal">
            {categories.map(({ id, name, icon: Icon, image }) => (
              <button
                key={id}
                type="button"
                className="category-card"
                onClick={() => navigate(`/search?category=${encodeURIComponent(name)}`)}
              >
                <img src={image} alt="" loading="lazy" />
                <div className="category-icon">
                  <Icon size={17} />
                </div>
                <span>{name}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="jobs-section reveal" id="poslovi">
          <div className="section-heading">
            <div>
              <span className="eyebrow small-eyebrow">{hasLive ? 'Uživo na platformi' : 'Nedavno objavljeno'}</span>
              <h2>Najtraženiji poslovi u vašoj blizini</h2>
            </div>
            <a href="#" onClick={(event) => { event.preventDefault(); navigate('/search') }}>Pogledaj sve <ArrowRight size={16} /></a>
          </div>

          <div className="job-list reveal-stagger reveal">
            {listingsLoading && [1, 2].map((item) => <div className="skeleton-card" key={item} />)}
            {!listingsLoading && filteredTasks.map((task) => (
              <article
                key={task.id}
                className={`job-card ${task.isLive ? 'job-card-live' : ''}`}
                onClick={() => task.isLive && navigate(`/listings/${task.id}`)}
                role={task.isLive ? 'link' : undefined}
                tabIndex={task.isLive ? 0 : undefined}
                onKeyDown={(event) => {
                  if (task.isLive && (event.key === 'Enter' || event.key === ' ')) {
                    event.preventDefault()
                    navigate(`/listings/${task.id}`)
                  }
                }}
              >
                <div className="job-card-image">
                  <img src={task.image} alt={task.title} loading="lazy" />
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
                  {task.isLive && <span className="live-badge">Novo</span>}
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
                    {task.isLive
                      ? <div className="offers-badge"><Users size={14} /> {task.offers} {task.offers === 1 ? 'ponuda' : 'ponuda'}</div>
                      : <div className="rating-box"><Star size={14} fill="currentColor" /> {task.rating} ({task.reviews})</div>}
                    <div className="job-price">{task.price}</div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="trust-section reveal">
          <div className="trust-visual">
            <img src="/images/categories/home.jpg" alt="Zadovoljan korisnik Poso.ba" loading="lazy" />
            <div className="float-card float-card-payment">
              <BadgeCheck size={16} />
              <div>
                <strong>Posao završen!</strong>
                <span>Ocjena data · 5.0</span>
              </div>
            </div>
            <div className="float-pill float-pill-alert">
              <ShieldCheck size={13} /> Profil verifikovan
            </div>
          </div>
          <div>
            <span className="eyebrow small-eyebrow">Sigurnost i povjerenje</span>
            <h2>Zaštita koja vam donosi mir</h2>
            <div className="trust-list">
              <div className="trust-item">
                <div className="trust-item-icon"><MessageCircle size={20} /></div>
                <div>
                  <strong>Zaštićena komunikacija</strong>
                  <p>Kontakt podaci ostaju sakriveni dok zvanično ne prihvatite ponudu — bez neželjenih poziva.</p>
                </div>
              </div>
              <div className="trust-item">
                <div className="trust-item-icon"><Star size={20} /></div>
                <div>
                  <strong>Provjerene ocjene i recenzije</strong>
                  <p>Svaka ocjena dolazi od stvarno završenog posla, tako da birate na osnovu pravog iskustva.</p>
                </div>
              </div>
              <div className="trust-item">
                <div className="trust-item-icon"><ShieldCheck size={20} /></div>
                <div>
                  <strong>Moderacija i podrška 7 dana sedmično</strong>
                  <p>Naš tim i AI podrška prate platformu i tu su za svako pitanje ili prijavu problema.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="featured-tasker reveal">
          <div className="section-heading centered">
            <div>
              <span className="eyebrow small-eyebrow">Zajednica</span>
              <h2>{featuredProvider.isLive ? 'Naši izvođači već grade svoj posao ovdje' : 'Pridružite se izvođačima koji zarađuju na Poso.ba'}</h2>
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
              {featuredProvider.specialties && (
                <p className="featured-tasker-specialties"><b>Specijalnosti: </b>{featuredProvider.specialties}</p>
              )}
              <div className="featured-tasker-badges">
                {featuredProvider.badges.map((badge) => (
                  <span key={badge} className="badge-pill badge-verified">{badge}</span>
                ))}
              </div>
              {featuredProvider.quote && <blockquote className="featured-tasker-quote">"{featuredProvider.quote}"</blockquote>}
              <button
                type="button"
                className="ghost-button"
                onClick={() => featuredProvider.isLive ? navigate(`/korisnik/${featuredProvider.userId}`) : navigate('/register')}
              >
                {featuredProvider.isLive ? 'Pogledaj profil' : 'Postani izvođač'}
              </button>
            </div>
          </div>
        </section>

        <section className="providers-section reveal" id="pruzatelji">
          <div className="section-heading">
            <div>
              <span className="eyebrow small-eyebrow">Najbolji pružaoci</span>
              <h2>Provjereni profesionalci koje preporučujemo</h2>
            </div>
            <a href="#" onClick={(event) => { event.preventDefault(); navigate('/search') }}>Svi stručnjaci <ArrowRight size={16} /></a>
          </div>

          <div className="provider-grid reveal-stagger reveal">
            {providers.map((provider) => {
              const isLive = !provider.isDemo
              const key = isLive ? provider.user_id : provider.name
              const name = isLive ? (provider.full_name || 'Korisnik Poso.ba') : provider.name
              const photo = isLive ? provider.avatar_url : provider.photo
              const badgeLabel = isLive
                ? (provider.is_verified ? 'Verifikovan' : (provider.badge_count > 0 ? `${provider.badge_count} znački` : 'Aktivan'))
                : provider.badge
              const rating = isLive ? provider.avg_rating : provider.rating
              const jobsLabel = isLive ? `${provider.active_listings} aktivnih oglasa` : `${provider.jobs} završenih poslova`
              const clickTarget = isLive ? () => navigate(`/korisnik/${provider.user_id}`) : () => navigate('/register')

              return (
                <div key={key} className="provider-card">
                  <div className="provider-header">
                    {photo
                      ? <img className="provider-photo" src={photo} alt={name} loading="lazy" />
                      : <div className="provider-photo provider-photo-fallback"><UserRound size={26} /></div>}
                    <div className={`provider-badge ${isLive && provider.is_verified ? 'provider-badge-verified' : ''}`}>{badgeLabel}</div>
                  </div>
                  <h3>{name}</h3>
                  {isLive && provider.display_uid && <span className="uid-chip">{provider.display_uid}</span>}
                  {!isLive && <p>{provider.role}</p>}
                  {isLive && <p>{provider.city || 'Bosna i Hercegovina'}</p>}
                  <div className="provider-stats">
                    {(!isLive || provider.review_count > 0) && <span className="rating-inline"><Star size={14} fill="currentColor" /> {rating}</span>}
                    <span>{jobsLabel}</span>
                  </div>
                  <button type="button" className="ghost-button full-width" onClick={clickTarget}>
                    {isLive ? 'Pogledaj profil' : 'Zatraži ponudu'}
                  </button>
                </div>
              )
            })}
          </div>
          {!hasLiveProviders && <p className="muted-text provider-demo-note">Ovo su ilustrativni primjeri — pravi izvođači će se pojaviti ovdje čim objave svoje prve oglase.</p>}
        </section>

        <section className="how-it-works reveal" id="kako-radi">
          <div className="section-heading centered">
            <div>
              <span className="eyebrow small-eyebrow">Kako radi</span>
              <h2>Jednostavno 3 koraka do željene usluge</h2>
            </div>
          </div>

          <div className="steps-grid reveal-stagger reveal">
            <div className="step-card">
              <div className="step-number">1</div>
              <h3>Objavite posao</h3>
              <p>Recite šta vam treba i postavite budget ili željeni termin.</p>
            </div>
            <div className="step-card">
              <div className="step-number">2</div>
              <h3>Primite ponude</h3>
              <p>Primite ponude od provjerenih stručnjaka i usporedite rješenja.</p>
            </div>
            <div className="step-card">
              <div className="step-number">3</div>
              <h3>Platite sigurno</h3>
              <p>Odaberite najbolju uslugu i plaćajte bez stresnog administriranja.</p>
            </div>
          </div>
        </section>

        <section className="boss-band reveal">
          <div className="boss-band-copy">
            <span className="eyebrow small-eyebrow">Zarada</span>
            <h2>Budi svoj šef.</h2>
            <p>Bilo da si majstor, dizajner ili IT stručnjak — pronađi svoj sljedeći posao na Poso.ba.</p>
            <ul className="boss-checklist">
              <li><Check size={16} /> Besplatan pristup hiljadama poslova</li>
              <li><Check size={16} /> Bez pretplate za osnovno korištenje</li>
              <li><Check size={16} /> Zaradi dodatni prihod po svom rasporedu</li>
              <li><Check size={16} /> Izgradi svoj biznis i bazu klijenata</li>
            </ul>
            <button type="button" className="boss-band-button" onClick={() => navigate('/zaradi')}>
              Zaradi sa Poso.ba <ArrowRight size={16} />
            </button>
          </div>
          <div className="boss-band-visual">
            <div className="boss-band-visual-image">
              <img src="/images/categories/construction.jpg" alt="Izvođač na poslu" loading="lazy" />
            </div>
            <div className="float-card float-card-payment">
              <Wallet size={16} />
              <div>
                <strong>Isplata primljena!</strong>
                <span>Krečenje stana · 220 KM</span>
              </div>
            </div>
            <div className="float-pill float-pill-alert">
              <Bell size={13} /> Novi posao!
            </div>
          </div>
        </section>

        <section className="pricing-section reveal" id="cijene">
          <div className="section-heading centered">
            <div>
              <span className="eyebrow small-eyebrow">Planovi i krediti</span>
              <h2>Odaberite plan koji odgovara vašem načinu korištenja</h2>
            </div>
          </div>

          <div className="plans-grid reveal-stagger reveal">
            {mockPlans.map((plan) => (
              <div
                key={plan.id}
                className={`plan-card ${plan.featured ? 'featured' : ''} ${selectedPlan === plan.id ? 'selected' : ''}`}
                onClick={() => setSelectedPlan(plan.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    setSelectedPlan(plan.id)
                  }
                }}
                role="button"
                tabIndex={0}
              >
                {plan.featured && <span className="plan-badge">Najpopularnije</span>}
                <div className="plan-header">
                  <h3>{plan.name}</h3>
                  <div className="plan-price">
                    <span>{plan.price}</span>
                    {plan.suffix && <small>{plan.suffix}</small>}
                  </div>
                </div>
                <p>{plan.description}</p>
                <ul>
                  {plan.perks.map((perk) => (
                    <li key={perk}>
                      <Check size={15} /> {perk}
                    </li>
                  ))}
                </ul>
                <button type="button" className="secondary-button plan-button" onClick={(event) => { event.stopPropagation(); setSelectedPlan(plan.id); showNotice(`${plan.name} plan je odabran.`) }}>
                  {selectedPlan === plan.id ? 'Odabrano' : 'Odaberi plan'}
                </button>
              </div>
            ))}
          </div>

          <div className="paywall-panel">
            <div className="paywall-copy">
              <span className="eyebrow small-eyebrow">RevenueCat ready</span>
              <h3>Usklađenost s app store pravilima i Google Play zahtjevima</h3>
              <p>
                Model pretplate je dizajniran za jasno prikazivanje vrijednosti, transparentne
                cijene i jednostavnu uslugu automatske naplate. Uključuje 3 nivoa pretplate i
                opciju kupovine kredita za dodatnu promociju oglasa.
              </p>
              <div className="compliance-list">
                <div className="compliance-item">
                  <ShieldCheck size={18} />
                  <span>Jasni uslovi korištenja i pravila objave</span>
                </div>
                <div className="compliance-item">
                  <ShieldCheck size={18} />
                  <span>Sigurnost plaćanja i verifikacija profila</span>
                </div>
                <div className="compliance-item">
                  <ShieldCheck size={18} />
                  <span>Transparentne cijene i usluge</span>
                </div>
                <div className="compliance-item">
                  <ShieldCheck size={18} />
                  <span>Moderacija oglasa i prijava za sporove</span>
                </div>
              </div>
            </div>

            <div className="credit-box">
              <div className="credit-box-header">
                <h4>Kupi kredite</h4>
                <Wallet size={18} />
              </div>

              <div className="credit-grid">
                {mockCredits.map((pack) => (
                  <button
                    key={pack.id}
                    type="button"
                    className={`credit-pack ${selectedCredit === pack.id ? 'selected' : ''} ${pack.popular ? 'popular' : ''}`}
                    onClick={() => setSelectedCredit(pack.id)}
                  >
                    {pack.popular && <span className="popular-label">Najprodavanije</span>}
                    <strong>{pack.label}</strong>
                    <span>{pack.price}</span>
                  </button>
                ))}
              </div>

              <div className="highlight-box">
                <div>
                  <div className="highlight-label">Istaknuti oglas</div>
                  <div className="highlight-price">15 KM / 24h</div>
                </div>
                <button type="button" className="primary-button small-button" onClick={() => showNotice('Plaćanje i isticanje oglasa biće dostupni nakon povezivanja payment providera.')}>
                  <Zap size={15} /> Istakni oglas
                </button>
              </div>
            </div>
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
      </main>

      {notice && <div className="form-success homepage-notice" role="status">{notice}</div>}
      {cityPickerOpen && <CityPicker value={city} onChange={setCity} onClose={() => setCityPickerOpen(false)} />}

      <footer className="site-footer">
        <div className="brand-wrap">
          <div className="brand-mark">P</div>
          <div>
            <div className="brand-name">Poso.ba</div>
            <div className="brand-subtitle">Usluge za Bosnu i Hercegovinu</div>
          </div>
        </div>

        <div className="footer-links">
          <a href="#" onClick={(event) => { event.preventDefault(); navigate('/o-nama') }}>O nama</a>
          <a href="#kako-radi">Kako radi</a>
          <a href="#cijene">Cijene</a>
          <a href="#" onClick={(event) => { event.preventDefault(); navigate('/pravila') }}>Pravila i uslovi</a>
          <a href="#" onClick={(event) => { event.preventDefault(); navigate('/privatnost') }}>Privatnost</a>
          <a href="#" onClick={(event) => { event.preventDefault(); navigate('/zaradi') }}>Postani pružalac</a>
        </div>

        <div className="footer-meta">
          <span>
            <BriefcaseBusiness size={15} /> 100% sigurno plaćanje
          </span>
          <span>
            <CreditCard size={15} /> Plaćanje karticom ili kreditima
          </span>
        </div>
      </footer>
      <MobileNav />
    </div>
  )
}

export default HomePage
