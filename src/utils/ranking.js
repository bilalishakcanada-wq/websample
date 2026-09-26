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

/* ------------------------------------------------------------------ personalised feeds */

/** How strongly the feed follows behaviour (interest), the server's match score, and novelty. */
export const FEED_WEIGHTS = { interest: 2.2, server: 1.5, seen: 1.4 }

/**
 * Re-order so the same category never runs more than `maxRun` in a row (the "don't show five
 * cleaning jobs back to back" rule every social feed uses). Greedy: take the best item whose
 * category isn't over the run; if none qualifies, take the best anyway — nothing is dropped.
 */
export function diversify(items, { key = (item) => item.category, maxRun = 2 } = {}) {
  const rest = [...items]
  const out = []
  while (rest.length) {
    const recent = out.slice(-maxRun).map(key)
    const blocked = recent.length === maxRun && recent.every((value) => value === recent[0]) ? recent[0] : undefined
    const index = blocked === undefined ? 0 : Math.max(0, rest.findIndex((item) => key(item) !== blocked))
    out.push(rest.splice(index, 1)[0])
  }
  return out
}

/**
 * The job feed for a provider: the relevance model above, plus what they actually open and bid
 * on (`interests` from utils/interests), the server's match score when it has one, and a nudge
 * down for jobs they already opened so each visit shows something new. Then mixed by category.
 */
export function rankJobFeed(items, { interests, skills = [], homeDistance = null, now = Date.now() } = {}) {
  const maxServer = Math.max(1, ...items.map((item) => Number(item.match_score) || 0))
  const scored = items.map((item) => {
    const distanceKm = homeDistance ? homeDistance(item) : null
    let score = rankScore(item, { distanceKm, remote: item.remote, skills, now })
    if (interests) {
      score += FEED_WEIGHTS.interest * interests.affinity(item.category)
      if (interests.seen(item.id)) score -= FEED_WEIGHTS.seen
    }
    if (item.match_score != null) score += FEED_WEIGHTS.server * (Number(item.match_score) / maxServer)
    return { ...item, rank_score: score }
  })
  scored.sort((a, b) => b.rank_score - a.rank_score)
  return diversify(scored)
}

/**
 * Suggested providers for a client: the server's quality score (ratings, completed jobs,
 * verification), boosted for the categories the client browses or posts in and for their city.
 * `categoryHits(provider)` counts how many of the client's top categories the provider was
 * returned for.
 */
export function rankProviders(providers, { city = '', categoryHits = () => 0 } = {}) {
  const maxScore = Math.max(1, ...providers.map((p) => Number(p.score) || 0))
  const sameCity = (p) => Boolean(city && p.city && normalize(p.city) === normalize(city))
  return providers
    .map((p) => ({
      ...p,
      feed_score: 3 * ((Number(p.score) || 0) / maxScore) + 1.5 * Math.min(2, categoryHits(p)) + (sameCity(p) ? 1.2 : 0),
    }))
    .sort((a, b) => b.feed_score - a.feed_score)
}

/**
 * Personalise an already-ranked server list without overriding it: the server's order stays the
 * main signal (position score), interest lifts a job a little, a job already opened drops a
 * little. With no text query the result is also mixed by category, like the home feed.
 */
export function personaliseRanked(items, { interests, query = '' } = {}) {
  if (!interests || items.length < 2) return items
  const n = items.length
  const scored = items.map((item, index) => ({
    item,
    score: 3 * (1 - index / n) + 0.9 * interests.affinity(item.category) - (interests.seen(item.id) ? 0.5 : 0),
  }))
  scored.sort((a, b) => b.score - a.score)
  const ordered = scored.map(({ item }) => item)
  return query.trim() ? ordered : diversify(ordered)
}
