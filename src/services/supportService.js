import { supabase } from '../lib/supabase'
import { publicError, sanitizeText } from '../utils/validation'

export const supportService = {
  async listMyMessages(userId) {
    const { data, error } = await supabase
      .from('support_messages')
      .select('id, user_id, sender, message, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Supabase support messages fetch failed', { message: error.message, code: error.code })
      throw publicError()
    }
    return data || []
  },

  async send({ userId, sender = 'user', message }) {
    const cleanMessage = sanitizeText(message).slice(0, 2000)
    if (!cleanMessage) throw new Error('Poruka ne može biti prazna.')

    const { data, error } = await supabase
      .from('support_messages')
      .insert({ user_id: userId, sender, message: cleanMessage })
      .select('id, user_id, sender, message, created_at')
      .single()

    if (error) {
      console.error('Supabase support message insert failed', { message: error.message, code: error.code })
      throw publicError()
    }
    return data
  },

  subscribeToMyMessages(userId, onInsert) {
    const channel = supabase
      .channel(`support-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages', filter: `user_id=eq.${userId}` }, (payload) => onInsert(payload.new))
      .subscribe()
    return () => supabase.removeChannel(channel)
  },

  async listThreadsForAdmin() {
    const { data, error } = await supabase
      .from('support_messages')
      .select('id, user_id, sender, message, created_at, read_at')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Supabase admin support threads fetch failed', { message: error.message, code: error.code })
      throw publicError()
    }

    const byUser = new Map()
    for (const row of data || []) {
      if (!byUser.has(row.user_id)) {
        byUser.set(row.user_id, { userId: row.user_id, lastMessage: row.message, lastSender: row.sender, lastAt: row.created_at, unread: 0 })
      }
      if (row.sender === 'user' && !row.read_at) byUser.get(row.user_id).unread += 1
    }
    return Array.from(byUser.values())
  },

  async markThreadRead(userId) {
    const { error } = await supabase
      .from('support_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('sender', 'user')
      .is('read_at', null)

    if (error) console.error('Supabase support thread mark-read failed', { message: error.message, code: error.code })
  },
}
