import { supabase } from '../lib/supabase'
import { publicError } from '../utils/validation'

// SQL raises short codes; say what the person can do about it.
const friendly = (error) => {
  const text = error?.message || ''
  if (text.includes('INSUFFICIENT')) return 'Nemaš dovoljno sredstava na balansu za ovu ponudu.'
  if (text.includes('BID_NOT_PENDING')) return 'Ova ponuda više nije aktivna.'
  if (text.includes('LISTING_NOT_OPEN')) return 'Posao više nije otvoren za ponude.'
  if (text.includes('ALREADY_FUNDED')) return 'Za ovaj posao je već osigurana uplata.'
  if (text.includes('BAD_STATUS')) return 'Ova radnja trenutno nije moguća — osvježi stranicu.'
  if (text.includes('REASON_REQUIRED')) return 'Opiši problem u bar par riječi.'
  if (text.includes('SUSPENDED')) return 'Nalog je suspendovan.'
  if (text.includes('FORBIDDEN')) return 'Nemaš ovlaštenje za ovu radnju.'
  return 'Radnja nije uspjela. Pokušaj ponovo.'
}

const call = async (fn, args) => {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) {
    console.error(`${fn} failed`, { message: error.message, code: error.code })
    throw new Error(friendly(error))
  }
  return data
}

/** Poso.ba Pay: money is held on the platform from acceptance until the client releases it. */
export const paymentService = {
  async forListing(listingId) {
    const { data, error } = await supabase.from('job_payments').select('*').eq('listing_id', listingId).maybeSingle()
    if (error) {
      console.error('Job payment fetch failed', { message: error.message, code: error.code })
      throw publicError()
    }
    return data
  },

  /** Provider's current fee percent — shown to the client before accepting. */
  async feePercentFor(userId) {
    const { data } = await supabase.rpc('fee_percent_for', { p_user_id: userId })
    return Number(data ?? 15)
  },

  acceptAndFund: (bidId) => call('accept_offer_and_fund', { p_bid_id: bidId }),
  requestPayment: (listingId) => call('request_job_payment', { p_listing_id: listingId }),
  releasePayment: (listingId) => call('release_job_payment', { p_listing_id: listingId }),
  cancelJob: (listingId, reason = null) => call('cancel_job_payment', { p_listing_id: listingId, p_reason: reason }),
  openDispute: (listingId, reason) => call('open_job_dispute', { p_listing_id: listingId, p_reason: reason }),

  /** Realtime: refresh when the other side moves the job forward. */
  subscribe(listingId, onChange) {
    const channel = supabase.channel(`job-pay-${listingId}-${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_payments', filter: `listing_id=eq.${listingId}` }, (payload) => onChange(payload.new))
      .subscribe()
    return () => supabase.removeChannel(channel)
  },

  // staff
  async adminOverview(limit = 100) {
    const { data, error } = await supabase.rpc('admin_job_payments', { p_limit: limit })
    if (error) throw publicError()
    return data
  },
  adminResolve: (listingId, action, providerShare = null, note = null) => call('admin_resolve_job', { p_listing_id: listingId, p_action: action, p_provider_share: providerShare, p_note: note }),
}
