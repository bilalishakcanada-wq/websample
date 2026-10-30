import { supabase } from '../lib/supabase'
import { prepoznajGresku, publicError, sanitizeText } from '../utils/validation'

/** Public Q&A under a job: anyone signed in can ask, the owner answers in the same thread. */
export const questionService = {
  async list(listingId) {
    if (!/^[0-9a-f-]{36}$/i.test(listingId)) return []
    // public_profiles is a view over public_profile_cards, so PostgREST can't join it by the FK:
    // fetch the questions, then the authors' names in a second query
    const { data, error } = await supabase
      .from('listing_questions')
      .select('id, listing_id, user_id, body, created_at')
      .eq('listing_id', listingId)
      .order('created_at', { ascending: true })
    if (error) { console.error('questions fetch failed', error.message); throw publicError() }
    const authorIds = [...new Set((data || []).map((question) => question.user_id))]
    if (authorIds.length === 0) return data || []
    const { data: authors } = await supabase.from('public_profiles').select('user_id, display_name, avatar_url').in('user_id', authorIds)
    const byId = new Map((authors || []).map((author) => [author.user_id, author]))
    return (data || []).map((question) => ({ ...question, author: byId.get(question.user_id) || null }))
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
      throw prepoznajGresku(error) || new Error(error.message?.includes('moderat') ? 'Pitanje sadrži sadržaj koji nije dozvoljen.' : 'Pitanje nije poslano. Pokušaj ponovo.')
    }
    return data
  },
}
