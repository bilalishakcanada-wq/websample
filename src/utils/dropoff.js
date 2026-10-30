// "Odakle" i "Dokle": selidba, prevoz i dostava imaju dva mjesta, kao na Airtaskeru (supabase/airtasker-lokacija/02).
// Odakle je obično mjesto posla (location), Dokle je dropoff_location. Javno se vide samo nazivi mjesta;
// tačne adrese vide vlasnik i izvođač čija je ponuda prihvaćena.

/** Does the form describe a job that moves something from one place to another? */
export const isMovingForm = (form) => form?.mode === 'in-person' && Boolean(form?.moving)

/** The place the job form will save, with the street when it has one: "Otes, Ilidža · Ilirska 1". */
const withStreet = (place, exact) => (exact?.address ? `${place} · ${exact.address}` : place)

/** What the review step shows under "Gdje". */
export const formWhereLabel = (form) => {
  if (form?.mode === 'remote') return 'Online / na daljinu'
  const from = withStreet(form?.location || '-', form?.exact)
  return isMovingForm(form) ? `Odakle: ${from} → Dokle: ${withStreet(form.dropoff || '-', form.dropoffExact)}` : from
}

/** "Sarajevo → Mostar" for a job with two places, else null. */
export const listingRoute = (listing) => (listing?.dropoff_location ? `${listing.location} → ${listing.dropoff_location}` : null)
