import { supabase } from '../lib/supabase'

export const trustService = {
  async getSummary(userId) {
    const { data, error } = await supabase.rpc('trust_summary', { p_user_id: userId })
    if (error) {
      console.error('Supabase trust summary failed', { message: error.message, code: error.code })
      return null
    }
    return data?.[0] || null
  },

  async touchLastSeen() {
    const { error } = await supabase.rpc('touch_last_seen')
    if (error) console.warn('touch_last_seen failed', error.message)
  },
}
