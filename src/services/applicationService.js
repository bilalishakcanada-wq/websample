import { supabase } from '../lib/supabase'
import { publicError, sanitizeText } from '../utils/validation'

export const applicationService = {
  async listForListing(listingId) {
    if (!/^[0-9a-f-]{36}$/i.test(listingId)) return []

    const { data, error } = await supabase
      .from('applications')
      .select('id, listing_id, user_id, message, status, created_at')
      .eq('listing_id', listingId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Supabase applications fetch failed', { message: error.message, code: error.code, details: error.details, hint: error.hint })
      throw publicError()
    }
    return data || []
  },

  async createOffer({ listingId, userId, amount, message }) {
    const cleanMessage = sanitizeText(message).slice(0, 2000)
    const cleanAmount = Number(amount)
    if (!listingId || !userId || !Number.isFinite(cleanAmount) || cleanAmount < 0 || !cleanMessage) {
      throw new Error('Unesite iznos i kratku poruku za ponudu.')
    }

    const { data, error } = await supabase
      .from('applications')
      .insert({ listing_id: listingId, user_id: userId, message: `${cleanAmount.toFixed(2)} KM|${cleanMessage}` })
      .select('id, listing_id, user_id, message, status, created_at')
      .single()

    if (error) {
      console.error('Supabase offer insert failed', { message: error.message, code: error.code, details: error.details, hint: error.hint })
      throw publicError()
    }
    return data
  },

  async acceptOffer(applicationId) {
    const { data, error } = await supabase
      .from('applications')
      .update({ status: 'accepted' })
      .eq('id', applicationId)
      .select('id, listing_id, user_id, message, status, created_at')
      .single()

    if (error) {
      console.error('Supabase offer acceptance failed', { message: error.message, code: error.code, details: error.details, hint: error.hint })
      throw publicError()
    }
    return data
  },
}
