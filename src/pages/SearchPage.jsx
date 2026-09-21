import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useBackToClose } from '../hooks/useBackToClose'
import { rankListings } from '../utils/ranking'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowUpDown, Banknote, CalendarDays, Check, ChevronDown, Laptop, List, MapPin,
  Map as MapIcon, Search as SearchIcon, SlidersHorizontal, UserRound, Users, X,
} from 'lucide-react'
import BackHome from '../components/BackHome'
// maplibre is ~0.8 MB: only fetched when the map is actually on screen
const TaskMap = lazy(() => import('../components/TaskMap'))
import { serviceCategories } from '../data/categories'
import { bosniaCities } from '../data/cities'
import { cityCoordinates, distanceKm, isRemoteLocation } from '../data/cityCoordinates'
import { listingService } from '../services/listingService'
import { FindMascot } from '../app/Mascots'
import { formatBosnianDate } from '../utils/dateFormat'

const RADIUS_OPTIONS = [
  { value: 10, label: '10 km' },
  { value: 25, label: '25 km' },
  { value: 50, label: '50 km' },
  { value: 100, label: '100 km' },
  { value: 0, label: 'Cijela BiH' },
]

const SORT_OPTIONS = [
  { value: 'recommended', label: 'Preporučeno' },
  { value: 'newest', label: 'Najnovije' },
  { value: 'oldest', label: 'Najstarije' },
  { value: 'price_desc', label: 'Cijena: veća prvo' },
  { value: 'price_asc', label: 'Cijena: manja prvo' },
  { value: 'offers', label: 'Najviše ponuda' },
  { value: 'closest', label: 'Najbliže', needsCity: true },
]

const PRICE_PRESETS = [
  { label: 'Bilo koja', min: '', max: '' },
  { label: 'do 50 KM', min: '', max: 50 },
  { label: '50–200 KM', min: 50, max: 200 },
  { label: '200–500 KM', min: 200, max: 500 },
  { label: '500+ KM', min: 500, max: '' },
]

const formatPrice = (value, currency = 'BAM') => value == null ? 'Po dogovoru' : `${Number(value).toLocaleString('bs-BA')} ${currency === 'BAM' ? 'KM' : currency}`

function FilterMenu({ id, label, active, open, onToggle, children, width }) {
  // phones: the popover becomes a bottom sheet rendered on <body> (the sticky, blurred
  // filter bar would otherwise trap a position: fixed panel inside itself)
  const isPhone = useMediaQuery('(max-width: 768px)')
  const panel = open && (
    <div className="filter-popover" style={!isPhone && width ? { width } : undefined} role="dialog" data-menu={id}>
      <div className="filter-sheet-handle" aria-hidden="true" />
      {children}
    </div>
  )
  return (
    <div className={`filter-menu ${open ? 'open' : ''}`} data-menu={id}>
      <button type="button" className={`filter-pill ${active ? 'active' : ''}`} onClick={() => onToggle(id)} aria-expanded={open}>
        {label} <ChevronDown size={14} />
      </button>
      {open && isPhone
        ? createPortal(<><div className="filter-sheet-backdrop" onClick={() => onToggle(id)} aria-hidden="true" />{panel}</>, document.body)
        : panel}
    </div>
  )
}

