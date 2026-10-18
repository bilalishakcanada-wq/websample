import { supabase } from '../lib/supabase'
import { prepoznajGresku, publicError, sanitizeText } from '../utils/validation'

// Molba za plaćen prevoz (supabase/reach/01): the only thing a provider who is too far from a job
// may send. The client accepts or declines; once accepted, that provider may offer on the job.
export const TRAVEL_KINDS = [
  { value: 'gorivo', label: 'Gorivo' },
  { value: 'taksi', label: 'Taksi' },
  { value: 'prevoz', label: 'Prevoz (autobus, voz)' },
]
export const travelKindLabel = (kind) => TRAVEL_KINDS.find((item) => item.value === kind)?.label || 'Prevoz'

const COLUMNS = 'id, listing_id, provider_id, client_id, kind, amount, note, distance_km, status, created_at, answered_at'

export const travelService = {
  /** The client's requests on one job (newest first) with the provider's public name; the provider gets only their own (RLS). */
  async forListing(listingId) {
    if (!/^[0-9a-f-]{36}$/i.test(listingId || '')) return []
    const { data, error } = await supabase.from('travel_requests').select(COLUMNS).eq('listing_id', listingId).order('created_at', { ascending: false })
    if (error) return [] // table not on this database yet
    const ids = [...new Set((data || []).map((row) => row.provider_id))]
    if (ids.length === 0) return []
    const { data: people } = await supabase.from('public_profiles').select('user_id, display_name, avatar_url').in('user_id', ids)
    const byId = new Map((people || []).map((person) => [person.user_id, person]))
    return data.map((row) => ({ ...row, provider: byId.get(row.provider_id) || null }))
  },

  async send({ listingId, kind, amount, note }) {
    const value = Number(String(amount).replace(',', '.'))
    if (!Number.isFinite(value) || value < 1) throw new Error('Upiši koliko košta prevoz (u KM).')
    const { data, error } = await supabase.rpc('request_travel', {
      p_listing: listingId, p_kind: kind, p_amount: Math.round(value * 100) / 100, p_note: sanitizeText(note || '').slice(0, 300) || null,
    })
    if (error) {
      console.error('travel request failed', error.message)
      throw prepoznajGresku(error) || (/Pravilo #1/.test(error.message) ? new Error(error.message) : publicError())
    }
    return data
  },

  async answer(requestId, accept) {
    const { data, error } = await supabase.rpc('answer_travel_request', { p_request: requestId, p_accept: accept })
    if (error) { console.error('travel answer failed', error.message); throw prepoznajGresku(error) || publicError() }
    return data
  },
}
