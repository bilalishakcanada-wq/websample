import { useQuery } from '@tanstack/react-query'
import { listingService } from '../services/listingService'
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
  offers: listing.bids?.[0]?.count ?? 0,
  image: [...(listing.listing_images || [])].sort((a, b) => a.position - b.position)[0]?.url || categoryImage(listing.category),
  isLive: true,
})

export function useLiveListings({ limit = 8, fallbackToDemo = true } = {}) {
  // shared, persisted cache: coming back to the home screen paints the last list at once and refreshes
  // in the background; lives under 'search' so a new or edited listing refreshes it too
  const { data, isPending } = useQuery({
    queryKey: ['search', 'latest', limit],
    queryFn: () => listingService.listLatestPublished(limit).then((rows) => rows.map(toCardListing)),
    staleTime: 30 * 1000,
  })
  const listings = data || []
  const loading = isPending

  const demoFill = fallbackToDemo ? mockTasks.slice(0, Math.max(0, limit - listings.length)) : []

  return { listings, demoListings: demoFill, combined: [...listings, ...demoFill], loading, hasLive: listings.length > 0 }
}
