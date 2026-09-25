import { supabase } from '../lib/supabase'
import { prepoznajGresku, publicError, sanitizeText } from '../utils/validation'

export const bidService = {
  async listForListing(listingId) {
    if (!/^[0-9a-f-]{36}$/i.test(listingId)) return []

    const { data, error } = await supabase
      .from('bids')
      .select('id, listing_id, bidder_id, amount, message, status, created_at, bidder:public_profiles!bids_bidder_id_fkey(display_name, avatar_url)')
      .eq('listing_id', listingId)
      .order('created_at', { ascending: false })

    if (!error) return data || []

    const { data: bids, error: plainError } = await supabase
      .from('bids')
      .select('id, listing_id, bidder_id, amount, message, status, created_at')
      .eq('listing_id', listingId)
      .order('created_at', { ascending: false })

    if (plainError) {
      console.error('Supabase bids fetch failed', { message: plainError.message, code: plainError.code })
      throw prepoznajGresku(error) || publicError()
    }

    const bidderIds = [...new Set((bids || []).map((bid) => bid.bidder_id))]
    if (bidderIds.length === 0) return bids || []

    const { data: bidders } = await supabase.from('public_profiles').select('user_id, display_name, avatar_url').in('user_id', bidderIds)
    const byId = new Map((bidders || []).map((bidder) => [bidder.user_id, bidder]))
    return (bids || []).map((bid) => ({ ...bid, bidder: byId.get(bid.bidder_id) || null }))
  },

  /** The signed-in provider's offers with the job they belong to (newest first). */
  async listMine(userId, limit = 50) {
    const { data, error } = await supabase
      .from('bids')
      .select('id, listing_id, amount, message, status, created_at, listing:listings(id, title, status, location, price, created_at)')
      .eq('bidder_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) {
      console.error('Supabase my bids fetch failed', { message: error.message, code: error.code })
      return []
    }
    return data || []
  },

  /** Rating / completion rate for everyone who made an offer on this job (offer cards). */
  async bidderMetrics(listingId) {
    if (!/^[0-9a-f-]{36}$/i.test(listingId)) return {}
    const { data, error } = await supabase.rpc('bidder_metrics', { p_listing_id: listingId })
    if (error) return {}
    return Object.fromEntries((data || []).map((row) => [row.user_id, row]))
  },

  async createBid({ listingId, bidderId, amount, message }) {
    const cleanMessage = sanitizeText(message).slice(0, 2000)
    const cleanAmount = Number(amount)
    if (!listingId || !bidderId || !Number.isFinite(cleanAmount) || cleanAmount < 0 || !cleanMessage) {
      throw new Error('Unesite iznos i kratko obrazloženje ponude.')
    }

    const { data, error } = await supabase
      .from('bids')
      .insert({ listing_id: listingId, bidder_id: bidderId, amount: cleanAmount, message: cleanMessage })
      .select('id, listing_id, bidder_id, amount, message, status, created_at')
      .single()

    if (error) {
      console.error('Supabase bid insert failed', { message: error.message, code: error.code })
      throw prepoznajGresku(error) || publicError()
    }
    return data
  },

  async setStatus(bidId, status) {
    const { data, error } = await supabase
      .from('bids')
      .update({ status })
      .eq('id', bidId)
      .select('id, listing_id, bidder_id, amount, message, status, created_at')
      .single()

    if (error) {
      console.error('Supabase bid status update failed', { message: error.message, code: error.code })
      throw prepoznajGresku(error) || publicError()
    }
    return data
  },
}