function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [filters, setFilters] = useState({
    query: searchParams.get('q') || '',
    category: searchParams.get('category') || '',
    city: searchParams.get('city') || '',
    radius: Number(searchParams.get('radius') ?? 50),
    includeRemote: searchParams.get('remote') !== '0',
    minPrice: searchParams.get('min') || '',
    maxPrice: searchParams.get('max') || '',
    remoteOnly: false,
    hasBudget: false,
    noOffers: false,
    // a text search defaults to relevance; browsing defaults to newest
    sort: searchParams.get('sort') || (searchParams.get('q') ? 'recommended' : 'newest'),
  })
  const [openMenu, setOpenMenu] = useState('')
  useBackToClose(Boolean(openMenu), () => setOpenMenu(''))
  const [citySearch, setCitySearch] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeId, setActiveId] = useState(null)
  const [mobileView, setMobileView] = useState('list')
  const [phoneSearchOpen, setPhoneSearchOpen] = useState(() => Boolean(searchParams.get('q')))
  // phones show list OR map; wider screens show both (mirrors the CSS breakpoint)
  const [isPhone, setIsPhone] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 900px)').matches)
  useEffect(() => {
    const media = window.matchMedia('(max-width: 900px)')
    const onChange = (event) => setIsPhone(event.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])
  const filterBarRef = useRef(null)
  const cardRefs = useRef({})

  const update = (patch) => setFilters((current) => ({ ...current, ...patch }))

  // Keep shareable filters in the URL.
  useEffect(() => {
    const next = new URLSearchParams()
    if (filters.query) next.set('q', filters.query)
    if (filters.category) next.set('category', filters.category)
    if (filters.city) next.set('city', filters.city)
    if (filters.city && filters.radius !== 50) next.set('radius', String(filters.radius))
    if (!filters.includeRemote) next.set('remote', '0')
    if (filters.minPrice !== '') next.set('min', String(filters.minPrice))
    if (filters.maxPrice !== '') next.set('max', String(filters.maxPrice))
    if (filters.sort !== 'newest') next.set('sort', filters.sort)
    setSearchParams(next, { replace: true })
  }, [filters, setSearchParams])

  // Server-side: text, category, price, remote/budget. Location + radius + sort
  // by distance/offers happen client-side over the full result set.
  const serverSort = ['price_asc', 'price_desc', 'oldest'].includes(filters.sort) ? filters.sort : 'newest'
  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    const timeout = setTimeout(() => {
      listingService.listAll({
        search: filters.query,
        category: filters.category,
        minPrice: filters.minPrice,
        maxPrice: filters.maxPrice,
        remoteOnly: filters.remoteOnly,
        hasBudget: filters.hasBudget,
        sort: serverSort,
        pageSize: 200,
      })
        .then((result) => active && setRows(result.data || []))
        .catch((requestError) => active && setError(requestError.message))
        .finally(() => active && setLoading(false))
    }, 200)
    return () => { active = false; clearTimeout(timeout) }
  }, [filters.query, filters.category, filters.minPrice, filters.maxPrice, filters.remoteOnly, filters.hasBudget, serverSort])

  useEffect(() => {
    if (!openMenu) return undefined
    const close = (event) => {
      const insideSheet = event.target instanceof Element && event.target.closest('.filter-popover')
      if (filterBarRef.current && !filterBarRef.current.contains(event.target) && !insideSheet) setOpenMenu('')
    }
    const onKey = (event) => event.key === 'Escape' && setOpenMenu('')
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [openMenu])

  const origin = useMemo(() => {
    const coords = filters.city ? cityCoordinates[filters.city] : null
    return coords ? { lat: coords[0], lng: coords[1] } : null
  }, [filters.city])

  const listings = useMemo(() => {
    let items = rows.map((row) => {
      const remote = isRemoteLocation(row.location)
      const point = row.lat != null ? { lat: row.lat, lng: row.lng } : null
      return {
        ...row,
        remote,
        offers: row.bids?.[0]?.count ?? 0,
        photo: [...(row.listing_images || [])].sort((a, b) => a.position - b.position)[0]?.url || null,
        photoCount: (row.listing_images || []).length,
        distance: origin && point ? distanceKm(origin, point) : null,
      }
    })

    if (origin) {
      items = items.filter((item) => {
        if (item.remote) return filters.includeRemote
        if (item.distance == null) return false
        return filters.radius === 0 || item.distance <= filters.radius
      })
    }
    if (filters.noOffers) items = items.filter((item) => item.offers === 0)

    if (filters.sort === 'offers') items.sort((a, b) => b.offers - a.offers)
    if (filters.sort === 'closest' && origin) {
      items.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity))
    }
    // relevance model: query match, freshness, few offers, completeness, distance
    if (filters.sort === 'recommended') items = rankListings(items, { query: filters.query })
    return items
  }, [rows, origin, filters.includeRemote, filters.radius, filters.noOffers, filters.sort, filters.query])

  const mapFocus = useMemo(() => {
    if (!origin) return null
    const zoom = filters.radius === 0 ? 7 : filters.radius <= 10 ? 11 : filters.radius <= 25 ? 10 : filters.radius <= 50 ? 9 : 8
    return { ...origin, zoom }
  }, [origin, filters.radius])

  const activeCount = [
    filters.category, filters.city, filters.minPrice !== '' || filters.maxPrice !== '',
    filters.remoteOnly, filters.hasBudget, filters.noOffers,
  ].filter(Boolean).length

  const resetAll = () => {
    setFilters({ query: '', category: '', city: '', radius: 50, includeRemote: true, minPrice: '', maxPrice: '', remoteOnly: false, hasBudget: false, noOffers: false, sort: 'newest' })
    setOpenMenu('')
  }

  const selectFromMap = (id) => {
    setActiveId(id)
    setMobileView('list')
    cardRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const toggleMenu = (id) => setOpenMenu((current) => (current === id ? '' : id))
  const filteredCities = bosniaCities.filter((name) => name.toLowerCase().includes(citySearch.toLowerCase())).slice(0, 12)
  const locationLabel = filters.city
    ? `${filters.radius === 0 ? 'Cijela BiH' : `${filters.radius} km`} · ${filters.city}${filters.includeRemote ? ' i online' : ''}`
    : 'Cijela BiH i online'
  const priceLabel = filters.minPrice === '' && filters.maxPrice === ''
    ? 'Bilo koja cijena'
    : `${filters.minPrice || 0}–${filters.maxPrice || '∞'} KM`
  const sortLabel = SORT_OPTIONS.find((option) => option.value === filters.sort)?.label || 'Najnovije'

  return (
    <div className={`app-shell page-with-mobile-nav browse-page ${isPhone && phoneSearchOpen ? 'search-open' : ''}`}>
      {isPhone && (
        <div className="ap-browse-top">
          <button type="button" className="ap-icon-btn" onClick={() => setMobileView(mobileView === 'map' ? 'list' : 'map')} aria-label={mobileView === 'map' ? 'Lista' : 'Mapa'}>
            {mobileView === 'map' ? <List size={20} /> : <MapIcon size={20} />}
          </button>
          <h1>Pretraži poslove</h1>
          <button type="button" className={`ap-icon-btn ${phoneSearchOpen || filters.query ? 'active' : ''}`} onClick={() => setPhoneSearchOpen((open) => { if (!open) window.setTimeout(() => filterBarRef.current?.querySelector('.filter-search input')?.focus(), 30); return !open })} aria-label="Traži"><SearchIcon size={20} /></button>
        </div>
      )}
      <header className="app-page-header browse-header">
        <div>
          <BackHome />
          <h1>Pretraži poslove</h1>
        </div>
        <span className="muted-text">{loading ? 'Učitavam...' : `${listings.length} ${listings.length === 1 ? 'oglas' : 'oglasa'}`}</span>
      </header>

      <div className="filter-bar" ref={filterBarRef}>
        <label className="filter-search">
          <SearchIcon size={16} />
          <input placeholder="Traži posao..." value={filters.query} onChange={(event) => update({ query: event.target.value })} />
          {filters.query && <button type="button" aria-label="Obriši" onClick={() => update({ query: '' })}><X size={14} /></button>}
        </label>

        <FilterMenu id="category" label={filters.category || 'Kategorija'} active={Boolean(filters.category)} open={openMenu === 'category'} onToggle={toggleMenu} width={520}>
          <div className="popover-grid">
            <button type="button" className={`popover-option ${!filters.category ? 'active' : ''}`} onClick={() => { update({ category: '' }); setOpenMenu('') }}>Sve kategorije</button>
            {serviceCategories.map(({ id, name, icon: Icon }) => (
              <button key={id} type="button" className={`popover-option ${filters.category === name ? 'active' : ''}`} onClick={() => { update({ category: name }); setOpenMenu('') }}>
                <Icon size={15} /> {name}
              </button>
            ))}
          </div>
        </FilterMenu>

        <FilterMenu id="location" label={locationLabel} active={Boolean(filters.city)} open={openMenu === 'location'} onToggle={toggleMenu} width={360}>
          <label className="popover-search">
            <MapPin size={15} />
            <input placeholder="Upiši grad..." value={citySearch} onChange={(event) => setCitySearch(event.target.value)} autoFocus />
          </label>
          <div className="popover-list">
            <button type="button" className={`popover-option ${!filters.city ? 'active' : ''}`} onClick={() => update({ city: '' })}>Cijela BiH</button>
            {filteredCities.map((name) => (
              <button key={name} type="button" className={`popover-option ${filters.city === name ? 'active' : ''}`} onClick={() => { update({ city: name }); setCitySearch('') }}>
                {name}
              </button>
            ))}
          </div>
          {filters.city && (
            <>
              <div className="popover-section">
                <span>Udaljenost od grada</span>
                <div className="radius-options">
                  {RADIUS_OPTIONS.map((option) => (
                    <button key={option.value} type="button" className={`radius-chip ${filters.radius === option.value ? 'active' : ''}`} onClick={() => update({ radius: option.value })}>{option.label}</button>
                  ))}
                </div>
              </div>
              <label className="popover-check">
                <input type="checkbox" checked={filters.includeRemote} onChange={(event) => update({ includeRemote: event.target.checked })} />
                Uključi i online poslove
              </label>
            </>
          )}
        </FilterMenu>

        <FilterMenu id="price" label={priceLabel} active={filters.minPrice !== '' || filters.maxPrice !== ''} open={openMenu === 'price'} onToggle={toggleMenu} width={320}>
          <div className="radius-options">
            {PRICE_PRESETS.map((preset) => (
              <button key={preset.label} type="button" className={`radius-chip ${String(filters.minPrice) === String(preset.min) && String(filters.maxPrice) === String(preset.max) ? 'active' : ''}`} onClick={() => update({ minPrice: preset.min, maxPrice: preset.max })}>{preset.label}</button>
            ))}
          </div>
          <div className="price-range">
            <label>Od<input type="number" min="0" placeholder="0" value={filters.minPrice} onChange={(event) => update({ minPrice: event.target.value })} /></label>
            <span>—</span>
            <label>Do<input type="number" min="0" placeholder="∞" value={filters.maxPrice} onChange={(event) => update({ maxPrice: event.target.value })} /></label>
          </div>
        </FilterMenu>

        <FilterMenu id="other" label="Ostali filteri" active={filters.remoteOnly || filters.hasBudget || filters.noOffers} open={openMenu === 'other'} onToggle={toggleMenu} width={280}>
          <label className="popover-check"><input type="checkbox" checked={filters.remoteOnly} onChange={(event) => update({ remoteOnly: event.target.checked })} /><Laptop size={15} /> Samo online poslovi</label>
          <label className="popover-check"><input type="checkbox" checked={filters.hasBudget} onChange={(event) => update({ hasBudget: event.target.checked })} /><Banknote size={15} /> Samo sa navedenim budžetom</label>
          <label className="popover-check"><input type="checkbox" checked={filters.noOffers} onChange={(event) => update({ noOffers: event.target.checked })} /><Users size={15} /> Još bez ponuda</label>
        </FilterMenu>

        <FilterMenu id="sort" label={<><ArrowUpDown size={14} /> {sortLabel}</>} active={filters.sort !== 'newest'} open={openMenu === 'sort'} onToggle={toggleMenu} width={240}>
          <div className="popover-list">
            {SORT_OPTIONS.filter((option) => !option.needsCity || filters.city).map((option) => (
              <button key={option.value} type="button" className={`popover-option ${filters.sort === option.value ? 'active' : ''}`} onClick={() => { update({ sort: option.value }); setOpenMenu('') }}>
                {option.label}{filters.sort === option.value && <Check size={14} />}
              </button>
            ))}
          </div>
        </FilterMenu>

        {(activeCount > 0 || filters.query) && (
          <button type="button" className="filter-reset" onClick={resetAll}><X size={14} /> Poništi</button>
        )}
      </div>

      <div className="mobile-view-toggle">
        <button type="button" className={mobileView === 'list' ? 'active' : ''} onClick={() => setMobileView('list')}><List size={16} /> Lista</button>
        <button type="button" className={mobileView === 'map' ? 'active' : ''} onClick={() => setMobileView('map')}><MapIcon size={16} /> Mapa</button>
      </div>

      <main className={`browse-layout view-${mobileView}`}>
        <section className="browse-list">
          {error && <div className="form-error">{error}</div>}
          {loading && <div className="skeleton-list">{[1, 2, 3].map((item) => <div className="skeleton-card" key={item} />)}</div>}
          {!loading && listings.length === 0 && (
            <div className="empty-state">
              <FindMascot className="empty-state-art" />
              <h2>Nema oglasa za ove filtere</h2>
              <p>Proširi udaljenost, uključi online poslove ili poništi filtere.</p>
              <button type="button" className="ghost-button" onClick={resetAll}>Poništi filtere</button>
            </div>
          )}
          {!loading && listings.map((item) => (
            <article
              key={item.id}
              ref={(node) => { cardRefs.current[item.id] = node }}
              className={`task-card ${activeId === item.id ? 'active' : ''}`}
              onMouseEnter={() => setActiveId(item.id)}
              onFocus={() => setActiveId(item.id)}
            >
              <Link to={`/listings/${item.id}`} className={`task-card-link ${item.photo ? 'has-photo' : ''}`}>
                {item.photo && <div className="task-card-photo"><img src={item.photo} alt="" loading="lazy" />{item.photoCount > 1 && <span>{item.photoCount}</span>}</div>}
                <div className="task-card-head">
                  <h3>{item.title}</h3>
                  <strong className="task-card-price">{formatPrice(item.price, item.currency)}</strong>
                </div>
                <ul className="task-card-facts">
                  <li>{item.remote ? <><Laptop size={14} /> Online</> : <><MapPin size={14} /> {item.location}{item.distance != null && <em> · {Math.round(item.distance)} km</em>}</>}</li>
                  <li><CalendarDays size={14} /> Objavljeno {formatBosnianDate(item.created_at)}</li>
                  <li><SlidersHorizontal size={14} /> Fleksibilan termin</li>
                </ul>
                <div className="task-card-foot">
                  <span className="task-card-status">Otvoren</span>
                  <span className="task-card-offers"><Users size={13} /> {item.offers} {item.offers === 1 ? 'ponuda' : 'ponuda'}</span>
                  <span className="task-card-avatar"><UserRound size={16} /></span>
                </div>
              </Link>
            </article>
          ))}
        </section>

        <aside className="browse-map">
          {(mobileView === 'map' || !isPhone) && (
            <Suspense fallback={<div className="browse-map-loading"><span /></div>}>
              <TaskMap listings={listings} activeId={activeId} onSelect={selectFromMap} focus={mapFocus} />
            </Suspense>
          )}
        </aside>
      </main>
    </div>
  )
}

export default SearchPage
