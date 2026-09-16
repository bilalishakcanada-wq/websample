import { supabase } from '../lib/supabase'

const EMPTY = {
  users: 0,
  providers: 0,
  verified_providers: 0,
  open_listings: 0,
  total_listings: 0,
  accepted_bids: 0,
  reviews: 0,
  avg_rating: null,
  cities: 0,
}

export const statsService = {
  async platform() {
    const { data, error } = await supabase.rpc('platform_stats')
    if (error) {
      console.error('Supabase platform stats failed', { message: error.message, code: error.code })
      return EMPTY
    }
    return { ...EMPTY, ...(data || {}) }
  },
}
