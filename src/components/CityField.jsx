import { useEffect, useMemo, useRef, useState } from 'react'
import { MapPin, X } from 'lucide-react'
import { cityCoordinates } from '../data/cityCoordinates'
import { POPULAR_CITIES } from '../data/siteMap'

const ALL_CITIES = Object.keys(cityCoordinates)

const fold = (value) => String(value || '')
  .toLowerCase()
  .replace(/š/g, 's').replace(/č/g, 'c').replace(/ć/g, 'c').replace(/ž/g, 'z').replace(/đ/g, 'dj')

/**
 * Inline city picker: start typing and pick from the list, or tap one of
 * the popular cities. No popup, no separate screen.
 */
function CityField({ value, onChange, id = 'city', label = 'Grad', required = false }) {
  const [query, setQuery] = useState(value || '')
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const wrapRef = useRef(null)

  useEffect(() => { setQuery(value || '') }, [value])

  useEffect(() => {
    if (!open) return undefined
    const onPointer = (event) => { if (wrapRef.current && !wrapRef.current.contains(event.target)) setOpen(false) }
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [open])

  const suggestions = useMemo(() => {
    const needle = fold(query.trim())
    if (!needle) return POPULAR_CITIES
    const starts = ALL_CITIES.filter((city) => fold(city).startsWith(needle))
    const contains = ALL_CITIES.filter((city) => !fold(city).startsWith(needle) && fold(city).includes(needle))
    return [...starts, ...contains].slice(0, 8)
  }, [query])

  const pick = (city) => {
    onChange(city)
    setQuery(city)
    setOpen(false)
  }

  const onKeyDown = (event) => {
    if (!open && ['ArrowDown', 'ArrowUp'].includes(event.key)) { setOpen(true); return }
    if (event.key === 'ArrowDown') { event.preventDefault(); setHighlight((index) => Math.min(index + 1, suggestions.length - 1)) }
    if (event.key === 'ArrowUp') { event.preventDefault(); setHighlight((index) => Math.max(index - 1, 0)) }
    if (event.key === 'Enter' && open && suggestions[highlight]) { event.preventDefault(); pick(suggestions[highlight]) }
    if (event.key === 'Escape') setOpen(false)
  }

  return (
    <div className="field city-field" ref={wrapRef}>
      <span className="city-field-icon"><MapPin size={16} /></span>
      <input
        id={id}
        placeholder=" "
        value={query}
        required={required}
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onChange={(event) => { setQuery(event.target.value); onChange(event.target.value); setOpen(true); setHighlight(0) }}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
      />
      <label htmlFor={id}>{label}</label>
      {query && (
        <button type="button" className="city-field-clear" onClick={() => { setQuery(''); onChange(''); setOpen(true) }} aria-label="Obriši grad"><X size={14} /></button>
      )}
      {open && suggestions.length > 0 && (
        <ul className="city-field-list" id={`${id}-list`} role="listbox">
          {!query.trim() && <li className="city-field-hint">Popularni gradovi — ili počni kucati</li>}
          {suggestions.map((city, index) => (
            <li key={city} role="option" aria-selected={index === highlight}>
              <button type="button" className={index === highlight ? 'active' : ''} onMouseEnter={() => setHighlight(index)} onClick={() => pick(city)}>
                <MapPin size={14} /> {city}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default CityField
