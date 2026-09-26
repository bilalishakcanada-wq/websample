import { useQuery } from '@tanstack/react-query'
import { identityService } from '../services/identityService'
import { keys } from './queryKeys'

/** Tekst dugmeta za ponudu u svakoj fazi verifikacije — isti na telefonu i računaru. */
export const OFFER_CTA = {
  ok: 'Pošalji ponudu',
  needed: 'Potvrdi identitet za ponudu',
  pending: 'Identitet se provjerava',
  rejected: 'Ponovi verifikaciju',
}

/**
 * Smije li prijavljeni korisnik slati ponude ('ok' | 'needed' | 'pending' | 'rejected').
 * Gost i učitavanje vraćaju 'ok' — gost ide na prijavu, a baza svakako provjerava.
 */
export function useOfferGate(userId) {
  const { data } = useQuery({
    queryKey: keys.offerGate(userId),
    queryFn: () => identityService.offerGate(),
    enabled: Boolean(userId),
    staleTime: 60 * 1000,
    meta: { persist: false },
  })
  return userId ? data || 'ok' : 'ok'
}
