import { isSupabaseConfigured, supabase } from '../lib/supabase'

// Exact locations: a street address or a GPS point, for a job (seen only by its owner and the provider
// whose offer was accepted) and for a person (used by recommendations, matching and "blizu mene").
// The public point of a job is the same place rounded to about 1 km (supabase/algorithms/01).

const geocodeCache = new Map()

const callGeocode = async (body) => {
  if (!isSupabaseConfigured) return []
  const key = JSON.stringify(body)
  if (geocodeCache.has(key)) return geocodeCache.get(key)
  const { data, error } = await supabase.functions.invoke('geocode', { body })
  if (error) throw error
  const results = Array.isArray(data?.results) ? data.results : []
  geocodeCache.set(key, results)
  return results
}

const cleanPoint = (point) => ({
  p_address: String(point.address || '').trim().slice(0, 200) || null,
  p_lat: Number(point.lat),
  p_lng: Number(point.lng),
  p_accuracy_m: Number.isFinite(point.accuracy) ? Math.round(point.accuracy) : null,
  p_source: ['typed', 'gps', 'map'].includes(point.source) ? point.source : 'map',
})

export const placeService = {
  /** "Ilirska 67" → up to 6 places in BiH, the ones near `near` ({ lat, lng }) first. */
  async findAddress(query, near = null) {
    const q = String(query || '').trim()
    if (q.length < 3) return []
    return callGeocode(near ? { q, near: { lat: near.lat, lng: near.lng } } : { q })
  },

  /** Point → the street address there ("Ilirska 67, Novo Sarajevo"), or null. */
  async addressAt(lat, lng) {
    const [first] = await callGeocode({ lat: Number(lat.toFixed(5)), lng: Number(lng.toFixed(5)) })
    return first || null
  },

  async setListingAddress(listingId, point) {
    const { error } = await supabase.rpc('set_listing_address', { p_listing: listingId, ...cleanPoint(point) })
    if (error) throw new Error(error.message)
  },

  async clearListingAddress(listingId) {
    const { error } = await supabase.rpc('clear_listing_address', { p_listing: listingId })
    if (error) throw new Error(error.message)
  },

  /** The exact address of a job, for its owner and the accepted provider; null for everyone else. */
  async listingAddress(listingId) {
    if (!isSupabaseConfigured || !listingId) return null
    const { data, error } = await supabase.rpc('listing_address', { p_listing: listingId })
    if (error) return null
    return data?.[0] || null
  },

  async myLocation(userId) {
    if (!isSupabaseConfigured || !userId) return null
    const { data } = await supabase.from('profile_locations').select('address, lat, lng, accuracy_m, source').eq('user_id', userId).maybeSingle()
    return data || null
  },

  async setMyLocation(point) {
    const { error } = await supabase.rpc('set_my_location', cleanPoint(point))
    if (error) throw new Error(error.message)
  },

  async clearMyLocation() {
    const { error } = await supabase.rpc('clear_my_location')
    if (error) throw new Error(error.message)
  },
}
