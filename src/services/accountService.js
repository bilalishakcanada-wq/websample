import { supabase } from '../lib/supabase'
import { publicError, sanitizeText } from '../utils/validation'

const LICENCE_TYPES = ['electrician', 'plumber', 'gas', 'hvac', 'construction', 'driver']

// Greške uplate/isplate iz baze i Edge funkcija → rečenica koju korisnik razumije.
const PAY_ERRORS = [
  [/CARD_PAYMENTS_OFF/, 'Plaćanje karticom još nije uključeno. Do tada uplatu dogovaraš s timom.'],
  [/TOO_MANY_ATTEMPTS/, 'Previše pokušaja plaćanja zaredom. Pokušaj ponovo za 10 minuta.'],
  [/BAD_AMOUNT/, 'Uplata može biti od 5 do 2.000 KM.'],
  [/SUSPENDED/, 'Nalog je suspendovan, pa uplata i isplata nisu moguće.'],
  [/VERIFIKACIJA_POTREBNA/, 'Za isplatu prvo potvrdi identitet.'],
  [/ISPLATA_MIN/, 'Najmanja isplata je 20 KM.'],
  [/ISPLATA_PREKO_ZARADE/, 'Na račun se može isplatiti samo zarada od poslova, ne novac uplaćen karticom.'],
  [/NEMA_RACUNA_ZA_ISPLATU/, 'Prvo dodaj račun za isplatu u „Načini plaćanja“.'],
  [/IME_RACUNA_SE_NE_POKLAPA/, 'Račun za isplatu mora glasiti na ime sa tvog profila.'],
  [/ISPLATA_VEC_CEKA/, 'Već imaš zahtjev za isplatu na čekanju.'],
  [/INSUFFICIENT/, 'Nemaš dovoljno na balansu.'],
]
const payError = (text = '') => new Error((PAY_ERRORS.find(([test]) => test.test(text)) || [null, 'Radnja nije uspjela. Pokušaj ponovo.'])[1])

