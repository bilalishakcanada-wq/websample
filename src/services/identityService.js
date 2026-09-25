import { supabase } from '../lib/supabase'
import { publicError } from '../utils/validation'

/**
 * Verifikacija identiteta: JMBG + dokument -> ručna provjera tima.
 *
 * Slike idu u PRIVATNI bucket 'identity'. Korisnik ih ne može pročitati nazad —
 * jednom poslanu ličnu kartu vidi samo tim. Sam JMBG se u bazi čuva šifrovan i
 * nikad se ne vraća klijentu.
 */
const call = async (fn, args) => {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) {
    const poruka = String(error.message || '')
    // poruke iz baze su već na našem jeziku i namijenjene korisniku
    if (/JMBG_NEISPRAVAN|JMBG_VEC_KORISTEN|MALOLJETAN|IME_I_PREZIME|SLIKA_DOKUMENTA|VEC_RIJESENO|RAZLOG_ODBIJANJA/.test(poruka)) {
      throw new Error(poruka.replace(/^[A-Z_]+:\s*/, ''))
    }
    console.error('Identity RPC failed', { fn, message: error.message, code: error.code })
    throw publicError()
  }
  return data
}

export const identityService = {
  /** Moje stanje verifikacije — čita se pri otvaranju stranice. */
  async mine() {
    const { data, error } = await supabase
      .from('identity_verifications')
      .select('id, state, full_name, birth_date, gender, doc_type, reject_reason, submitted_at, reviewed_at, created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) return null
    return data
  },

  /** Pravila: šta trenutno traži verifikaciju. */
  async policy() {
    const { data } = await supabase.from('verification_policy').select('*').maybeSingle()
    return data || { require_for_jobs: true, require_for_bids: true, require_for_chat: false }
  },

  /** Slika dokumenta u privatni bucket. Vraća samo putanju, nikad javni URL. */
  async uploadDoc(userId, file, oznaka) {
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const path = `${userId}/${oznaka}-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('identity').upload(path, file, {
      contentType: file.type, upsert: false,
    })
    if (error) {
      console.error('Identity upload failed', { message: error.message })
      throw new Error('Slika se nije mogla poslati. Pokušaj ponovo ili izaberi manju sliku.')
    }
    return path
  },

  submit: ({ fullName, jmbg, docType, docNumber, front, back, selfie }) =>
    call('submit_identity', {
      p_full_name: fullName, p_jmbg: jmbg, p_doc_type: docType,
      p_doc_number: docNumber || null, p_front: front, p_back: back || null, p_selfie: selfie || null,
    }),

  // --- za tim ---------------------------------------------------------------
  async queue(limit = 50) {
    const { data, error } = await supabase
      .from('identity_verifications')
      .select('id, user_id, state, full_name, birth_date, gender, region_code, doc_type, risk_flags, submitted_at, claimed_by, claimed_until')
      .in('state', ['submitted', 'in_review'])
      .order('submitted_at', { ascending: true })
      .limit(limit)
    if (error) throw publicError()
    return data || []
  },
  claimNext: () => call('identity_claim_next', { p_minutes: 15 }),
  /** Otkriva broj i slike — svaki poziv ostaje zapisan u staff_actions. */
  reveal: (caseId) => call('identity_reveal', { p_case: caseId }),
  decide: (caseId, approve, reason = null) =>
    call('identity_decide', { p_case: caseId, p_approve: approve, p_reason: reason }),

  /** Potpisani link za sliku dokumenta — vrijedi 60 sekundi. */
  async signedDoc(path) {
    if (!path) return null
    const { data, error } = await supabase.storage.from('identity').createSignedUrl(path, 60)
    if (error) return null
    return data.signedUrl
  },
}
