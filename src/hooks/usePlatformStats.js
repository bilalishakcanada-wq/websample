import { useEffect, useMemo, useState } from 'react'
import { BadgeCheck, Building2, ClipboardList, LayoutGrid, Star, Users } from 'lucide-react'
import { statsService } from '../services/statsService'
import { serviceCategories } from '../data/categories'
import { cityCoordinates } from '../data/cityCoordinates'

// "1.2k+" / "150+" / "8" — rounds down so the number is never overstated.
export const formatCount = (value) => {
  const n = Number(value) || 0
  if (n >= 1000) {
    const k = Math.floor(n / 100) / 10
    return `${String(k).replace('.', ',')}k+`
  }
  if (n >= 100) return `${Math.floor(n / 50) * 50}+`
  if (n >= 20) return `${Math.floor(n / 10) * 10}+`
  return String(n)
}

const plural = (n, one, few, many) => {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

/**
 * Live platform counters plus the "proof" row derived from them.
 *
 * The proof row grows with the platform: community numbers (users, finished
 * jobs, reviews) are shown once they are big enough to mean something,
 * otherwise the row falls back to facts that are true from day one
 * (open jobs, categories, cities covered by the city index).
 */
export function usePlatformStats() {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    let active = true
    statsService.platform().then((data) => active && setStats(data))
    return () => { active = false }
  }, [])

  const proof = useMemo(() => {
    const s = stats || {}
    const candidates = [
      { key: 'users', ok: s.users >= 100, icon: Users, value: formatCount(s.users), label: 'korisnika' },
      { key: 'done', ok: s.accepted_bids >= 20, icon: BadgeCheck, value: formatCount(s.accepted_bids), label: 'dogovorenih poslova' },
      { key: 'reviews', ok: s.reviews >= 20, icon: Star, value: formatCount(s.reviews), label: 'ocjena korisnika' },
      { key: 'open', ok: s.open_listings >= 1, icon: ClipboardList, value: formatCount(s.open_listings), label: plural(s.open_listings || 0, 'otvoren posao', 'otvorena posla', 'otvorenih poslova') },
      { key: 'categories', ok: true, icon: LayoutGrid, value: String(serviceCategories.length), label: 'kategorija usluga' },
      { key: 'cities', ok: true, icon: Building2, value: `${Math.floor(Object.keys(cityCoordinates).length / 10) * 10}+`, label: 'gradova u BiH' },
    ]
    return candidates.filter((item) => item.ok).slice(0, 3)
  }, [stats])

  const rating = useMemo(() => {
    if (!stats || stats.reviews < 5 || !stats.avg_rating) return null
    const value = Number(stats.avg_rating)
    const word = value >= 4.5 ? 'Odlično' : value >= 4 ? 'Vrlo dobro' : value >= 3 ? 'Dobro' : 'Solidno'
    return { value: value.toFixed(1).replace('.', ','), word, count: stats.reviews, stars: Math.round(value) }
  }, [stats])

  return { stats, proof, rating, loading: stats === null }
}
