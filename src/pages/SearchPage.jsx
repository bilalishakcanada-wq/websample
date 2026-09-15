import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { MapPin, Search as SearchIcon, SlidersHorizontal } from 'lucide-react'
import MobileNav from '../components/MobileNav'
import ListingCard from '../components/ListingCard'
import BackHome from '../components/BackHome'
import CityPicker from '../components/CityPicker'
import { serviceCategories } from '../data/categories'
import { listingService } from '../services/listingService'

const formatPrice = (value, currency = 'BAM') => value == null ? 'Po dogovoru' : `${Number(value).toLocaleString('bs-BA')} ${currency === 'BAM' ? 'KM' : currency}`

function SearchPage() {
  const [searchParams] = useSearchParams()
  const [filters, setFilters] = useState({
    query: searchParams.get('q') || '',
    city: searchParams.get('city') || '',
    category: searchParams.get('category') || '',
    maxPrice: '',
  })
  const [cityPickerOpen, setCityPickerOpen] = useState(false)
  const [saved, setSaved] = useState([])
  const [listings, setListings] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    const timeout = setTimeout(() => {
      listingService.listAll({ search: filters.query, city: filters.city, category: filters.category, maxPrice: filters.maxPrice, pageSize: 30 })
        .then((result) => {
          if (!active) return
          setListings(result.data || [])
          setTotal(result.count || 0)
        })
        .catch((requestError) => active && setError(requestError.message))
        .finally(() => active && setLoading(false))
    }, 250)
    return () => { active = false; clearTimeout(timeout) }
  }, [filters])

  return (
    <div className="app-shell page-with-mobile-nav">
      <header className="app-page-header"><div><BackHome /><span className="eyebrow small-eyebrow">Marketplace</span><h1>Pretraži oglase</h1></div><SlidersHorizontal size={22} /></header>
      <main className="content-container">
        <section className="filter-panel">
          <label className="search-field"><SearchIcon size={18} /><span className="sr-only">Pretraži</span><input placeholder="Šta treba uraditi?" value={filters.query} onChange={(event) => setFilters({ ...filters, query: event.target.value })} /></label>
          <div className="filter-grid">
            <button type="button" className="search-field location-field city-picker-trigger" onClick={() => setCityPickerOpen(true)}>
              <MapPin size={16} /> <span>{filters.city || 'Svi gradovi'}</span>
            </button>
            <label>Kategorija<select value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value })}><option value="">Sve kategorije</option>{serviceCategories.map((category) => <option key={category.id} value={category.name}>{category.name}</option>)}</select></label>
            <label>Maksimalni budžet<input type="number" min="0" placeholder="KM" value={filters.maxPrice} onChange={(event) => setFilters({ ...filters, maxPrice: event.target.value })} /></label>
          </div>
        </section>
        <div className="results-heading"><div><p className="muted-text">{total} {total === 1 ? 'oglas' : 'oglasa'}</p><h2>Poslovi u Bosni i Hercegovini</h2></div></div>
        {error && <div className="form-error">{error}</div>}
        {loading
          ? <div className="skeleton-list">{[1, 2, 3].map((item) => <div className="skeleton-card" key={item} />)}</div>
          : listings.length === 0
            ? <div className="empty-state"><SearchIcon size={38} /><h2>Nema rezultata</h2><p>Pokušajte drugu pretragu ili promijenite filtere.</p></div>
            : (
              <div className="listing-grid">
                {listings.map((listing) => (
                  <ListingCard
                    key={listing.id}
                    listing={{ ...listing, tag: listing.category, price: formatPrice(listing.price, listing.currency), time: '' }}
                    saved={saved.includes(listing.id)}
                    onSave={(id) => setSaved((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])}
                  />
                ))}
              </div>
            )}
      </main>
      {cityPickerOpen && <CityPicker value={filters.city} onChange={(city) => setFilters({ ...filters, city })} onClose={() => setCityPickerOpen(false)} />}
      <MobileNav />
    </div>
  )
}

export default SearchPage
