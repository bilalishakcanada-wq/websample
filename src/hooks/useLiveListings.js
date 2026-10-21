import { useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { useJobFeed } from './useFeed'
import { formatBosnianDate } from '../utils/dateFormat'
import { categoryPhoto } from '../utils/categoryPhoto'

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
  price: listing.price == null ? 'Po dogovoru' : `${Number(listing.price).toLocaleString('hr-HR')} KM`,
  location: listing.location || 'Lokacija nije navedena',
  time: formatBosnianDate(listing.created_at),
  offers: listing.bid_count ?? listing.bids?.[0]?.count ?? 0,
  image: [...(listing.listing_images || [])].sort((a, b) => a.position - b.position)[0]?.url || categoryPhoto(listing.category),
  isLive: true,
})

/** The job feed as cards: ranked for whoever is looking (see useFeed), newest-first no longer. Only real jobs. */
export function useLiveListings({ limit = 8 } = {}) {
  const { user } = useAuth()
  const { feed, loading } = useJobFeed({ userId: user?.id ?? null, limit })
  const listings = useMemo(() => feed.map(toCardListing), [feed])

  return { listings, loading, hasLive: listings.length > 0 }
}
