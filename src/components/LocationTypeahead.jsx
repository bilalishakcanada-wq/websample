import { useEffect, useRef, useState } from 'react'
import { Loader2, MapPin, X } from 'lucide-react'
import { useLocationSearch } from '../hooks/useLocationSearch'
import { rememberPlace } from '../data/cityCoordinates'

/**
 * Where: any town, village or town quarter in BiH. Start typing ("Ote…") and pick "Otes, Ilidža";
 * the same name in another municipality ("Otes, Kakanj") is its own row, so nobody picks the wrong one.
 * Nothing is rendered up front: only the 8 best matches for what was typed (or the popular towns).
 * onChange(label, place) — label is what gets saved ("Otes, Ilidža"); place has lat/lng when known.
 */
function LocationTypeahead({ value, onChange, id = 'city', label = 'Mjesto', required = false, placeholder = ' ', autoFocus = false }) {
  const [query, setQuery] = useState(value || '')
  const [shownValue, setShownValue] = useState(value)
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const wrapRef = useRef(null)
  const { places, loading } = useLocationSearch(query)

  // the form changed the value (a draft loaded, the field cleared): show it
  if (value !== shownValue) { setShownValue(value); setQuery(value || '') }

  useEffect(() => {
    if (!open) return undefined
    const onPointer = (event) => { if (wrapRef.current && !wrapRef.current.contains(event.target)) setOpen(false) }
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [open])

  const pick = (place) => {
    if (place.lat != null) rememberPlace(place.label, place.lat, place.lng)
    onChange(place.label, place)
    setQuery(place.label)
    setShownValue(place.label)
    setOpen(false)
  }

  const onKeyDown = (event) => {
    if (!open && ['ArrowDown', 'ArrowUp'].includes(event.key)) { setOpen(true); return }
    if (event.key === 'ArrowDown') { event.preventDefault(); setHighlight((index) => Math.min(index + 1, places.length - 1)) }
    if (event.key === 'ArrowUp') { event.preventDefault(); setHighlight((index) => Math.max(index - 1, 0)) }
    if (event.key === 'Enter' && open && places[highlight]) { event.preventDefault(); pick(places[highlight]) }
    if (event.key === 'Escape') setOpen(false)
  }

  const typed = query.trim()
  const listId = `${id}-list`
  return (
    <div className="field city-field" ref={wrapRef}>
      <span className="city-field-icon">{loading && open ? <Loader2 size={16} className="spin" /> : <MapPin size={16} />}</span>
      <input
        id={id}
        placeholder={placeholder}
        value={query}
        required={required}
        autoComplete="off"
        autoFocus={autoFocus}
        enterKeyHint="search"
        onFocus={() => setOpen(true)}
        onChange={(event) => { setQuery(event.target.value); setShownValue(event.target.value); onChange(event.target.value, null); setOpen(true); setHighlight(0) }}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && places[highlight] ? `${id}-opt-${highlight}` : undefined}
      />
      <label htmlFor={id}>{label}</label>
      {query && (
        <button type="button" className="city-field-clear" onClick={() => { setQuery(''); setShownValue(''); onChange('', null); setOpen(true); setHighlight(0) }} aria-label="Obriši mjesto"><X size={14} /></button>
      )}
      {open && (places.length > 0 || typed.length >= 2) && (
        <ul className="city-field-list" id={listId} role="listbox">
          {!typed && <li className="city-field-hint">Popularni gradovi — ili upiši naselje</li>}
          {places.map((place, index) => (
            <li key={place.label} id={`${id}-opt-${index}`} role="option" aria-selected={index === highlight}>
              <button type="button" className={index === highlight ? 'active' : ''} onMouseEnter={() => setHighlight(index)} onClick={() => pick(place)}>
                <MapPin size={14} />
                <span className="place-text">
                  <strong>{place.name}</strong>{place.municipality && place.municipality !== place.name && <span className="place-muni">, {place.municipality}</span>}
                  {place.region && <small>{place.kind === 'dio grada' ? 'dio grada · ' : ''}{place.region}</small>}
                </span>
              </button>
            </li>
          ))}
          {!places.length && typed.length >= 2 && (
            <li className="city-field-hint">{loading ? 'Tražim…' : 'Nema takvog mjesta u BiH'}</li>
          )}
        </ul>
      )}
    </div>
  )
}

export default LocationTypeahead
