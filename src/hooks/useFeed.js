import { useMemo, useState } from 'react'
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

const tasteQuery = (userId) => ({
  queryKey: keys.taste(userId),
  queryFn: () => profileService.getProfile(userId).then((p) => (p ? { city: p.city || '', trades: p.trades || [] } : null)),
  enabled: Boolean(userId),
  staleTime: 10 * 60 * 1000,
})

/** City + trades of the signed-in person (null when signed out). */
export function useTaste(userId) {
  return useQuery(tasteQuery(userId)).data || null
}

export function useJobFeed({ userId = null, limit = 8, poolSize = 40 } = {}) {
  const tasteState = useQuery(tasteQuery(userId))
  const taste = tasteState.data || null
  const pool = useQuery({
    queryKey: keys.feedPool(poolSize),
    queryFn: () => listingService.listLatestPublished(poolSize),
    staleTime: 60 * 1000,
  })
  const matches = useRecommendedListings(userId, 12)
  const myBids = useMyBids(userId, 50)
  // ranked once everything it is ranked by is in (arrived or failed), not reshuffled as each read lands
  const settled = !pool.isPending && !tasteState.isLoading && !matches.isLoading && !myBids.isLoading

  const ranked = useMemo(() => {
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
    return rankJobFeed(items, {
      interests: readInterests(),
      skills: taste?.trades || [],
      homeDistance: home ? (item) => distanceKm(home, coordsForLocation(item.location)) : null,
    })
  }, [pool.data, matches.data, myBids.data, taste, userId])

  // Once the list is on screen its order holds: fresh data updates the cards in place, and a job that
  // ranks higher now (or a new one) waits for the next visit, so a card never slides away under a finger.
  const [shown, setShown] = useState(null)
  if (settled && shown?.userId !== userId) setShown({ userId, ids: ranked.slice(0, limit).map((job) => job.id) })

  const feed = useMemo(() => {
    if (!settled) return []
    if (shown?.userId !== userId) return ranked.slice(0, limit)
    const byId = new Map(ranked.map((job) => [job.id, job]))
    const kept = shown.ids.map((id) => byId.get(id)).filter(Boolean)
    const keptIds = new Set(shown.ids)
    // a job that closed meanwhile drops out; the gap fills at the end, below everything already seen
    return [...kept, ...ranked.filter((job) => !keptIds.has(job.id))].slice(0, limit)
  }, [settled, shown, ranked, userId, limit])

  // the heading is decided up front too, so it doesn't change length (and push the list) when the reads land
  const personalised = Boolean(userId) && (!settled || Boolean(taste || matches.data?.length))
  return { feed, loading: !settled, personalised }
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
