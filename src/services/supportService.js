import { supabase } from '../lib/supabase'
import { publicError, sanitizeText } from '../utils/validation'

export const supportService = {
  /** Ask the AI assistant. Resolves { configured:false } when the API key is missing so the caller can fall back. */
  async askAssistant(message, articles, guide = [], since = null) {
    try {
      const { data, error } = await supabase.functions.invoke('support-assistant', { body: { message, articles, guide, since } })
      if (error) throw error
      return data || { configured: false }
    } catch (invokeError) {
      console.warn('Support assistant unavailable', { message: invokeError.message })
      return { configured: false }
    }
  },

  /**
   * What the assistant may know about the signed-in user: their own jobs, offers, Zadatak Pay
   * payments and balance, each read through their own RLS. Best-effort: a failed part is left out.
   */
  async myContext(userId) {
    const safe = (promise) => Promise.resolve(promise).then(({ data, error }) => (error ? null : data)).catch(() => null)
    const [profile, listings, bids, payments, wallet] = await Promise.all([
      safe(supabase.from('profiles').select('full_name, account_type').eq('user_id', userId).maybeSingle()),
      safe(supabase.from('listings').select('id, title, status, created_at, bids(count)').eq('user_id', userId).order('created_at', { ascending: false }).limit(8)),
      safe(supabase.from('bids').select('id, amount, status, created_at, listing:listings(title)').eq('bidder_id', userId).order('created_at', { ascending: false }).limit(8)),
      safe(supabase.from('job_payments').select('id, amount, status, created_at, listing:listings(title)').or(`client_id.eq.${userId},provider_id.eq.${userId}`).order('created_at', { ascending: false }).limit(6)),
      safe(supabase.rpc('my_wallet')),
    ])
    return {
      firstName: String(profile?.full_name || '').split(' ')[0] || '',
      accountType: profile?.account_type || null,
      balance: wallet?.balance ?? null,
      lastTransaction: wallet?.transactions?.[0] || null,
      listings: (listings || []).map((row) => ({ id: row.id, title: row.title, status: row.status, bidCount: Number(row.bids?.[0]?.count) || 0 })),
      bids: (bids || []).map((row) => ({ id: row.id, amount: row.amount, status: row.status, title: row.listing?.title })),
      payments: (payments || []).map((row) => ({ id: row.id, amount: row.amount, status: row.status, title: row.listing?.title })),
    }
  },

  async listMyMessages(userId) {
    const { data, error } = await supabase
      .from('support_messages')
      .select('id, user_id, sender, message, created_at, handoff')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Supabase support messages fetch failed', { message: error.message, code: error.code })
      throw publicError()
    }
    return data || []
  },

  async send({ userId, sender = 'user', message, needsHuman = true, handoff = false }) {
    const cleanMessage = sanitizeText(message).slice(0, 2000)
    if (!cleanMessage) throw new Error('Poruka ne može biti prazna.')

    const { data, error } = await supabase
      .from('support_messages')
      .insert({ user_id: userId, sender, message: cleanMessage, needs_human: needsHuman, handoff })
      .select('id, user_id, sender, message, created_at, handoff')
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
    const { data, error } = await supabase.rpc('admin_support_threads')
    if (error) {
      console.error('Supabase admin support threads fetch failed', { message: error.message, code: error.code })
      throw publicError()
    }
    return (data || []).map((row) => ({
      userId: row.user_id,
      fullName: row.full_name,
      memberId: row.member_id,
      email: row.email,
      lastMessage: row.last_message || '',
      lastSender: row.last_sender,
      lastAt: row.last_at,
      unread: Number(row.unread) || 0,
    }))
  },

  /** Admin: every new support message on the platform, live. */
  subscribeAll(onInsert) {
    const channel = supabase
      .channel(`support-admin-${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages' }, (payload) => onInsert(payload.new))
      .subscribe()
    return () => supabase.removeChannel(channel)
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
