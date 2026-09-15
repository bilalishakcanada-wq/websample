import { supabase } from '../lib/supabase'

export const providerService = {
  async listRanked({ category = null, limit = 6 } = {}) {
    const { data, error } = await supabase.rpc('ranked_providers', { category_filter: category, limit_count: limit })
    if (error) {
      console.error('Supabase ranked providers fetch failed', { message: error.message, code: error.code })
      return []
    }
    return data || []
  },
}
