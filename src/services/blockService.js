import { supabase } from '../lib/supabase'
import { publicError } from '../utils/validation'

// Blocked users — table user_blocks (supabase/communication/04_user_blocks.sql). Google Play's
// user-generated-content policy asks for blocking next to reporting. The database refuses
// messages, offers and listing questions between blocked users; this list only drives the UI.
// Before the migration is applied the table doesn't exist: the list is empty and blocking says so.
const isMissingTable = (error) => error?.code === '42P01' || error?.code === 'PGRST205' || /user_blocks/.test(error?.message || '')

export const blockService = {
  /** Users I blocked, newest first: [{ user_id, display_name, avatar_url, created_at }]. */
  async list(userId) {
    if (!userId) return []
    const { data, error } = await supabase
      .from('user_blocks')
      .select('blocked_id, created_at')
      .eq('blocker_id', userId)
      .order('created_at', { ascending: false })
    if (error) {
      if (!isMissingTable(error)) console.error('blocked users fetch failed', error.message)
      return []
    }
    const ids = (data || []).map((row) => row.blocked_id)
    if (ids.length === 0) return []
    const { data: people } = await supabase.from('public_profiles').select('user_id, display_name, avatar_url').in('user_id', ids)
    const byId = new Map((people || []).map((person) => [person.user_id, person]))
    return data.map((row) => ({ user_id: row.blocked_id, created_at: row.created_at, display_name: byId.get(row.blocked_id)?.display_name || 'Korisnik', avatar_url: byId.get(row.blocked_id)?.avatar_url || null }))
  },

  async set(userId, otherId, blocked) {
    const { error } = blocked
      ? await supabase.from('user_blocks').insert({ blocker_id: userId, blocked_id: otherId })
      : await supabase.from('user_blocks').delete().eq('blocker_id', userId).eq('blocked_id', otherId)
    if (error && error.code !== '23505') {
      if (isMissingTable(error)) throw new Error('Blokiranje još nije uključeno. Za sada prijavi korisnika.')
      console.error('block toggle failed', error.message)
      throw publicError()
    }
  },
}
