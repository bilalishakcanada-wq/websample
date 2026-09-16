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

  async categoryPriceStats() {
    const { data, error } = await supabase.rpc('category_price_stats')
    if (error) {
      console.error('Supabase price stats failed', { message: error.message, code: error.code })
      return []
    }
    return data || []
  },
}