export const accountService = {
  /**
   * Uplata karticom: Edge funkcija vrati potpisanu Monri formu, a preglednik je
   * pošalje Monri-ju. Kartica se unosi samo na Monri stranici; balans raste tek
   * kad Monri potvrdi naplatu (card-topup-callback), ne pri povratku na sajt.
   */
  async startCardTopup(amount) {
    const { data, error } = await supabase.functions.invoke('card-topup-start', { body: { amount: Number(amount) } })
    if (error) {
      let code = error.message || ''
      try { code = JSON.stringify(await error.context.json()) } catch { /* nije JSON */ }
      throw payError(code)
    }
    const form = document.createElement('form')
    form.method = 'POST'
    form.action = data.action
    for (const [name, value] of Object.entries(data.fields)) {
      const input = document.createElement('input')
      input.type = 'hidden'
      input.name = name
      input.value = value
      form.appendChild(input)
    }
    document.body.appendChild(form)
    form.submit()
  },

  async cardPaymentStatus(orderNumber) {
    const { data } = await supabase.from('card_payments').select('status, amount_km').eq('order_number', orderNumber).maybeSingle()
    return data || null
  },

  async payoutState() {
    const { data, error } = await supabase.rpc('my_payout_state')
    if (error) { console.error('Payout state failed', { message: error.message, code: error.code }); return null }
    return data
  },

  async requestPayout(amount) {
    const { data, error } = await supabase.rpc('request_payout', { p_amount: Number(amount) })
    if (error) { console.error('Payout request failed', { message: error.message, code: error.code }); throw payError(error.message) }
    return data
  },

  async cancelPayout(id) {
    const { error } = await supabase.rpc('cancel_payout', { p_id: id })
    if (error) { console.error('Payout cancel failed', { message: error.message, code: error.code }); throw payError(error.message) }
  },

  /** Balance, totals and the ledger of the signed-in user. */
  async myWallet() {
    const { data, error } = await supabase.rpc('my_wallet')
    if (error) {
      console.error('Wallet fetch failed', { message: error.message, code: error.code })
      throw publicError()
    }
    return data
  },

  async tierDashboard() {
    const { data, error } = await supabase.rpc('my_tier_dashboard')
    if (error) { console.error('Tier dashboard failed', { message: error.message, code: error.code }); return null }
    return data
  },

  async paymentHistory() {
    const { data, error } = await supabase.rpc('my_payment_history')
    if (error) { console.error('Payment history failed', { message: error.message, code: error.code }); return [] }
    return data || []
  },

  async verificationProgress() {
    const { data, error } = await supabase.rpc('my_verification_progress')
    if (error) { console.error('Verification progress failed', { message: error.message, code: error.code }); return null }
    return data
  },

  async listFeeTiers() {
    const { data } = await supabase.from('fee_tiers').select('code, label, min_30d_km, fee_percent, sort').order('sort')
    return data || []
  },

  // ----- payout / billing (private) -----
  async getPayoutAccount(userId) {
    const { data } = await supabase.from('payout_accounts').select('holder_name, bank_name, iban, billing_address, billing_city, updated_at').eq('user_id', userId).maybeSingle()
    return data || null
  },

  async savePayoutAccount(userId, form) {
    const iban = sanitizeText(form.iban).replace(/\s+/g, '').toUpperCase()
    if (!/^BA\d{18}$/.test(iban) && !/^\d{16}$/.test(iban)) throw new Error('Unesi IBAN (BA + 18 cifara) ili 16-cifreni broj računa.')
    const holder = sanitizeText(form.holder_name)
    if (holder.length < 3) throw new Error('Unesi ime vlasnika računa.')
    const { error } = await supabase.from('payout_accounts').upsert({
      user_id: userId,
      holder_name: holder,
      bank_name: sanitizeText(form.bank_name).slice(0, 80),
      iban,
      billing_address: sanitizeText(form.billing_address).slice(0, 160),
      billing_city: sanitizeText(form.billing_city).slice(0, 80),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    if (error) { console.error('Payout save failed', { message: error.message, code: error.code }); throw publicError() }
  },

  async deletePayoutAccount(userId) {
    const { error } = await supabase.from('payout_accounts').delete().eq('user_id', userId)
    if (error) { console.error('Payout delete failed', { message: error.message, code: error.code }); throw publicError() }
  },

  // ----- verification requests (identity / licence / police check / trade) -----
  async listMyVerifications(userId) {
    const { data } = await supabase
      .from('verification_requests')
      .select('id, kind, trade, licence_type, status, note, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    return data || []
  },

  async requestVerification({ userId, kind, licenceType = null, trade = null, file }) {
    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
    if (!file || !allowed.has(file.type) || file.size > 10 * 1024 * 1024) {
      throw new Error('Dokument mora biti JPG/PNG/WEBP slika ili PDF, manji od 10 MB.')
    }
    if (kind === 'licence' && !LICENCE_TYPES.includes(licenceType)) throw new Error('Izaberi vrstu licence.')
    const ext = file.type.split('/')[1]
    const path = `${userId}/${kind}-${licenceType || trade || 'doc'}-${Date.now()}.${ext}`.replace(/[^\w./-]/g, '_')
    const { error: uploadError } = await supabase.storage.from('media').upload(path, file, { cacheControl: '3600' })
    if (uploadError) { console.error('Verification upload failed', { message: uploadError.message }); throw publicError() }
    const { data: urlData } = supabase.storage.from('media').getPublicUrl(path)
    const { data, error } = await supabase
      .from('verification_requests')
      .insert({ user_id: userId, document_url: urlData.publicUrl, kind, licence_type: licenceType, trade })
      .select('id, kind, licence_type, trade, status, created_at')
      .single()
    if (error) { console.error('Verification request failed', { message: error.message, code: error.code }); throw publicError() }
    return data
  },

  // ----- phone verification via SMS code (needs an SMS provider in Supabase Auth) -----
  async sendPhoneCode(phoneE164) {
    const { error } = await supabase.auth.updateUser({ phone: phoneE164 })
    if (error) {
      const text = error.message || ''
      if (/sms|provider|not enabled|unsupported/i.test(text)) throw new Error('SMS verifikacija još nije uključena na platformi. Administrator treba dodati SMS provajdera u Supabase Auth.')
      throw new Error(text || 'Slanje koda nije uspjelo.')
    }
  },

  async verifyPhoneCode(phoneE164, token) {
    const { error } = await supabase.auth.verifyOtp({ phone: phoneE164, token, type: 'phone_change' })
    if (error) throw new Error('Kod nije ispravan ili je istekao.')
  },

  async changePassword(newPassword) {
    if (!newPassword || newPassword.length < 8) throw new Error('Lozinka mora imati najmanje 8 znakova.')
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) throw new Error(error.message || 'Promjena lozinke nije uspjela.')
  },
}

export const LICENCES = [
  { type: 'electrician', label: 'Električarska licenca', text: 'Pokaži da imaš važeću licencu za elektroinstalaterske radove.' },
  { type: 'plumber', label: 'Vodoinstalaterska licenca', text: 'Pokaži da imaš važeću licencu za vodoinstalaterske radove.' },
  { type: 'gas', label: 'Plinska licenca', text: 'Pokaži da smiješ raditi na plinskim instalacijama.' },
  { type: 'hvac', label: 'Klimatizacija i grijanje', text: 'Licenca za klimatizaciju, ventilaciju i grijanje.' },
  { type: 'construction', label: 'Građevinska licenca', text: 'Licenca ili uvjerenje za građevinske radove.' },
  { type: 'driver', label: 'Vozačka dozvola', text: 'Za prevoz, dostavu i selidbe — kategorija B ili viša.' },
]
