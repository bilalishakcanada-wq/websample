import { supabase } from '../lib/supabase'

// „Izvođač je na putu“ (supabase/booking/05_live_location.sql): izvođač šalje zadnju tačku, klijent je prati uživo.
const COLUMNS = 'payment_id, lat, lng, accuracy_m, heading, speed_mps, started_at, updated_at'

export const liveLocationService = {
  /** { available, row }: available=false dok tabela nije u bazi, pa se dio uopšte ne prikazuje. */
  async current(paymentId) {
    const { data, error } = await supabase.from('job_live_locations').select(COLUMNS).eq('payment_id', paymentId).maybeSingle()
    if (error) return { available: false, row: null }
    return { available: true, row: data }
  },

  async share(listingId, point) {
    const { error } = await supabase.rpc('share_live_location', {
      p_listing: listingId, p_lat: point.lat, p_lng: point.lng,
      p_accuracy_m: point.accuracy == null ? null : Math.round(point.accuracy),
      p_heading: point.heading, p_speed_mps: point.speed,
    })
    if (error) {
      const text = String(error.message || '')
      const human = text.match(/^LOKACIJA_NIJE_MOGUCA: (.+)$/)
      throw new Error(human ? human[1].charAt(0).toUpperCase() + human[1].slice(1) : 'Lokacija se nije poslala. Provjeri internet.')
    }
  },

  async stop(listingId) {
    await supabase.rpc('stop_live_location', { p_listing: listingId })
  },

  /** Realtime: svaka nova tačka (ili null kad se dijeljenje ugasi) stiže odmah, na webu, iOS-u i Androidu isto. */
  subscribe(paymentId, onRow) {
    const channel = supabase.channel(`live-loc-${paymentId}-${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_live_locations', filter: `payment_id=eq.${paymentId}` },
        (payload) => onRow(payload.eventType === 'DELETE' ? null : payload.new))
      .subscribe()
    return () => supabase.removeChannel(channel)
  },
}
