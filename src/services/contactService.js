import { supabase } from '../lib/supabase'
import { isValidEmail, publicError, sanitizeText } from '../utils/validation'

export const contactService = {
  async send({ userId = null, name, email, topic = 'other', message }) {
    const cleanName = sanitizeText(name).slice(0, 120)
    const cleanEmail = sanitizeText(email).toLowerCase().slice(0, 200)
    const cleanMessage = sanitizeText(message).slice(0, 4000)
    if (cleanName.length < 2) throw new Error('Unesi ime.')
    if (!isValidEmail(cleanEmail)) throw new Error('Unesi ispravan email.')
    if (cleanMessage.length < 10) throw new Error('Poruka je prekratka — napiši bar par rečenica.')

    const { error } = await supabase
      .from('contact_messages')
      .insert({ user_id: userId, name: cleanName, email: cleanEmail, topic, message: cleanMessage })

    if (error) {
      console.error('Supabase contact insert failed', { message: error.message, code: error.code })
      throw publicError()
    }
  },

  /** Admin: messages sent through the Kontakt page, newest first. */
  async listForAdmin(limit = 50) {
    const { data, error } = await supabase
      .from('contact_messages')
      .select('id, user_id, name, email, topic, message, status, created_at')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) {
      console.error('Supabase contact list failed', { message: error.message, code: error.code })
      throw publicError()
    }
    return data || []
  },

  /** Admin: mark a Kontakt message as handled (or open again). */
  async setStatus(id, status) {
    const { error } = await supabase.from('contact_messages').update({ status }).eq('id', id)
    if (error) {
      console.error('Supabase contact update failed', { message: error.message, code: error.code })
      throw publicError()
    }
  },

  async categoryPriceStats() {
    const { data, error } = await supabase.rpc('category_price_stats')
    if (error) {
      console.error('Supabase price stats failed', { message: error.message, code: error.code })
      return []
    }
    return data || []
  },
}
