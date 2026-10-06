import { supabase } from '../lib/supabase'

export const badgeService = {
  /**
   * Kodovi značaka prijavljenog korisnika (user_credentials u bazi, job_conditions.sql).
   * Dok funkcija nije u bazi, čita javne značke direktno — isti rezultat, bez 'id_verified'
   * iz JMBG toka (to sučelje ionako provjerava kroz kapiju identiteta).
   */
  async myCredentials(userId) {
    const { data, error } = await supabase.rpc('user_credentials')
    if (!error && Array.isArray(data)) return data
    const rows = await this.listForUser(userId)
    return rows.map((badge) => badge.code)
  },

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

  /** Sve značke (javne): nivo, težina i uputa za rangiranje. Prije badges/01 SQL-a kolone ne postoje — `*` to podnosi. */
  async catalog() {
    const { data, error } = await supabase.from('badges').select('*')
    if (error) {
      console.error('Supabase badge catalog fetch failed', { message: error.message, code: error.code })
      return []
    }
    return data || []
  },

  /** Trezor vlasnika: sve značke, osvojene i zaključane, s napretkom. null dok my_badge_vault nije na bazi. */
  async myVault() {
    const { data, error } = await supabase.rpc('my_badge_vault')
    if (error) {
      if (error.code !== 'PGRST202') console.error('Supabase badge vault failed', { message: error.message, code: error.code })
      return null
    }
    return data?.badges || []
  },
}
