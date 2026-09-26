import { useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { useJobFeed } from './useFeed'
import { mockServiceCategories, mockTasks } from '../data/mockData'
import { formatBosnianDate } from '../utils/dateFormat'
import { withBase } from '../utils/paths'

const categoryImage = (category) => {
  const match = mockServiceCategories.find((item) => item.name === category)
  return match?.image || withBase('/images/categories/home.webp')
}

const shortTag = (category) => {
  if (!category) return 'Ostalo'
  const [first] = category.split(/[\s/]+/)
  return category.length <= 14 ? category : first
}

export const toCardListing = (listing) => ({
  id: listing.id,
  title: listing.title,
  category: listing.category || 'Ostalo',
  tag: shortTag(listing.category),
  price: listing.price == null ? 'Po dogovoru' : `${Number(listing.price).toLocaleString('bs-BA')} KM`,
  location: listing.location || 'Lokacija nije navedena',
  time: formatBosnianDate(listing.created_at),
  offers: listing.bid_count ?? listing.bids?.[0]?.count ?? 0,
  image: [...(listing.listing_images || [])].sort((a, b) => a.position - b.position)[0]?.url || categoryImage(listing.category),
  isLive: true,
})

/** The job feed as cards: ranked for whoever is looking (see useFeed), newest-first no longer. */
export function useLiveListings({ limit = 8, fallbackToDemo = true } = {}) {
  const { user } = useAuth()
  const { feed, loading } = useJobFeed({ userId: user?.id ?? null, limit })
  const listings = useMemo(() => feed.map(toCardListing), [feed])

  const demoFill = fallbackToDemo ? mockTasks.slice(0, Math.max(0, limit - listings.length)) : []

  return { listings, demoListings: demoFill, combined: [...listings, ...demoFill], loading, hasLive: listings.length > 0 }
}
