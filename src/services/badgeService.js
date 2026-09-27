import { supabase } from '../lib/supabase'

export const badgeService = {
  async listForUser(userId) {
    const { data, error } = await supabase
      .from('user_badges')
      .select('awarded_at, badges(code, label, description, icon)')
      .eq('user_id', userId)

    if (error) {
      console.error('Supabase badges fetch failed', { message: error.message, code: error.code })
      return []
    }
    return (data || []).map((row) => row.badges).filter(Boolean)
  },

  async myVerificationStatus(userId) {
    const { data } = await supabase
      .from('verification_requests')
      .select('status, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    return data
  },
}
