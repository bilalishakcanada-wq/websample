// Doseg ponuda: how far from a job a provider may be, from what the job pays (budget + travel
// allowance). Mirrors public.listing_reach_km (supabase/airtasker/04) — the database is what
// actually enforces it when an offer is sent; this is for showing it on screens.
import { coordsForLocation, distanceKm, isRemoteLocation } from '../data/cityCoordinates'

export const REACH_TIERS = [
  { below: 50, km: 15 },
  { below: 100, km: 25 },
  { below: 200, km: 40 },
  { below: 400, km: 70 },
  { below: 800, km: 120 },
]
export const NO_BUDGET_REACH_KM = 25
export const TRAVEL_CHIPS = [10, 20, 30, 50]
export const MAX_TRAVEL_ALLOWANCE = 500

/**
 * km a provider may be from the job, or null for no limit (online, or pays 800 KM+).
 * "Po dogovoru" never drops below the no-budget reach: travel money only widens it.
 */
export const reachKm = (price, travel) => {
  const p = price === '' || price == null ? null : Number(price)
  const t = Number(travel) > 0 ? Number(travel) : 0
  const pay = (p || 0) + t
  const tier = REACH_TIERS.find((item) => pay < item.below)
  if (!tier) return null
  return p == null ? Math.max(NO_BUDGET_REACH_KM, tier.km) : tier.km
}

export const listingReachKm = (listing) => (isRemoteLocation(listing?.location) ? null : reachKm(listing?.price, listing?.travel_allowance))

export const reachLabel = (km) => (km == null ? 'iz cijele BiH' : `do ${km} km od posla`)

/** "Klijent plaća put do 20 KM" or null. */
export const travelLabel = (listing) => (Number(listing?.travel_allowance) > 0 ? `Klijent plaća put do ${Number(listing.travel_allowance).toLocaleString('bs-BA')} KM` : null)

const cityPoint = (city) => coordsForLocation(city)

/**
 * Where a provider (by their profile city) stands for a job, computed on the device.
 * status: remote | no_limit | ok | too_far | no_city | unknown_city | no_job_location | invited
 * unknown_city: a profile city we can't place on the map; the database doesn't block those either.
 * myPoint: the profile place's { lat, lng } when the caller already has it (a settlement looked up).
 */
export const reachFor = (listing, myCity, myPoint = null) => {
  if (!listing) return null
  // "Zatraži ponudu": the client picked this provider, so distance does not limit the offer
  if (listing.invited_provider) return { status: 'invited', reachKm: null, distanceKm: null }
  if (isRemoteLocation(listing.location)) return { status: 'remote', reachKm: null, distanceKm: null }
  const km = reachKm(listing.price, listing.travel_allowance)
  const job = listing.lat != null && listing.lng != null ? { lat: listing.lat, lng: listing.lng } : cityPoint(listing.location)
  if (!job) return { status: 'no_job_location', reachKm: km, distanceKm: null }
  const me = myPoint || cityPoint(myCity)
  if (!me) {
    const status = km == null ? 'no_limit' : String(myCity || '').trim() ? 'unknown_city' : 'no_city'
    return { status, reachKm: km, distanceKm: null }
  }
  const distance = Math.round(distanceKm(me, job) * 10) / 10
  if (km == null) return { status: 'no_limit', reachKm: null, distanceKm: distance }
  return { status: distance <= km ? 'ok' : 'too_far', reachKm: km, distanceKm: distance }
}
