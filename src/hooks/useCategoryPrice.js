import { useEffect, useState } from 'react'
import { contactService } from '../services/contactService'

let cache = null
let inflight = null
const load = () => {
  if (cache) return Promise.resolve(cache)
  if (!inflight) inflight = contactService.categoryPriceStats().then((rows) => { cache = rows || []; return cache }).catch(() => [])
  return inflight
}

/**
 * Typical price for a category from real published jobs (median / average / sample size).
 * Used as a hint when writing an offer or a budget. Returns null while unknown.
 */
export function useCategoryPrice(category) {
  const [stats, setStats] = useState(null)
  useEffect(() => {
    let alive = true
    if (!category) { setStats(null); return undefined }
    load().then((rows) => {
      if (!alive) return
      const row = rows.find((item) => item.category === category)
      setStats(row && row.priced_count >= 2 ? { median: Number(row.median_price), avg: Number(row.avg_price), min: Number(row.min_price), max: Number(row.max_price), count: Number(row.priced_count) } : null)
    })
    return () => { alive = false }
  }, [category])
  return stats
}
