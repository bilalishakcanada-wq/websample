import { supabase } from '../lib/supabase'
import { publicError } from '../utils/validation'

/**
 * Verifikacija identiteta: JMBG + dokument -> ručna provjera tima.
 *
 * Slike idu u PRIVATNI bucket 'identity'. Korisnik ih ne može pročitati nazad —
 * jednom poslanu ličnu kartu vidi samo tim. Sam JMBG se u bazi čuva šifrovan i
 * nikad se ne vraća klijentu.
 */
/**
 * Gruba oznaka uređaja: platforma, jezik, rezolucija, vremenska zona.
 * Nije praćenje po webu — ne izlazi iz Poso.ba i služi samo da se vidi kad isti
 * uređaj šalje više različitih identiteta.
 */
function deviceFingerprint() {
  try {
    const d = [
      navigator.platform, navigator.language, navigator.hardwareConcurrency,
      screen.width, screen.height, screen.colorDepth,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    ].join('|')
    let h = 0
    for (let i = 0; i < d.length; i += 1) { h = ((h << 5) - h + d.charCodeAt(i)) | 0 }
    return `d${(h >>> 0).toString(36)}`
  } catch { return null }
}

const call = async (fn, args) => {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) {
    const poruka = String(error.message || '')
    // poruke iz baze su već na našem jeziku i namijenjene korisniku
    if (/JMBG_NEISPRAVAN|JMBG_VEC_KORISTEN|DOKUMENT_VEC_KORISTEN|SLIKA_MUTNA|MALOLJETAN|IME_I_PREZIME|SLIKA_DOKUMENTA|VEC_RIJESENO|RAZLOG_ODBIJANJA/.test(poruka)) {
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

  /**
   * Može li prijavljeni korisnik slati ponude, i ako ne, u kojoj je fazi:
   * 'ok' | 'needed' (nije poslao) | 'pending' (tim provjerava) | 'rejected'.
   * Pita istu funkciju kao baza (identity_verified, stroga — bez prelaznog roka;
   * dok ta migracija nije primijenjena, identity_ok). Ako upit ne uspije, vraća
   * 'ok' — baza svejedno ima zadnju riječ, a korisnik ne ostane zaključan greškom.
   */
  async offerGate() {
    try {
      const [policy, predmet, strict] = await Promise.all([this.policy(), this.mine(), supabase.rpc('identity_verified')])
      if (!policy.require_for_bids) return 'ok'
      let ok = strict.error ? null : strict.data
      if (ok === null) {
        const blagi = await supabase.rpc('identity_ok')
        ok = blagi.error ? true : blagi.data
      }
      if (ok) return 'ok'
      if (predmet && ['submitted', 'in_review'].includes(predmet.state)) return 'pending'
      if (predmet?.state === 'rejected') return 'rejected'
      return 'needed'
    } catch { return 'ok' }
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

  submit: ({ fullName, jmbg, docType, docNumber, front, back, selfie, phash, quality }) =>
    call('submit_identity', {
      p_full_name: fullName, p_jmbg: jmbg, p_doc_type: docType,
      p_doc_number: docNumber || null, p_front: front, p_back: back || null, p_selfie: selfie || null,
      p_phash: phash || null, p_quality: quality || null, p_device: deviceFingerprint(),
    }),

  /** Bodovi rizika i razlozi — moderator ih vidi uz predmet. */
  risk: (caseId) => call('identity_risk', { p_case: caseId }),

  // --- za tim ---------------------------------------------------------------
  async queue(limit = 50) {
    const { data, error } = await supabase
      .from('identity_verifications')
      .select('id, user_id, state, full_name, birth_date, gender, region_code, doc_type, risk_flags, risk_score, submitted_at, claimed_by, claimed_until')
      .in('state', ['submitted', 'in_review'])
      .order('risk_score', { ascending: false })
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
