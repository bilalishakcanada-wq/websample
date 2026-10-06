import { uploadUserFile } from '../lib/privateFiles'
import { supabase } from '../lib/supabase'
import { publicError } from '../utils/validation'

// SQL raises short codes; say what the person can do about it.
const friendly = (error) => {
  const text = error?.message || ''
  if (text.includes('INSUFFICIENT')) return 'Nemaš dovoljno sredstava na balansu. Dopuni balans pa pokušaj ponovo.'
  if (text.includes('POVECANJE_IZNOS')) return 'Dodatni iznos mora biti između 1 i 2.000 KM.'
  if (text.includes('POVECANJE_VEC_CEKA')) return 'Već postoji zahtjev za povećanje koji čeka odgovor klijenta.'
  if (text.includes('POVECANJE_LIMIT')) return 'Za jedan posao možeš tražiti povećanje najviše 3 puta.'
  if (text.includes('NEMA_ZAHTJEVA')) return 'Zahtjev više nije aktivan — osvježi stranicu.'
  if (text.includes('BID_NOT_PENDING')) return 'Ova ponuda više nije aktivna.'
  if (text.includes('PONUDA_PROMIJENJENA')) return 'Izvođač je u međuvremenu promijenio iznos ponude. Osvježi stranicu i provjeri novi iznos prije plaćanja.'
  if (text.includes('PONUDA_NA_SVOJ_OGLAS')) return 'Ne možeš prihvatiti ponudu na vlastiti posao.'
  if (text.includes('JEDNOSTRANO_OTKAZIVANJE')) return 'Posao je u toku, pa ga ne možeš sam otkazati. Zatraži sporazumni prekid ili otvori spor.'
  if (text.includes('LISTING_NOT_OPEN')) return 'Posao više nije otvoren za ponude.'
  if (text.includes('ALREADY_FUNDED')) return 'Za ovaj posao je već osigurana uplata.'
  if (text.includes('BAD_STATUS')) return 'Ova radnja trenutno nije moguća — osvježi stranicu.'
  if (text.includes('REASON_REQUIRED')) return 'Opiši problem u bar par riječi.'
  // foto dokaz i zaključan tok posla (supabase/booking/04): baza već piše razumljivu poruku iza koda
  const human = text.match(/^(FOTO_PRIJE_OBAVEZAN|FOTO_POSLIJE_OBAVEZAN|PRVO_SLIKA_PRIJE|DOKAZ_ZASTARIO|DOKAZ_VEC_KORISTEN|DOKAZ_NEISPRAVAN|DOKAZ_NIJE_MOGUC|GPS_OBAVEZAN|GPS_PRESLAB|STATUS_ZAKLJUCAN|ESCROW_NIJE_OSIGURAN|ESCROW_ZAKLJUCAN): (.+)$/)
  if (human) return human[2].charAt(0).toUpperCase() + human[2].slice(1)
  if (text.includes('NEDOZVOLJEN_PRELAZ')) return 'Ova radnja nije moguća u ovom koraku posla — osvježi stranicu.'
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

/** Zadatak Pay: money is held on the platform from acceptance until the client releases it. */
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
  // responsible: 'me' (ja prekidam) ili 'other' (druga strana nije ispoštovala dogovor).
  // Šalje se samo 'other', da poziv radi i na bazi bez pravila otkazivanja.
  requestCancellation: (listingId, reasonCode, detail = null, responsible = 'me') =>
    call('request_cancellation', {
      p_listing: listingId, p_reason_code: reasonCode, p_detail: detail,
      ...(responsible === 'other' ? { p_responsible: 'other' } : {}),
    }),
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
      .select('*')   // responsible i fee_km postoje tek s pravilima otkazivanja
      .eq('payment_id', paymentId).eq('state', 'pending').maybeSingle()
    return data || null
  },

  // --- povećanje cijene tokom posla (supabase/payments/02) ------------------------
  /** { available, request }: available=false dok pravila nisu u bazi, pa se dugme ne prikazuje. */
  async pendingPriceIncrease(paymentId) {
    const { data, error } = await supabase
      .from('price_increase_requests')
      .select('id, requested_by, amount_km, reason, created_at')
      .eq('payment_id', paymentId).eq('state', 'pending').maybeSingle()
    if (error) return { available: false, request: null }
    return { available: true, request: data || null }
  },
  requestPriceIncrease: (listingId, amount, reason) =>
    call('request_price_increase', { p_listing: listingId, p_amount: amount, p_reason: reason }),
  respondPriceIncrease: (requestId, accept) =>
    call('respond_price_increase', { p_request: requestId, p_accept: accept }),
  cancelPriceIncrease: (requestId) => call('cancel_price_increase', { p_request: requestId }),

  /** Slike kao dokaz idu u privatni bucket: vide ih samo klijent, izvođač i tim. */
  async uploadEvidence(userId, listingId, files) {
    const { resizeImage } = await import('../utils/imageResize')
    const urls = []
    for (const original of files) {
      const file = await resizeImage(original)
      const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      urls.push(await uploadUserFile({
        path: `${userId}/work/${listingId}/${name}`, publicPath: `${userId}/work/${name}`, file, cacheControl: '31536000',
      }).catch(() => { throw new Error('Slika se nije mogla poslati.') }))
    }
    return urls
  },
  // --- foto dokaz na licu mjesta (supabase/booking/04) ----------------------------
  /** { available, rows }: available=false dok tabela nije u bazi, pa se dio ne prikazuje i ne blokira predaju. */
  async proofs(paymentId) {
    const { data, error } = await supabase
      .from('work_proofs')
      .select('id, kind, photo_url, lat, lng, accuracy_m, captured_at, received_at, distance_m, source')
      .eq('payment_id', paymentId)
      .order('received_at', { ascending: true })
    if (error) return { available: false, rows: [] }
    return { available: true, rows: data || [] }
  },
  /** Utisnuta slika iz ProofCamera → skladište → zapis sa GPS-om, vremenom i otiskom. */
  async addProof({ userId, payment, kind, shot }) {
    const stamp = Date.now()
    // privatno: <izvođač>/work/<oglas>/... (vide ga klijent, izvođač i tim; add_work_proof provjerava putanju)
    const url = await uploadUserFile({
      path: `${userId}/work/${payment.listing_id}/proof-${kind}-${stamp}.jpg`,
      publicPath: `${userId}/proof/${payment.id}/${kind}-${stamp}.jpg`,
      file: shot.blob, cacheControl: '31536000', contentType: 'image/jpeg',
    }).catch(() => { throw new Error('Slika se nije mogla poslati. Provjeri internet i pokušaj ponovo.') })
    return call('add_work_proof', {
      p_listing: payment.listing_id, p_kind: kind, p_photo_url: url, p_sha256: shot.sha256,
      p_lat: shot.lat, p_lng: shot.lng, p_accuracy_m: Math.round(shot.accuracy * 10) / 10,
      p_captured_at: shot.capturedAt, p_source: shot.source,
    })
  },

  releasePayment: (listingId) => call('release_job_payment', { p_listing_id: listingId }),
  cancelJob: (listingId, reason = null) => call('cancel_job_payment', { p_listing_id: listingId, p_reason: reason }),

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
