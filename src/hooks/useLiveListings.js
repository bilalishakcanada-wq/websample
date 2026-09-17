import { useEffect, useState } from 'react'
import { listingService } from '../services/listingService'
import { mockServiceCategories, mockTasks } from '../data/mockData'
import { formatBosnianDate } from '../utils/dateFormat'

const categoryImage = (category) => {
  const match = mockServiceCategories.find((item) => item.name === category)
  return match?.image || '/images/categories/home.jpg'
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
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    listingService.listLatestPublished(limit)
      .then((rows) => {
        if (!active) return
        setListings(rows.map(toCardListing))
      })
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [limit])

  const demoFill = fallbackToDemo ? mockTasks.slice(0, Math.max(0, limit - listings.length)) : []

  return { listings, demoListings: demoFill, combined: [...listings, ...demoFill], loading, hasLive: listings.length > 0 }
}
