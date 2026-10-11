import { supabase } from '../lib/supabase'

// „Izvođač je na putu“ (supabase/booking/05_live_location.sql + 06_location_request.sql):
// izvođač šalje zadnju tačku, klijent je prati uživo i može zatražiti lokaciju.
const COLUMNS = 'payment_id, lat, lng, accuracy_m, heading, speed_mps, started_at, updated_at'
const REQUEST_COLUMNS = 'payment_id, state, requested_at, answered_at'

// 06 nije još u bazi: dijeljenje radi kao prije (bez trajanja i bez zahtjeva)
let durationSupported = true

const humanError = (error, fallback) => {
  const text = String(error?.message || '')
  const human = text.match(/^LOKACIJA_(?:NIJE_MOGUCA|ISTEKLA): (.+)$/)
  const out = new Error(human ? human[1].charAt(0).toUpperCase() + human[1].slice(1) : fallback)
  out.expired = /^LOKACIJA_ISTEKLA/.test(text)
  return out
}

export const liveLocationService = {
  /** { available, row }: available=false dok tabela nije u bazi, pa se dio uopšte ne prikazuje. */
  async current(paymentId) {
    // share_until (06) se čita odvojeno da stariji izgled baze i dalje radi
    let res = await supabase.from('job_live_locations').select(`${COLUMNS}, share_until`).eq('payment_id', paymentId).maybeSingle()
    if (res.error) res = await supabase.from('job_live_locations').select(COLUMNS).eq('payment_id', paymentId).maybeSingle()
    if (res.error) return { available: false, row: null }
    return { available: true, row: res.data }
  },

  /** minutes: samo na prvoj tački (izvođač je izabrao 30 min / 1 h / 2 h). */
  async share(listingId, point, minutes = null) {
    const args = {
      p_listing: listingId, p_lat: point.lat, p_lng: point.lng,
      p_accuracy_m: point.accuracy == null ? null : Math.round(point.accuracy),
      p_heading: point.heading, p_speed_mps: point.speed,
    }
    let { error } = await supabase.rpc('share_live_location', minutes && durationSupported ? { ...args, p_minutes: minutes } : args)
    if (error && minutes && durationSupported && (error.code === 'PGRST202' || /p_minutes/.test(error.message || ''))) {
      durationSupported = false
      ;({ error } = await supabase.rpc('share_live_location', args))
    }
    if (error) throw humanError(error, 'Lokacija se nije poslala. Provjeri internet.')
  },

  async stop(listingId) {
    await supabase.rpc('stop_live_location', { p_listing: listingId })
  },

  /** „Stigao sam“: gasi dijeljenje i javlja klijentu. Bez 06 u bazi samo gasi. */
  async arrived(listingId) {
    const { error } = await supabase.rpc('arrived_live_location', { p_listing: listingId })
    if (error) await this.stop(listingId)
  },

  /** { available, request }: zahtjev klijenta za lokaciju (06). */
  async request(paymentId) {
    const { data, error } = await supabase.from('job_location_requests').select(REQUEST_COLUMNS).eq('payment_id', paymentId).maybeSingle()
    if (error) return { available: false, request: null }
    return { available: true, request: data }
  },

  async ask(listingId) {
    const { error } = await supabase.rpc('request_live_location', { p_listing: listingId })
    if (error) throw humanError(error, 'Zahtjev se nije poslao. Provjeri internet.')
  },

  async decline(listingId) {
    const { error } = await supabase.rpc('decline_location_request', { p_listing: listingId })
    if (error) throw humanError(error, 'Odgovor se nije poslao. Provjeri internet.')
  },

  /** Realtime: svaka nova tačka (ili null kad se dijeljenje ugasi) stiže odmah, na webu, iOS-u i Androidu isto. */
  subscribe(paymentId, onRow, onRequest) {
    const channel = supabase.channel(`live-loc-${paymentId}-${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_live_locations', filter: `payment_id=eq.${paymentId}` },
        (payload) => onRow(payload.eventType === 'DELETE' ? null : payload.new))
    if (onRequest) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table: 'job_location_requests', filter: `payment_id=eq.${paymentId}` },
        (payload) => onRequest(payload.eventType === 'DELETE' ? null : payload.new))
    }
    channel.subscribe()
    return () => supabase.removeChannel(channel)
  },
}
