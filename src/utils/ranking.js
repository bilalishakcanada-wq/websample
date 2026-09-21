/**
 * Relevance ranking for job search ("Preporučeno").
 *
 * Score = text relevance + freshness + opportunity (few offers) + completeness
 *         + proximity to the searcher's city. Every term is in [0, 1] and weighted, so the
 *         result is explainable and stable: a fresh, complete job near you with few offers
 *         that matches the query wins; nothing is hidden, only ordered.
 */
const HOUR = 3600 * 1000

const normalize = (text) => (text || '')
  .toLowerCase()
  .replace(/[čć]/g, 'c').replace(/š/g, 's').replace(/ž/g, 'z').replace(/đ/g, 'dj')

const tokens = (text) => normalize(text).split(/[^a-z0-9]+/).filter((t) => t.length > 1)

/** 0..1 — how much of the query appears in the listing (title counts double). */
export function textRelevance(query, listing) {
  const terms = tokens(query)
  if (terms.length === 0) return 0.5 // no query: neutral
  const title = normalize(listing.title)
  const body = normalize(`${listing.category || ''} ${listing.description || ''} ${listing.location || ''}`)
  let hit = 0
  for (const term of terms) {
    if (title.includes(term)) hit += 1
    else if (body.includes(term)) hit += 0.5
  }
  return Math.min(1, hit / terms.length)
}

/** 1 for brand new, halving every 3 days, floor 0.05. */
export function freshness(createdAt, now = Date.now()) {
  const ageHours = Math.max(0, (now - new Date(createdAt).getTime()) / HOUR)
  return Math.max(0.05, Math.pow(0.5, ageHours / 72))
}

/** Jobs with few offers are the best opportunity for a provider. */
export function opportunity(offers) {
  const n = Number(offers) || 0
  if (n === 0) return 1
  if (n <= 2) return 0.8
  if (n <= 5) return 0.5
  return 0.25
}

/** Budget, description length and photos make a job easier to price. */
export function completeness(listing) {
  let score = 0
  if (listing.price != null) score += 0.4
  if ((listing.description || '').length > 80) score += 0.3
  if ((listing.listing_images || []).length > 0 || listing.photo) score += 0.3
  return score
}

/** 1 when in the same place, 0 beyond ~120 km; remote work is always reachable. */
export function proximity(distanceKm, remote) {
  if (remote) return 0.8
  if (distanceKm == null) return 0.4
  return Math.max(0, 1 - distanceKm / 120)
}

/** 1 when the job's category is one of the searcher's trades, neutral when they have none. */
export function skillMatch(listing, skills = []) {
  if (!skills || skills.length === 0) return 0.5
  const category = normalize(listing.category)
  if (!category) return 0.3
  return skills.some((skill) => { const s = normalize(skill); return s && (category.includes(s) || s.includes(category)) }) ? 1 : 0.2
}

export const WEIGHTS = { text: 3.0, fresh: 1.6, opportunity: 1.1, complete: 0.8, proximity: 1.2, skills: 1.4 }

export function rankScore(listing, { query = '', distanceKm = null, remote = false, skills = [], now = Date.now() } = {}) {
  return (
    WEIGHTS.text * textRelevance(query, listing) +
    WEIGHTS.fresh * freshness(listing.created_at, now) +
    WEIGHTS.opportunity * opportunity(listing.offers ?? listing.bids?.[0]?.count) +
    WEIGHTS.complete * completeness(listing) +
    WEIGHTS.proximity * proximity(distanceKm, remote) +
    WEIGHTS.skills * skillMatch(listing, skills)
  )
}

/**
 * Sort a listing array by relevance (highest first). Items may carry `distance` and `remote`;
 * `skills` are the signed-in provider's trades, `homeDistance(item)` a fallback distance from
 * their own city when no city filter is set (personalised without hiding anything).
 */
export function rankListings(items, { query = '', skills = [], homeDistance = null } = {}) {
  const now = Date.now()
  return [...items]
    .map((item) => {
      const distanceKm = item.distance ?? (homeDistance ? homeDistance(item) : null)
      return { item, score: rankScore(item, { query, distanceKm, remote: item.remote, skills, now }) }
    })
    .sort((a, b) => b.score - a.score)
    .map(({ item, score }) => ({ ...item, rank_score: score }))
}
