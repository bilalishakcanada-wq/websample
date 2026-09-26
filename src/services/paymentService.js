import { supabase } from '../lib/supabase'
import { publicError } from '../utils/validation'

// SQL raises short codes; say what the person can do about it.
const friendly = (error) => {
  const text = error?.message || ''
  if (text.includes('INSUFFICIENT')) return 'Nemaš dovoljno sredstava na balansu za ovu ponudu.'
  if (text.includes('BID_NOT_PENDING')) return 'Ova ponuda više nije aktivna.'
  if (text.includes('PONUDA_PROMIJENJENA')) return 'Izvođač je u međuvremenu promijenio iznos ponude. Osvježi stranicu i provjeri novi iznos prije plaćanja.'
  if (text.includes('PONUDA_NA_SVOJ_OGLAS')) return 'Ne možeš prihvatiti ponudu na vlastiti posao.'
  if (text.includes('JEDNOSTRANO_OTKAZIVANJE')) return 'Posao je u toku, pa ga ne možeš sam otkazati. Zatraži sporazumni prekid ili otvori spor.'
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

  // expectedAmount = iznos koji je klijent vidio; baza odbija ako se ponuda u međuvremenu promijenila
  acceptAndFund: (bidId, expectedAmount) => call('accept_offer_and_fund', { p_bid_id: bidId, p_expected_amount: expectedAmount }),

  // --- tok posla (state machine u bazi: supabase/booking) ---------------------
  /** Izvođač predaje rad. Dokaz je obavezan — baza odbija poruku bez njega. */
  submitWork: (listingId, report, evidence = []) =>
    call('submit_work', { p_listing: listingId, p_report: report, p_evidence: evidence }),
  /** Klijent odobrava: prelaz u 'completed' + isplata, u jednoj transakciji. */
  approveWork: (listingId) => call('approve_work', { p_listing: listingId }),
  /** Klijent traži ispravku (najviše 3 puta). */
  requestRevision: (listingId, reason) =>
    call('request_revision', { p_listing: listingId, p_reason: reason }),
  /** Sporazumni prekid: traži se pristanak druge strane. */
  requestCancellation: (listingId, reasonCode, detail = null) =>
    call('request_cancellation', { p_listing: listingId, p_reason_code: reasonCode, p_detail: detail }),
  respondCancellation: (listingId, accept, note = null) =>
    call('respond_cancellation', { p_listing: listingId, p_accept: accept, p_note: note }),
  /** Spor zamrzava posao dok tim ne odluči. */
  openWorkDispute: (listingId, reasonCode, claim, evidence = []) =>
    call('open_dispute', { p_listing: listingId, p_reason_code: reasonCode, p_claim: claim, p_evidence: evidence }),

  /** Predani rad (izvještaj + slike) — obje strane ga vide na stranici posla. */
  async workSubmissions(paymentId) {
    const { data, error } = await supabase
      .from('work_submissions')
      .select('id, revision_no, report, evidence_urls, submitted_at')
      .eq('payment_id', paymentId)
      .order('revision_no', { ascending: false })
    if (error) return []
    return data || []
  },

  /** Otvoren zahtjev za prekid, ako postoji. */
  async pendingCancellation(paymentId) {
    const { data } = await supabase
      .from('cancellation_requests')
      .select('id, requested_by, reason_code, detail, created_at')
      .eq('payment_id', paymentId).eq('state', 'pending').maybeSingle()
    return data || null
  },

  /** Slike kao dokaz idu u isti bucket kao i slike u porukama. */
  async uploadEvidence(userId, files) {
    const urls = []
    for (const file of files) {
      const path = `${userId}/work/${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const { error } = await supabase.storage.from('media').upload(path, file, {
        cacheControl: '31536000', contentType: file.type,
      })
      if (error) throw new Error('Slika se nije mogla poslati.')
      urls.push(supabase.storage.from('media').getPublicUrl(path).data.publicUrl)
    }
    return urls
  },
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
