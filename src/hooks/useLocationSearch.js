import { useEffect, useMemo, useState } from 'react'
import { cityCoordinates } from '../data/cityCoordinates'
import { POPULAR_CITIES } from '../data/siteMap'
import { locationService } from '../services/locationService'
import { useDebounced } from './useDebounced'

const TOWNS = Object.keys(cityCoordinates)
export const foldPlace = (value) => String(value || '')
  .toLowerCase()
  .replace(/š/g, 's').replace(/č/g, 'c').replace(/ć/g, 'c').replace(/ž/g, 'z').replace(/đ/g, 'dj')
  .replace(/dj/g, 'd')
  .trim()

const town = (label) => ({ label, name: label, municipality: null, kind: 'grad', town: true })

/**
 * Type-ahead over every settlement in BiH. Towns the app ships with answer at once; settlements come
 * from the database 300 ms after typing stops (one request per pause, the older one cancelled).
 * Returns { places, loading }; with nothing typed, the popular towns.
 */
export function useLocationSearch(query, { limit = 8, popular = POPULAR_CITIES } = {}) {
  const needle = foldPlace(query)
  const debounced = useDebounced(String(query || '').trim(), 300)
  const [remote, setRemote] = useState({ query: '', places: [] })

  useEffect(() => {
    if (debounced.length < 2) return undefined
    const controller = new AbortController()
    locationService.search(debounced, { signal: controller.signal, limit })
      .then((places) => { if (!controller.signal.aborted) setRemote({ query: debounced, places }) })
      .catch(() => { if (!controller.signal.aborted) setRemote({ query: debounced, places: [] }) })
    return () => controller.abort()
  }, [debounced, limit])

  const places = useMemo(() => {
    if (!needle) return popular.map(town)
    const name = needle.split(',')[0].trim()
    const towns = TOWNS.filter((label) => foldPlace(label).startsWith(name)).slice(0, 3).map(town)
    // the answer for what is typed now, or (while the next answer loads, so nothing flickers) for a
    // shorter start of it, kept only where it still matches
    const answered = foldPlace(remote.query)
    const settlements = !answered || !needle.startsWith(answered) ? []
      : answered === needle ? remote.places
        : remote.places.filter((place) => foldPlace(place.label).includes(name) || foldPlace(place.municipality).startsWith(name))
    const seen = new Set(towns.map((place) => place.label))
    const merged = [...towns, ...settlements.filter((place) => !seen.has(place.label))]
    if (!merged.length && remote.query !== debounced) {
      return TOWNS.filter((label) => foldPlace(label).includes(name)).slice(0, limit).map(town)
    }
    return merged.slice(0, limit)
  }, [needle, remote, popular, limit, debounced])

  // still typing, or the answer for what was typed has not arrived yet
  return { places, loading: needle.length >= 2 && remote.query !== String(query || '').trim() }
}
