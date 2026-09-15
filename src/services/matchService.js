import { supabase } from '../lib/supabase'

export const matchService = {
  async recommendedListings(limit = 6) {
    const { data, error } = await supabase.rpc('recommended_listings', { limit_count: limit })
    if (error) {
      console.error('Supabase recommended listings failed', { message: error.message, code: error.code })
      return []
    }
    return data || []
  },

  async providersForListing(listingId, limit = 5) {
    const { data, error } = await supabase.rpc('match_providers_for_listing', {
      p_listing_id: listingId,
      limit_count: limit,
    })
    if (error) {
      console.error('Supabase provider match failed', { message: error.message, code: error.code })
      return []
    }
    return data || []
  },
}
