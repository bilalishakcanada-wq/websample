import { useQuery } from '@tanstack/react-query'
import { identityService } from '../services/identityService'
import { badgeService } from '../services/badgeService'
import { requirementLabel } from '../utils/jobConditions'
import { keys } from './queryKeys'

/** Tekst dugmeta za ponudu u svakoj fazi — isti na telefonu i računaru. */
export const OFFER_CTA = {
  ok: 'Pošalji ponudu',
  needed: 'Potvrdi identitet za ponudu',
  pending: 'Identitet se provjerava',
  rejected: 'Ponovi verifikaciju',
  missing_badges: 'Osvoji značku za ponudu',
}

/** Tekst dugmeta; kad fali tačno jedna značka, imenuje je ("Osvoji značku: Plinska licenca"). */
export function offerCta(gate, missing = []) {
  if (gate === 'missing_badges' && missing.length === 1) return `Osvoji značku: ${requirementLabel(missing[0])}`
  return OFFER_CTA[gate] || OFFER_CTA.ok
}

/**
 * Značke koje prijavljeni korisnik ima, i koje od traženih na ovom poslu mu fale.
 * credentials je null dok se učitava (i za gosta) — tada se ništa ne označava kao nedostaje.
 */
export function useJobConditionCheck(userId, requires = []) {
  const { data: credentials } = useQuery({
    queryKey: keys.credentials(userId),
    queryFn: () => badgeService.myCredentials(userId),
    enabled: Boolean(userId),
    staleTime: 60 * 1000,
    meta: { persist: false },
  })
  const held = credentials ? new Set(credentials) : null
  const missing = held ? requires.filter((code) => !held.has(code)) : []
  return { held, missing }
}

/**
 * Smije li prijavljeni korisnik poslati ponudu na ovaj posao:
 * 'ok' | 'needed' | 'pending' | 'rejected' (identitet)
 * | 'missing_badges' (klijent traži značku koju nema; `missing` iz useJobConditionCheck).
 * Identitet ima prednost. Gost i učitavanje vraćaju 'ok' — gost ide na prijavu.
 */
// udaljenost ne ograničava ponudu (kao Airtasker): svako može poslati ponudu na posao koji vidi
export function useOfferGate(userId, _listingId, missing = []) {
  const { data: identity } = useQuery({
    queryKey: keys.offerGate(userId),
    queryFn: () => identityService.offerGate(),
    enabled: Boolean(userId),
    staleTime: 60 * 1000,
    meta: { persist: false },
  })
  if (!userId) return 'ok'
  if (identity && identity !== 'ok') return identity
  if (missing.length > 0) return 'missing_badges'
  return 'ok'
}
