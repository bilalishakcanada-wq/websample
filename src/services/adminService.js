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
      .select('id, user_id, full_name, email, city, subscription_status, account_status, created_at, display_uid')
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
      .select('id, user_id, document_url, note, trade, status, created_at')
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

  async setVerificationStatus(id, status) {
    const { error } = await supabase.from('verification_requests').update({ status }).eq('id', id)
    if (error) {
      console.error('Admin verification status update failed', { message: error.message, code: error.code })
      throw publicError()
    }
  },
}
