import { supabase } from '../lib/supabase'
import { publicError } from '../utils/validation'

const isPrivateIp = (ip) => /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|fc|fd|fe80)/i.test(ip)

// SQL raises short codes; turn them into something a person can act on.
const staffErrorMessage = (error) => {
  const text = error?.message || ''
  if (text.includes('FORBIDDEN_STAFF')) return 'Samo administrator može djelovati na nalog člana tima.'
  if (text.includes('SELF')) return 'Ne možeš to uraditi na vlastitom nalogu.'
  if (text.includes('OWNER')) return 'Vlasnik platforme je zaštićen — ova radnja nije moguća.'
  if (text.includes('FORBIDDEN')) return 'Nemaš ovlaštenje za ovu radnju.'
  return 'Radnja nije uspjela. Pokušaj ponovo.'
}

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

  /** Users for the staff panel (search by name, ID, email, city or user id). Moderators get no emails. */
  async listUsers({ term = '', status = null, limit = 100 } = {}) {
    const { data, error } = await supabase.rpc('staff_list_users', { p_term: term, p_status: status, p_limit: limit })
    if (error) {
      console.error('Staff user list failed', { message: error.message, code: error.code })
      throw publicError()
    }
    return data || []
  },

  /** Everything about one account in one call (private fields only for admins). */
  async userDossier(userId) {
    const { data, error } = await supabase.rpc('admin_user_dossier', { p_user_id: userId })
    if (error) {
      console.error('User dossier failed', { message: error.message, code: error.code })
      throw publicError()
    }
    return data
  },

  async overview() {
    const { data, error } = await supabase.rpc('staff_overview')
    if (error) return null
    return data
  },

  /** Crash reports from the app (beta): newest first. */
  async clientErrors(limit = 40) {
    const { data, error } = await supabase
      .from('client_errors')
      .select('id, user_id, message, stack, url, user_agent, created_at')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw new Error(staffErrorMessage(error))
    return data || []
  },

  async listStaff() {
    const { data, error } = await supabase.rpc('admin_list_staff')
    if (error) {
      console.error('Staff list failed', { message: error.message, code: error.code })
      throw publicError()
    }
    return data || []
  },

  async staffActions(limit = 100) {
    const { data, error } = await supabase.rpc('admin_staff_actions', { p_limit: limit })
    if (error) {
      console.error('Staff actions failed', { message: error.message, code: error.code })
      throw publicError()
    }
    return data || []
  },

  /** Grant or remove ADMIN / MODERATOR (admin only, never on yourself). */
  async setRole(userId, role, grant) {
    const { error } = await supabase.rpc('admin_set_role', { p_user_id: userId, p_role: role, p_grant: grant })
    if (error) {
      console.error('Set role failed', { message: error.message, code: error.code })
      throw new Error(error.message?.includes('SELF') ? 'Ne možeš mijenjati vlastitu ulogu.' : staffErrorMessage(error))
    }
  },

  async badgeCatalog() {
    const { data, error } = await supabase.rpc('admin_badge_catalog')
    if (error) {
      console.error('Badge catalog failed', { message: error.message, code: error.code })
      throw publicError()
    }
    return data || []
  },

  async saveBadge({ code, label, description, icon, color, kind = 'custom' }) {
    const { data, error } = await supabase.rpc('admin_save_badge', { p_code: code, p_label: label, p_description: description || '', p_icon: icon, p_color: color || null, p_kind: kind })
    if (error) {
      console.error('Save badge failed', { message: error.message, code: error.code })
      if (error.message?.includes('BAD_CODE')) throw new Error('Kod značke: 3–40 malih slova, cifara ili _.')
      throw publicError()
    }
    return data
  },

  async deleteBadge(code) {
    const { error } = await supabase.rpc('admin_delete_badge', { p_code: code })
    if (error) {
      console.error('Delete badge failed', { message: error.message, code: error.code })
      throw new Error(error.message?.includes('SYSTEM_BADGE') ? 'Sistemske značke se ne mogu obrisati.' : 'Brisanje nije uspjelo.')
    }
  },

  async grantBadge(userId, code, note = null) {
    const { error } = await supabase.rpc('admin_grant_badge', { p_user_id: userId, p_code: code, p_note: note })
    if (error) {
      console.error('Grant badge failed', { message: error.message, code: error.code })
      throw publicError()
    }
  },

  async revokeBadge(userId, code) {
    const { error } = await supabase.rpc('admin_revoke_badge', { p_user_id: userId, p_code: code })
    if (error) {
      console.error('Revoke badge failed', { message: error.message, code: error.code })
      throw publicError()
    }
  },

  /** Add (positive) or remove (negative) credits on a user's wallet. */
  async adjustBalance(userId, amount, kind = null, note = null) {
    const { data, error } = await supabase.rpc('admin_adjust_balance', { p_user_id: userId, p_amount: amount, p_kind: kind, p_note: note })
    if (error) {
      console.error('Adjust balance failed', { message: error.message, code: error.code })
      if (error.message?.includes('INSUFFICIENT')) throw new Error('Stanje ne može biti negativno.')
      if (error.message?.includes('BAD_AMOUNT')) throw new Error('Iznos mora biti između 0,01 i 100.000 KM.')
      throw new Error(staffErrorMessage(error))
    }
    return data
  },

  async walletOverview(limit = 100) {
    const { data, error } = await supabase.rpc('admin_wallet_overview', { p_limit: limit })
    if (error) {
      console.error('Wallet overview failed', { message: error.message, code: error.code })
      throw publicError()
    }
    return data
  },

  async addNote(userId, body) {
    const { data: auth } = await supabase.auth.getUser()
    const { error } = await supabase.from('staff_notes').insert({ user_id: userId, author_id: auth?.user?.id, body: body.trim().slice(0, 2000) })
    if (error) {
      console.error('Add note failed', { message: error.message, code: error.code })
      throw publicError()
    }
  },

  async deleteNote(id) {
    const { error } = await supabase.from('staff_notes').delete().eq('id', id)
    if (error) throw publicError()
  },

  /**
   * Approximate location for a list of IPs. Cached in ip_geo; unknown ones are
   * looked up once via ipwho.is (free, no key) and stored for everyone on staff.
   */
  async geoLookup(ips) {
    const unique = [...new Set(ips.filter(Boolean))].filter((ip) => !isPrivateIp(ip))
    if (unique.length === 0) return {}
    const result = {}
    const { data: cached } = await supabase.from('ip_geo').select('*').in('ip', unique)
    for (const row of cached || []) result[row.ip] = row
    const missing = unique.filter((ip) => !result[ip]).slice(0, 15)
    await Promise.all(missing.map(async (ip) => {
      try {
        const response = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`)
        const geo = await response.json()
        if (!geo?.success) return
        const row = { ip, country: geo.country, country_code: geo.country_code, region: geo.region, city: geo.city, isp: geo.connection?.isp || null, lat: geo.latitude, lng: geo.longitude }
        result[ip] = row
        await supabase.from('ip_geo').upsert(row)
      } catch { /* offline or rate-limited — leave unknown */ }
    }))
    return result
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
    const { data, error } = await supabase.rpc('staff_moderation_events', { p_limit: 200 })
    if (error) {
      console.error('Admin moderation events fetch failed', { message: error.message, code: error.code })
      throw publicError()
    }
    // same shape the panel used before: profile fields nested under `profiles`
    return (data || []).map(({ full_name, member_id, email, account_status, ...event }) => ({ ...event, profiles: { full_name, member_id, email, account_status } }))
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
      throw new Error(staffErrorMessage(error))
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

  /** Suspend for `hours` (null = permanent). Moderators cannot touch staff accounts. */
  async suspend(userId, hours = null, reason = null) {
    const { error } = await supabase.rpc('admin_suspend_for', { p_user_id: userId, p_hours: hours, p_reason: reason })
    if (error) {
      console.error('Admin suspend failed', { message: error.message, code: error.code })
      throw new Error(staffErrorMessage(error))
    }
  },

  /** Remove content without losing history: message/bid text is replaced, reviews deleted, listings archived. */
  async redact(kind, id, note = null) {
    const { error } = await supabase.rpc('admin_redact', { p_kind: kind, p_id: id, p_note: note })
    if (error) {
      console.error('Admin redact failed', { message: error.message, code: error.code })
      throw new Error(staffErrorMessage(error))
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
