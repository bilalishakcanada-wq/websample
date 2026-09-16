import { supabase } from '../lib/supabase'
import { publicError } from '../utils/validation'

export const adminService = {
  async listAllListings() {
    const { data, error } = await supabase
      .from('listings')
      .select('id, title, category, location, price, status, created_at, user_id')
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      console.error('Admin listings fetch failed', { message: error.message, code: error.code })
      throw publicError()
    }
    return data || []
  },

  async setListingStatus(id, status) {
    const { error } = await supabase.from('listings').update({ status }).eq('id', id)
    if (error) {
      console.error('Admin listing status update failed', { message: error.message, code: error.code })
      throw publicError()
    }
  },

  async listReports() {
    const { data, error } = await supabase
      .from('reports')
      .select('id, reporter_id, target_type, target_id, reason, status, created_at')
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      console.error('Admin reports fetch failed', { message: error.message, code: error.code })
      throw publicError()
    }
    return data || []
  },

  async setReportStatus(id, status) {
    const { error } = await supabase.from('reports').update({ status }).eq('id', id)
    if (error) {
      console.error('Admin report status update failed', { message: error.message, code: error.code })
      throw publicError()
    }
  },

  async listProfiles() {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, user_id, full_name, email, city, subscription_status, account_status, suspended_until, suspension_reason, created_at, member_id, ai_assessment, ai_assessed_at')
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      console.error('Admin profiles fetch failed', { message: error.message, code: error.code })
      throw publicError()
    }
    return data || []
  },

  async setAccountStatus(userId, accountStatus) {
    const { error } = await supabase.from('profiles').update({ account_status: accountStatus }).eq('user_id', userId)
    if (error) {
      console.error('Admin account status update failed', { message: error.message, code: error.code })
      throw publicError()
    }
  },

  async getUserDetail(userId) {
    const [listingsRes, bidsRes, supportRes, reportsRes] = await Promise.all([
      supabase.from('listings').select('id, title, status, created_at').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('bids').select('id, listing_id, amount, message, status, created_at').eq('bidder_id', userId).order('created_at', { ascending: false }),
      supabase.from('support_messages').select('id, sender, message, created_at').eq('user_id', userId).order('created_at', { ascending: true }),
      supabase.from('reports').select('id, target_type, target_id, reason, status, created_at').eq('reporter_id', userId).order('created_at', { ascending: false }),
    ])
    return {
      listings: listingsRes.data || [],
      bids: bidsRes.data || [],
      supportMessages: supportRes.data || [],
      reports: reportsRes.data || [],
    }
  },

  async listVerificationRequests() {
    const { data, error } = await supabase
      .from('verification_requests')
      .select('id, user_id, document_url, note, trade, kind, licence_type, status, created_at')
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      console.error('Admin verification requests fetch failed', { message: error.message, code: error.code })
      throw publicError()
    }
    return data || []
  },

  async refreshBadges() {
    const { error } = await supabase.rpc('refresh_provider_badges')
    if (error) {
      console.error('Admin badge refresh failed', { message: error.message, code: error.code })
      throw publicError()
    }
  },

  async listModerationEvents() {
    const { data, error } = await supabase
      .from('moderation_events')
      .select('id, user_id, source_table, source_id, fields, kinds, snippet, action, dismissed, created_at, profiles!moderation_events_user_id_fkey(full_name, email, member_id, account_status)')
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) {
      console.error('Admin moderation events fetch failed', { message: error.message, code: error.code })
      throw publicError()
    }
    return data || []
  },

  async listModerationQueue() {
    const { data, error } = await supabase
      .from('moderation_queue')
      .select('id, user_id, kind, media_url, status, attempts, result, created_at, processed_at')
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) {
      console.error('Admin moderation queue fetch failed', { message: error.message, code: error.code })
      throw publicError()
    }
    return data || []
  },

  async dismissModerationEvent(id, dismissed = true) {
    const { error } = await supabase.from('moderation_events').update({ dismissed, reviewed_at: new Date().toISOString() }).eq('id', id)
    if (error) {
      console.error('Admin moderation dismiss failed', { message: error.message, code: error.code })
      throw publicError()
    }
  },

  async liftSuspension(userId) {
    const { error } = await supabase.rpc('admin_lift_suspension', { p_user_id: userId })
    if (error) {
      console.error('Admin lift suspension failed', { message: error.message, code: error.code })
      throw publicError()
    }
  },

  /** Search the member register by private ID, email, name or user id (deleted accounts included). */
  async lookupMember(term) {
    const { data, error } = await supabase.rpc('admin_lookup_member', { p_term: term || '' })
    if (error) {
      console.error('Admin member lookup failed', { message: error.message, code: error.code })
      throw publicError()
    }
    return data || []
  },

  /** Everything happening on the platform, newest first (listings, bids, messages, reviews, accounts, Rule #1, reports). */
  async activityFeed({ limit = 150, kind = null, userId = null } = {}) {
    const { data, error } = await supabase.rpc('admin_activity_feed', { p_limit: limit, p_kind: kind, p_user: userId })
    if (error) {
      console.error('Admin activity feed failed', { message: error.message, code: error.code })
      throw publicError()
    }
    return data || []
  },

  /** Realtime: call `onChange` whenever a row is inserted in any watched table. Returns an unsubscribe function. */
  subscribeFeed(onChange) {
    const channel = supabase.channel(`admin-oversight-${Math.random().toString(36).slice(2, 8)}`)
    for (const table of ['listings', 'bids', 'messages', 'reviews', 'moderation_events']) {
      channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table }, (payload) => onChange(table, payload.new))
    }
    channel.subscribe()
    return () => supabase.removeChannel(channel)
  },

  async suspend(userId, days = null, reason = null) {
    const { error } = await supabase.rpc('admin_suspend', { p_user_id: userId, p_days: days, p_reason: reason })
    if (error) {
      console.error('Admin suspend failed', { message: error.message, code: error.code })
      throw publicError()
    }
  },

  /** Remove content without losing history: message/bid text is replaced, reviews deleted, listings archived. */
  async redact(kind, id, note = null) {
    const { error } = await supabase.rpc('admin_redact', { p_kind: kind, p_id: id, p_note: note })
    if (error) {
      console.error('Admin redact failed', { message: error.message, code: error.code })
      throw publicError()
    }
  },

  /** Ask the AI trust agent to (re)assess one account now. */
  async runTrustAgent(userId) {
    const { data, error } = await supabase.functions.invoke('trust-agent', { body: { user_id: userId } })
    if (error) throw new Error('AI agent trenutno nije dostupan.')
    return data
  },

  async getAssessment(userId) {
    const { data } = await supabase.from('profiles').select('ai_assessment, ai_assessed_at').eq('user_id', userId).maybeSingle()
    return data || null
  },

  /** All conversations on the platform with both participants. */
  async listConversations(limit = 100) {
    const { data, error } = await supabase.rpc('admin_conversations', { p_limit: limit })
    if (error) {
      console.error('Admin conversations fetch failed', { message: error.message, code: error.code })
      throw publicError()
    }
    return data || []
  },

  async conversationMessages(conversationId) {
    const { data, error } = await supabase
      .from('messages')
      .select('id, sender_id, receiver_id, content, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
    if (error) {
      console.error('Admin conversation messages fetch failed', { message: error.message, code: error.code })
      throw publicError()
    }
    return data || []
  },

  async setVerificationStatus(id, status) {
    const { error } = await supabase.from('verification_requests').update({ status }).eq('id', id)
    if (error) {
      console.error('Admin verification status update failed', { message: error.message, code: error.code })
      throw publicError()
    }
  },
}
