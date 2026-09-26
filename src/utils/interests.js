/**
 * Interest profile — what this person actually looks at, the way social feeds learn.
 *
 * Every open, offer, category search or posted job adds weight to that category. Weights fade
 * with a 14-day half-life, so the feed follows what someone does now, not what they clicked
 * once last spring. Opened jobs are remembered for a few days so the feed can nudge them down
 * and show something new. Everything stays on this device (localStorage) — nothing is sent,
 * and the same code runs on desktop web, phone web and the Capacitor app.
 */
const KEY = 'poso-interests-v1'
const DAY = 24 * 3600 * 1000
const HALF_LIFE_DAYS = 14
const SEEN_DAYS = 5
const MAX_CATEGORIES = 30
const MAX_SEEN = 200

/** How much each action says about someone's interest. */
export const SIGNALS = { view: 1, search: 1.5, post: 3, bid: 4 }

const empty = () => ({ categories: {}, seen: {} })

function load() {
  try {
    const raw = window.localStorage.getItem(KEY)
    const parsed = raw ? JSON.parse(raw) : null
    return parsed && typeof parsed === 'object' ? { ...empty(), ...parsed } : empty()
  } catch {
    return empty()
  }
}

function save(profile) {
  try { window.localStorage.setItem(KEY, JSON.stringify(profile)) } catch { /* private mode / full — ranking just stays neutral */ }
}

const decayed = (entry, now) => (entry ? entry.w * Math.pow(0.5, (now - entry.t) / DAY / HALF_LIFE_DAYS) : 0)

/** Record one action. `signal` is a key of SIGNALS; `listingId` marks a job as seen. */
export function recordInterest(signal, { category, listingId } = {}, now = Date.now()) {
  if (typeof window === 'undefined') return
  const profile = load()
  if (category) {
    const weight = decayed(profile.categories[category], now) + (SIGNALS[signal] || 1)
    profile.categories[category] = { w: Math.round(weight * 1000) / 1000, t: now }
    const names = Object.keys(profile.categories)
    if (names.length > MAX_CATEGORIES) {
      names.sort((a, b) => decayed(profile.categories[a], now) - decayed(profile.categories[b], now))
      for (const name of names.slice(0, names.length - MAX_CATEGORIES)) delete profile.categories[name]
    }
  }
  if (listingId) {
    profile.seen[listingId] = now
    const ids = Object.keys(profile.seen)
    for (const id of ids) if (now - profile.seen[id] > SEEN_DAYS * DAY) delete profile.seen[id]
    const left = Object.keys(profile.seen)
    if (left.length > MAX_SEEN) {
      left.sort((a, b) => profile.seen[a] - profile.seen[b])
      for (const id of left.slice(0, left.length - MAX_SEEN)) delete profile.seen[id]
    }
  }
  save(profile)
}

/**
 * A snapshot for ranking: `affinity(category)` is 0..1 relative to the strongest interest
 * (0.5 = neutral when there is no history yet), `seen(id)` is true for jobs opened lately,
 * `top(n)` the strongest categories.
 */
export function readInterests(now = Date.now()) {
  const profile = typeof window === 'undefined' ? empty() : load()
  const weights = Object.fromEntries(Object.entries(profile.categories).map(([name, entry]) => [name, decayed(entry, now)]))
  const max = Math.max(0, ...Object.values(weights))
  const hasHistory = max > 0.25
  return {
    hasHistory,
    affinity: (category) => (!hasHistory ? 0.5 : category && weights[category] ? weights[category] / max : 0),
    seen: (id) => Boolean(profile.seen[id] && now - profile.seen[id] <= SEEN_DAYS * DAY),
    top: (n = 3) => Object.keys(weights).filter((name) => weights[name] > 0.25).sort((a, b) => weights[b] - weights[a]).slice(0, n),
  }
}
