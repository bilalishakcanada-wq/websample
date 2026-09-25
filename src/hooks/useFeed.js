import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listingService } from '../services/listingService'
import { providerService } from '../services/providerService'
import { profileService } from '../services/profileService'
import { useMyBids, useRecommendedListings } from './queries'
import { keys } from './queryKeys'
import { readInterests } from '../utils/interests'
import { rankJobFeed, rankProviders } from '../utils/ranking'
import { coordsForLocation, distanceKm, isRemoteLocation } from '../data/cityCoordinates'

/**
 * Personalised feeds, one implementation for desktop web, phone web and the app.
 * Jobs: a pool of fresh jobs + the server's matches, ranked by rankJobFeed (skills, city,
 * freshness, competition, and this device's interest profile), mixed by category.
 * Providers: the server's quality ranking, pulled for the client's favourite categories too
 * and boosted for them and for the client's city.
 */

/** City + trades of the signed-in person (null when signed out). */
export function useTaste(userId) {
  return useQuery({
    queryKey: keys.taste(userId),
    queryFn: () => profileService.getProfile(userId).then((p) => (p ? { city: p.city || '', trades: p.trades || [] } : null)),
    enabled: Boolean(userId),
    staleTime: 10 * 60 * 1000,
  }).data || null
}

export function useJobFeed({ userId = null, limit = 8, poolSize = 40 } = {}) {
  const taste = useTaste(userId)
  const pool = useQuery({
    queryKey: keys.feedPool(poolSize),
    queryFn: () => listingService.listLatestPublished(poolSize),
    staleTime: 60 * 1000,
  })
  const matches = useRecommendedListings(userId, 12)
  const myBids = useMyBids(userId, 50)

  const feed = useMemo(() => {
    const byId = new Map()
    const bidOn = new Set((myBids.data || []).filter((bid) => bid.status !== 'withdrawn').map((bid) => bid.listing_id))
    for (const row of pool.data || []) {
      if (userId && row.user_id === userId) continue
      if (bidOn.has(row.id)) continue
      byId.set(row.id, { ...row, bid_count: row.bids?.[0]?.count ?? 0 })
    }
    for (const row of matches.data || []) {
      byId.set(row.id, { ...byId.get(row.id), ...row })
    }
    const home = taste?.city ? coordsForLocation(taste.city) : null
    const items = [...byId.values()].map((item) => ({ ...item, offers: item.bid_count, remote: isRemoteLocation(item.location) }))
    const ranked = rankJobFeed(items, {
      interests: readInterests(),
      skills: taste?.trades || [],
      homeDistance: home ? (item) => distanceKm(home, coordsForLocation(item.location)) : null,
    })
    return ranked.slice(0, limit)
  }, [pool.data, matches.data, myBids.data, taste, userId, limit])

  return { feed, loading: pool.isPending, personalised: Boolean(userId && (taste || matches.data?.length)) }
}

export function useProviderFeed({ userId = null, limit = 6 } = {}) {
  const taste = useTaste(userId)
  const categories = useMemo(() => readInterests().top(2), [])
  const pool = useQuery({
    queryKey: keys.providerPool(categories),
    queryFn: async () => {
      const lists = await Promise.all([
        providerService.listRanked({ limit: 18 }),
        ...categories.map((category) => providerService.listRanked({ category, limit: 8 })),
      ])
      const hits = new Map()
      const byId = new Map()
      lists.forEach((rows, index) => rows.forEach((row) => {
        byId.set(row.user_id, row)
        if (index > 0) hits.set(row.user_id, (hits.get(row.user_id) || 0) + 1)
      }))
      return { rows: [...byId.values()], hits: Object.fromEntries(hits) }
    },
    staleTime: 5 * 60 * 1000,
  })

  const providers = useMemo(() => {
    if (!pool.data) return []
    return rankProviders(pool.data.rows, {
      city: taste?.city || '',
      categoryHits: (p) => pool.data.hits[p.user_id] || 0,
    }).slice(0, limit)
  }, [pool.data, taste, limit])

  return { providers, loading: pool.isPending }
}
