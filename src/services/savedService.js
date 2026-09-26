import { supabase } from '../lib/supabase'
import { publicError } from '../utils/validation'

// Saved jobs ("Sačuvano") — private bookmarks, table saved_listings (supabase/airtasker/03).
// Before that migration is applied the table doesn't exist: reads return nothing and saving
// says it isn't available yet, instead of breaking the page.
const isMissingTable = (error) => error?.code === '42P01' || error?.code === 'PGRST205' || /saved_listings/.test(error?.message || '')

export const savedService = {
  async ids(userId) {
    if (!userId) return []
    const { data, error } = await supabase.from('saved_listings').select('listing_id').eq('user_id', userId)
    if (error) return []
    return (data || []).map((row) => row.listing_id)
  },

  async list(userId) {
    if (!userId) return []
    const { data, error } = await supabase
      .from('saved_listings')
      .select('created_at, listing:listings(id, title, category, location, price, currency, status, created_at, date_type, due_date, time_of_day, bid_count, listing_images(url, position))')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (error) {
      if (!isMissingTable(error)) console.error('saved listings fetch failed', error.message)
      return []
    }
    // a saved job that was deleted or is no longer visible comes back without its listing
    return (data || []).map((row) => row.listing).filter(Boolean)
  },

  async set(userId, listingId, saved) {
    const { error } = saved
      ? await supabase.from('saved_listings').insert({ user_id: userId, listing_id: listingId })
      : await supabase.from('saved_listings').delete().eq('user_id', userId).eq('listing_id', listingId)
    if (error && error.code !== '23505') {
      if (isMissingTable(error)) throw new Error('Čuvanje poslova još nije uključeno.')
      console.error('saved listing toggle failed', error.message)
      throw publicError()
    }
  },
}
