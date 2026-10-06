import { useQuery } from '@tanstack/react-query'
import { identityService } from '../services/identityService'
import { keys } from './queryKeys'

/** Tekst dugmeta za objavu dok identitet nije potvrđen — isti na telefonu i računaru. */
export const POST_CTA = {
  needed: 'Potvrdi identitet za objavu',
  pending: 'Identitet se provjerava',
  rejected: 'Ponovi verifikaciju',
}

/** Kuda vodi dugme kad identitet tek treba poslati; poslije potvrde link vraća na objavu. */
export const postVerifyHref = (back = '/objavi') => `/account/verifikacija?next=${encodeURIComponent(back)}`

/**
 * Smije li prijavljeni korisnik objaviti NOVI posao: 'ok' | 'needed' | 'pending' | 'rejected'.
 * Uređivanje već objavljenog posla ne traži ništa (enabled=false). Gost i učitavanje vraćaju
 * 'ok' — gost ide na prijavu, a baza svakako ima zadnju riječ.
 */
export function usePostGate(userId, enabled = true) {
  const { data } = useQuery({
    queryKey: keys.postGate(userId),
    queryFn: () => identityService.postGate(),
    enabled: Boolean(userId && enabled),
    // poslije odobrenja korisnik se vraća na objavu: stanje se uvijek pita iznova
    staleTime: 0,
    meta: { persist: false },
  })
  if (!userId || !enabled) return 'ok'
  return data || 'ok'
}
