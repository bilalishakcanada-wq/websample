import { useState } from 'react'
import { Check, MapPin, Search, X } from 'lucide-react'
import { featuredCities, otherCitiesImage } from '../data/featuredCities'
import { bosniaCities } from '../data/cities'

function CityPicker({ value, onChange, onClose }) {
  const [query, setQuery] = useState('')

  const filteredAll = query.trim()
    ? bosniaCities.filter((city) => city.toLowerCase().includes(query.trim().toLowerCase()))
    : bosniaCities

  const pick = (city) => {
    onChange(city)
    onClose()
  }

  return (
    <div className="city-picker-backdrop" role="presentation" onClick={onClose}>
      <div className="city-picker-panel" role="dialog" aria-modal="true" aria-label="Odaberi grad" onClick={(event) => event.stopPropagation()}>
        <div className="city-picker-header">
          <h2>Odaberi grad</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Zatvori"><X size={18} /></button>
        </div>

        <div className="city-picker-grid">
          {featuredCities.map((city) => (
            <button key={city.id} type="button" className={`city-tile ${value === city.name ? 'selected' : ''}`} onClick={() => pick(city.name)}>
              <img src={city.image} alt={city.name} loading="lazy" />
              <div className="city-tile-info">
                <strong>{city.name}</strong>
                <span>{city.tagline}</span>
              </div>
              {value === city.name && <span className="city-tile-check"><Check size={14} /></span>}
            </button>
          ))}
          <button type="button" className={`city-tile ${value === '' ? 'selected' : ''}`} onClick={() => pick('')}>
            <img src={otherCitiesImage} alt="Svi gradovi" loading="lazy" />
            <div className="city-tile-info">
              <strong>Svi gradovi</strong>
              <span>Pretraži cijelu BiH</span>
            </div>
          </button>
        </div>

        <div className="city-picker-search">
          <Search size={16} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ili pretraži svoj grad..." autoFocus />
        </div>

        <div className="city-picker-list">
          {filteredAll.map((city) => (
            <button key={city} type="button" className={`city-list-item ${value === city ? 'selected' : ''}`} onClick={() => pick(city)}>
              <MapPin size={14} /> {city}
            </button>
          ))}
          {filteredAll.length === 0 && <p className="muted-text">Nema rezultata.</p>}
        </div>
      </div>
    </div>
  )
}

export default CityPicker
