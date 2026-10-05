import { supabase } from '../lib/supabase'
import { publicError } from '../utils/validation'

export const badgeService = {
  async uploadVerificationDocument(userId, file) {
    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
    if (!file || !allowed.has(file.type) || file.size > 10 * 1024 * 1024) {
      throw new Error('Dokument mora biti JPG/PNG/WEBP slika ili PDF, manji od 10 MB.')
    }
    const ext = file.type.split('/')[1]
    const path = `${userId}/verification-${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage.from('media').upload(path, file, { cacheControl: '3600' })
    if (uploadError) {
      console.error('Supabase verification document upload failed', { message: uploadError.message })
      throw publicError()
    }
    const { data } = supabase.storage.from('media').getPublicUrl(path)
    return data.publicUrl
  },


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

  async requestVerification({ userId, documentUrl, note, trade }) {
    const { data, error } = await supabase
      .from('verification_requests')
      .insert({ user_id: userId, document_url: documentUrl, note, trade })
      .select('id, status')
      .single()

    if (error) {
      console.error('Supabase verification request failed', { message: error.message, code: error.code })
      throw publicError()
    }
    return data
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
