import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { badgeService } from '../services/badgeService'
import { keys } from './queryKeys'
import { sortByWeight } from '../utils/badgeRanking'

/** Katalog svih znački (nivo, težina, uputa). Mijenja se rijetko — keš od sat vremena. */
export const useBadgeCatalog = () => {
  const query = useQuery({
    queryKey: keys.badgeCatalog,
    queryFn: () => badgeService.catalog(),
    staleTime: 60 * 60 * 1000,
  })
  return useMemo(() => Object.fromEntries((query.data || []).map((row) => [row.code, row])), [query.data])
}

/**
 * Osvojene značke korisnika poredane po težini (weight_score, najteža prva):
 * `top` je prvih `limit` (5) za zaglavlje profila, `rest` ostatak, `ranked` sve.
 */
export function useTopBadges(badges, limit = 5) {
  const catalog = useBadgeCatalog()
  return useMemo(() => {
    const ranked = sortByWeight(badges || [], catalog)
    return { ranked, top: ranked.slice(0, limit), rest: ranked.slice(limit) }
  }, [badges, catalog, limit])
}

/** Trezor vlasnika (sve značke + zaključane + napredak). Bez my_badge_vault na bazi slaže ga iz kataloga. */
export function useBadgeVault(userId, earnedBadges) {
  const catalog = useBadgeCatalog()
  const vault = useQuery({
    queryKey: keys.badgeVault(userId),
    queryFn: () => badgeService.myVault(),
    enabled: Boolean(userId),
    meta: { persist: false },
  })
  return useMemo(() => {
    if (vault.isPending) return { loading: true, badges: [] }
    let rows = vault.data
    if (!rows) {
      const earned = new Map((earnedBadges || []).map((badge) => [badge.code, badge]))
      rows = Object.values(catalog)
        .filter((row) => row.kind !== 'custom' || earned.has(row.code))
        .map((row) => ({ ...row, earned: earned.has(row.code), awarded_at: earned.get(row.code)?.awarded_at || null }))
      for (const badge of earned.values()) if (!catalog[badge.code]) rows.push({ ...badge, earned: true })
    }
    const ranked = sortByWeight(rows, catalog)
    return { loading: false, badges: [...ranked.filter((badge) => badge.earned), ...ranked.filter((badge) => !badge.earned)] }
  }, [vault.isPending, vault.data, catalog, earnedBadges])
}
