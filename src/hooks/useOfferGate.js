import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { identityService } from '../services/identityService'
import { keys } from './queryKeys'

/** Tekst dugmeta za ponudu u svakoj fazi — isti na telefonu i računaru. */
export const OFFER_CTA = {
  ok: 'Pošalji ponudu',
  needed: 'Potvrdi identitet za ponudu',
  pending: 'Identitet se provjerava',
  rejected: 'Ponovi verifikaciju',
  too_far: 'Predaleko za ovaj posao',
  no_city: 'Dodaj grad u profil',
}

/**
 * Doseg ponude za ovaj posao (listing_reach iz baze): 'too_far' | 'no_city' | null.
 * Dok funkcija ne postoji u bazi (ili upit ne uspije) vraća null — baza svakako
 * odbije ponudu koja ne prolazi, a korisnik ne ostane zaključan greškom.
 */
async function reachBlock(listingId) {
  const { data, error } = await supabase.rpc('listing_reach', { p_listing: listingId })
  if (error) return null
  const row = Array.isArray(data) ? data[0] : data
  if (!row || row.can_offer) return null
  return row.reason === 'too_far' || row.reason === 'no_city' ? row.reason : null
}

/**
 * Smije li prijavljeni korisnik poslati ponudu na ovaj posao:
 * 'ok' | 'needed' | 'pending' | 'rejected' (identitet) | 'too_far' | 'no_city' (doseg).
 * Identitet ima prednost. Gost i učitavanje vraćaju 'ok' — gost ide na prijavu.
 */
export function useOfferGate(userId, listingId) {
  const { data: identity } = useQuery({
    queryKey: keys.offerGate(userId),
    queryFn: () => identityService.offerGate(),
    enabled: Boolean(userId),
    staleTime: 60 * 1000,
    meta: { persist: false },
  })
  const { data: reach } = useQuery({
    queryKey: keys.offerReach(userId, listingId),
    queryFn: () => reachBlock(listingId),
    enabled: Boolean(userId && listingId),
    staleTime: 60 * 1000,
    meta: { persist: false },
  })
  if (!userId) return 'ok'
  if (identity && identity !== 'ok') return identity
  return reach || 'ok'
}
