import { supabase } from '../lib/supabase'
import { publicError, sanitizeText } from '../utils/validation'

export const reportService = {
  async createReport({ reporterId, targetType, targetId, reason }) {
    const cleanReason = sanitizeText(reason).slice(0, 500)
    if (!cleanReason) throw new Error('Unesite razlog prijave.')

    const { data, error } = await supabase
      .from('reports')
      .insert({ reporter_id: reporterId, target_type: targetType, target_id: targetId, reason: cleanReason })
      .select('id')
      .single()

    if (error) {
      console.error('Supabase report insert failed', { message: error.message, code: error.code })
      throw publicError()
    }
    return data
  },
}
