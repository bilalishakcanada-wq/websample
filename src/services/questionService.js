import { supabase } from '../lib/supabase'
import { publicError, sanitizeText } from '../utils/validation'

/** Public Q&A under a job: anyone signed in can ask, the owner answers in the same thread. */
export const questionService = {
  async list(listingId) {
    if (!/^[0-9a-f-]{36}$/i.test(listingId)) return []
    const { data, error } = await supabase
      .from('listing_questions')
      .select('id, listing_id, user_id, body, created_at, author:public_profiles!listing_questions_user_id_fkey(display_name, avatar_url)')
      .eq('listing_id', listingId)
      .order('created_at', { ascending: true })
    if (error) {
      const plain = await supabase.from('listing_questions').select('id, listing_id, user_id, body, created_at').eq('listing_id', listingId).order('created_at', { ascending: true })
      if (plain.error) { console.error('questions fetch failed', plain.error.message); throw publicError() }
      return plain.data || []
    }
    return data || []
  },

  async ask({ listingId, userId, body }) {
    const clean = sanitizeText(body).slice(0, 1000)
    if (!clean || clean.length < 3) throw new Error('Napiši pitanje (bar 3 znaka).')
    const { data, error } = await supabase
      .from('listing_questions')
      .insert({ listing_id: listingId, user_id: userId, body: clean })
      .select('id, listing_id, user_id, body, created_at')
      .single()
    if (error) {
      console.error('question insert failed', error.message)
      throw new Error(error.message?.includes('moderat') ? 'Pitanje sadrži sadržaj koji nije dozvoljen.' : 'Pitanje nije poslano. Pokušaj ponovo.')
    }
    return data
  },
}
