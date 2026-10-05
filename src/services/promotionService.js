import { supabase } from '../lib/supabase'
import { sanitizeText } from '../utils/validation'

// Greške iz promote_listing() → rečenica + (gdje ima smisla) link na kojem se rješava.
const PROMO_ERRORS = [
  [/INSUFFICIENT/, 'Nemaš dovoljno na balansu za izdvajanje.', { tekst: 'Dopuni balans', href: '/account/novcanik' }],
  [/IZDVAJANJE_VEC_AKTIVNO/, 'Posao je već izdvojen ovim ili višim paketom.'],
  [/IZDVAJANJE_ZATVOREN/, 'Posao više ne prima ponude, pa ga nema smisla izdvajati.'],
  [/IZDVAJANJE_PRIVATNI/, 'Privatni zahtjev vidi samo jedan izvođač, pa se ne izdvaja.'],
  [/IZDVAJANJE_NIJE_TVOJ/, 'Izdvojiti možeš samo svoj posao.'],
  [/SUSPENDED/, 'Nalog je privremeno suspendovan, pa ova radnja nije moguća.'],
]
const promoError = (error) => {
  const text = `${error?.message || ''} ${error?.details || ''}`
  const [, message, akcija] = PROMO_ERRORS.find(([test]) => test.test(text)) || [null, 'Izdvajanje nije uspjelo. Pokušaj ponovo.']
  const e = new Error(message)
  if (akcija) e.akcija = akcija
  return e
}

/** True while a job's paid "Hitno" / "VIP" boost is running. */
export const activePromotion = (listing) => {
  const tier = listing?.promotion_tier
  if (!tier || tier === 'standard' || !listing.promoted_until) return null
  return new Date(listing.promoted_until).getTime() > Date.now() ? tier : null
}

export const promotionService = {
  /** { plans: [{tier, label, price_km, days}], balance } — null while supabase/marketplace/01 is not on the database. */
  async options() {
    const { data, error } = await supabase.rpc('promotion_options')
    if (error) return null
    return data
  },

  async promote(listingId, tier) {
    const { data, error } = await supabase.rpc('promote_listing', { p_listing_id: listingId, p_tier: tier })
    if (error) {
      console.error('Promote listing failed', { message: error.message, code: error.code })
      throw promoError(error)
    }
    return data
  },

  /** Active boosted jobs that match the same search filters (pinned above the normal results). */
  async forSearch({ query = '', category = '', lat = null, lng = null, radiusKm = 0, includeRemote = true, minPrice = '', maxPrice = '', hasBudget = false, noOffers = false } = {}) {
    const { data, error } = await supabase.rpc('promoted_listings', {
      p_query: sanitizeText(query).slice(0, 80),
      p_category: category || '',
      p_lat: lat, p_lng: lng,
      p_radius_km: radiusKm || 0,
      p_include_remote: Boolean(includeRemote),
      p_min_price: minPrice === '' || minPrice == null ? null : Number(minPrice),
      p_max_price: maxPrice === '' || maxPrice == null ? null : Number(maxPrice),
      p_has_budget: Boolean(hasBudget),
      p_no_offers: Boolean(noOffers),
      p_limit: 6,
    })
    if (error) return []
    return data || []
  },
}
