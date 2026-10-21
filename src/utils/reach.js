// Udaljenost do posla. Kao na Airtaskeru to je samo informacija: ne ograničava ko smije poslati ponudu
// (doseg ponuda i molba za prevoz su uklonjeni, supabase/airtasker-lokacija/01).
import { coordsForLocation, distanceKm, isRemoteLocation } from '../data/cityCoordinates'

// older jobs may still carry money for the trip ("Platiću put"); new ones no longer ask for it
export const MAX_TRAVEL_ALLOWANCE = 500

/** "Klijent plaća put do 20 KM" or null. */
export const travelLabel = (listing) => (Number(listing?.travel_allowance) > 0 ? `Klijent plaća put do ${Number(listing.travel_allowance).toLocaleString('hr-HR')} KM` : null)

/**
 * km from the viewer to the job (rounded to 0.1), or null when either place is unknown or the job is online.
 * myPoint: the viewer's { lat, lng } when known (device or profile address), else their profile city.
 */
export const distanceToJob = (listing, myCity, myPoint = null) => {
  if (!listing || isRemoteLocation(listing.location)) return null
  const job = listing.lat != null && listing.lng != null ? { lat: listing.lat, lng: listing.lng } : coordsForLocation(listing.location)
  const me = myPoint || coordsForLocation(myCity)
  if (!job || !me) return null
  return Math.round(distanceKm(me, job) * 10) / 10
}

/** "Oko 12 km od tebe" / "Manje od 1 km od tebe". */
export const distanceLabel = (km) => (km == null ? null : km < 1 ? 'Manje od 1 km od tebe' : `Oko ${Math.round(km)} km od tebe`)
