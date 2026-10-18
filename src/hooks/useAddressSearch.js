import { useEffect, useState } from 'react'
import { placeService } from '../services/placeService'
import { useDebounced } from './useDebounced'

// a house number or a second part after a comma ("Butmir, Ilirska 1") means a street address, not a town
export const looksLikeAddress = (text) => /\d/.test(text) || /,\s*\S/.test(text)

/**
 * Street addresses in BiH for what was typed ("Butmir Ilirska 1"), through the geocode function
 * (OpenStreetMap, one request per pause in typing, answers kept). `enabled` is off while the town
 * list already answers, so plain town names never reach the geocoder. Returns { addresses, loading }.
 */
export function useAddressSearch(query, { enabled = true, near = null } = {}) {
  const typed = String(query || '').trim()
  const debounced = useDebounced(typed, 500)
  const [answer, setAnswer] = useState({ query: '', addresses: [] })
  const nearLat = near?.lat ?? null
  const nearLng = near?.lng ?? null
  const asking = enabled && debounced.length >= 4

  useEffect(() => {
    if (!asking) return undefined
    let alive = true
    const point = nearLat != null && nearLng != null ? { lat: nearLat, lng: nearLng } : null
    placeService.findAddress(debounced, point)
      .then((addresses) => { if (alive) setAnswer({ query: debounced, addresses }) })
      .catch(() => { if (alive) setAnswer({ query: debounced, addresses: [] }) })
    return () => { alive = false }
  }, [asking, debounced, nearLat, nearLng])

  if (!enabled || typed.length < 4) return { addresses: [], loading: false }
  return { addresses: answer.query === typed ? answer.addresses : [], loading: answer.query !== typed }
}
