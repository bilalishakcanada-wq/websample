import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { cityCoordinates, knowsPlace, rememberPlace } from '../data/cityCoordinates'

// Settlements of BiH (public.bih_locations). Answers are cached per query for the visit, so typing back
// and forth never asks twice, and every place seen is remembered with its point (see cityCoordinates.js).
const cache = new Map()
const pending = new Map()

const toPlace = (row) => ({
  label: row.label,
  name: row.settlement_name,
  municipality: row.municipality,
  region: row.region_canton,
  kind: row.kind,
  lat: row.lat,
  lng: row.lng,
})

export const locationService = {
  /** Places whose name (or municipality) starts with what was typed: "ote" → Otes, Ilidža · Otes, Kakanj … */
  async search(query, { signal, limit = 8 } = {}) {
    const text = String(query || '').trim().slice(0, 80)
    if (text.length < 2 || !isSupabaseConfigured) return []
    const key = `${text.toLowerCase()}|${limit}`
    if (cache.has(key)) return cache.get(key)
    let request = supabase.rpc('search_locations', { p_query: text, p_limit: limit })
    if (signal) request = request.abortSignal(signal)
    const { data, error } = await request
    if (error) throw error
    const places = (data || []).map(toPlace)
    places.forEach((place) => rememberPlace(place.label, place.lat, place.lng))
    cache.set(key, places)
    return places
  },

  /** Makes sure a stored location ("Otes, Ilidža") has its own point on this device. Resolves to true when it does. */
  async ensure(label) {
    const text = String(label || '').trim()
    if (!text || cityCoordinates[text]) return Boolean(text)
    if (knowsPlace(text)) return true
    if (!isSupabaseConfigured || !text.includes(',')) return false
    if (!pending.has(text)) {
      pending.set(text, supabase.from('bih_locations').select('label, lat, lng').eq('label', text).maybeSingle()
        .then(({ data }) => { if (data) rememberPlace(data.label, data.lat, data.lng); return Boolean(data) })
        .catch(() => false)
        .finally(() => pending.delete(text)))
    }
    return pending.get(text)
  },
}
