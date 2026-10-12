import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { LocateFixed, MapPin, Navigation, X } from 'lucide-react'
import { coordsForLocation, distanceKm } from '../data/cityCoordinates'
import { currentLocation, locationSupported } from '../utils/location'
import { placeService } from '../services/placeService'
import './ExactLocationPicker.css'

const ExactLocationMap = lazy(() => import('./ExactLocationMap'))

const FAR_KM = 25

/**
 * Optional exact location on top of a picked town: a street and number ("Ilirska 67"), the phone's GPS,
 * or a pin moved on the map. value = { address, lat, lng, accuracy, source: typed|gps|map } or null.
 * The town stays what everyone sees; the exact point is shared only as the database allows
 * (supabase/algorithms/01: the owner and the accepted provider for a job, nobody for a person).
 */
function ExactLocationPicker({
  town = '',
  value = null,
  onChange,
  openLabel = 'Dodaj tačnu adresu ili lokaciju (opciono)',
  hint = 'Tačnu adresu vidi samo izvođač čiju ponudu prihvatiš. Ostali vide samo mjesto.',
  placeholder = 'Ulica i broj, npr. Ilirska 67',
}) {
  const [open, setOpen] = useState(Boolean(value))
  const [text, setText] = useState(value?.address || '')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState('')
  const townPoint = coordsForLocation(town)
  const asked = useRef('')

  // the address arrived later (editing a job loads it after the form)
  useEffect(() => {
    if (value?.address && !text) setText(value.address)
    if (value && !open) setOpen(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.address, value?.lat])

  // suggestions while typing, the ones in the chosen town first
  useEffect(() => {
    const q = text.trim()
    if (q.length < 3 || q === value?.address) { setResults([]); return undefined }
    const timer = setTimeout(async () => {
      asked.current = q
      setSearching(true)
      try {
        const found = await placeService.findAddress(town ? `${q}, ${town}` : q, townPoint)
        const plain = found.length || !town ? found : await placeService.findAddress(q, townPoint)
        if (asked.current === q) setResults(plain)
      } catch {
        if (asked.current === q) setResults([])
      } finally {
        if (asked.current === q) setSearching(false)
      }
    }, 450)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, town])

  const pick = (place) => {
    setText(place.label)
    setResults([])
    setError('')
    onChange({ address: place.label, lat: place.lat, lng: place.lng, accuracy: null, source: 'typed' })
  }

  // the geocoder doesn't know the street (or isn't reachable): keep the typed address on the town's point,
  // and the pin can then be moved to the right door
  const keepTyped = () => {
    const point = value || townPoint
    if (!point) { setError('Prvo odaberi mjesto.'); return }
    setResults([])
    onChange({ address: text.trim(), lat: point.lat, lng: point.lng, accuracy: value?.accuracy ?? null, source: value?.source || 'typed' })
  }

  const useGps = async () => {
    setLocating(true)
    setError('')
    try {
      const here = await currentLocation()
      let address = null
      try { address = (await placeService.addressAt(here.lat, here.lng))?.label || null } catch { /* the point alone is enough */ }
      setText(address || '')
      setResults([])
      onChange({ address, lat: here.lat, lng: here.lng, accuracy: here.accuracy ?? null, source: 'gps' })
    } catch (message) {
      setError(typeof message === 'string' ? message : 'Lokacija trenutno nije dostupna.')
    } finally {
      setLocating(false)
    }
  }

  const moved = async ({ lat, lng }) => {
    // a typed address stays (the pin was only nudged to the right door); otherwise name the new spot
    let address = value?.address || null
    if (!address || value?.source === 'gps') {
      try { address = (await placeService.addressAt(lat, lng))?.label || address } catch { /* keep what we had */ }
      setText(address || '')
    }
    onChange({ address, lat, lng, accuracy: null, source: 'map' })
  }

  const remove = () => {
    setText('')
    setResults([])
    setError('')
    setOpen(false)
    onChange(null)
  }

  if (!open) {
    return (
      <button type="button" className="xl-open" onClick={() => setOpen(true)}>
        <MapPin size={16} /> {openLabel}
      </button>
    )
  }

  const far = value && townPoint ? distanceKm(townPoint, value) : null
  const typedUnknown = text.trim().length >= 3 && text.trim() !== value?.address && !searching && results.length === 0

  return (
    <div className="xl">
      <div className="xl-row">
        <input
          className="xl-input"
          value={text}
          maxLength={200}
          placeholder={placeholder}
          autoComplete="street-address"
          aria-label="Tačna adresa"
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); if (results[0]) pick(results[0]); else if (typedUnknown) keepTyped() } }}
        />
        <button type="button" className="xl-close" onClick={remove} aria-label="Ukloni tačnu lokaciju" title="Ukloni tačnu lokaciju"><X size={16} /></button>
      </div>

      {(results.length > 0 || searching || typedUnknown) && (
        <ul className="xl-results" role="listbox">
          {searching && results.length === 0 && <li className="xl-muted">Tražim…</li>}
          {results.map((place) => (
            <li key={`${place.lat},${place.lng}`}>
              <button type="button" role="option" aria-selected="false" onClick={() => pick(place)}>
                <MapPin size={15} /> <span>{place.label}</span>
              </button>
            </li>
          ))}
          {typedUnknown && (
            <li>
              <button type="button" className="xl-keep" onClick={keepTyped}>
                <span>Koristi „{text.trim()}“{town ? `, ${town}` : ''}</span><em>pa pomjeri iglu na mapi</em>
              </button>
            </li>
          )}
        </ul>
      )}

      {locationSupported() && (
        <button type="button" className="xl-gps" onClick={useGps} disabled={locating}>
          {locating ? <Navigation size={16} className="xl-spin" /> : <LocateFixed size={16} />}
          {locating ? 'Tražim gdje si…' : 'Koristi moju trenutnu lokaciju'}
        </button>
      )}

      {value && (
        <>
          <Suspense fallback={<div className="xl-map xl-map-loading" />}>
            <ExactLocationMap point={value} onMove={moved} />
          </Suspense>
          <p className="xl-note">
            {value.address ? <strong>{value.address}</strong> : <strong>Tačka na mapi</strong>}
            {Number.isFinite(value.accuracy) && value.accuracy > 0 ? ` · tačnost oko ${Math.round(value.accuracy)} m` : ''}
            {' · '}pomjeri iglu ako nije tačno
          </p>
          {far != null && far > FAR_KM && (
            <p className="xl-warn">Ova tačka je {Math.round(far)} km od mjesta {town}. Provjeri jesi li odabrao/la pravo mjesto.</p>
          )}
        </>
      )}

      {error && <p className="xl-error" role="alert">{error}</p>}
      <p className="xl-hint">{hint}</p>
    </div>
  )
}

export default ExactLocationPicker
