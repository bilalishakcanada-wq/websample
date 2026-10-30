import { listingService } from './listingService'
import { tagService } from './tagService'
import { profileService } from './profileService'
import { contactInfoMessage, findProhibitedTerm, findStreetAddress, scanContactInfo, streetAddressMessage } from '../utils/moderation'
import { queryClient } from '../lib/queryClient'
import { cleanRequirements, scheduleFromForm, todayBa } from '../utils/schedule'
import { MAX_TRAVEL_ALLOWANCE } from '../utils/reach'
import { cleanConditions } from '../utils/jobConditions'
import { placeService } from './placeService'

// the "Kada:" line stays in the description so older app versions still show the date.
// "Prije: " with the colon: the database's contact-details filter reads "Prije 2026-10-01"
// ("e" + 8 digits) as a phone number, hides the date and counts a strike against the poster.
const kadaLine = (timing, date) => {
  if (timing === 'flexible' || !date) return 'Fleksibilan termin'
  if (timing === 'before') return `Prije: ${date}`
  return `Na dan ${date}`
}

/**
 * Validates and publishes (or updates) a job from the wizard form shared by the
 * desktop wizard and the phone flow. Throws a user-facing Error on problems.
 * Returns { listing, flaggedPhotos, addressError }.
 */
export async function publishListing({ user, form, photos = { files: [], removed: [] }, existingImages = [], tagList = [], editId = null, invitedProvider = null }) {
  const hit = findProhibitedTerm(form.title, form.description)
  if (hit) throw new Error('Oglas sadrži sadržaj koji krši Pravila korištenja (npr. oružje ili droga) i ne može biti objavljen.')
  const requirements = cleanRequirements(form.requirements)
  if (findProhibitedTerm(requirements.join(' '))) throw new Error('Oglas sadrži sadržaj koji krši Pravila korištenja (npr. oružje ili droga) i ne može biti objavljen.')
  const contactScan = scanContactInfo(form.title, form.description, ...requirements)
  if (!contactScan.clean) throw new Error(contactInfoMessage(contactScan, 'oglas'))
  const street = findStreetAddress(form.title, form.description)
  if (street) throw new Error(streetAddressMessage(street, 'naslov ni opis'))
  const schedule = scheduleFromForm(form)
  if (schedule.due_date && schedule.due_date < todayBa()) throw new Error('Datum je već prošao, odaberi današnji ili neki kasniji dan.')

  const payload = {
    user_id: user.id,
    title: form.title.trim(),
    description: `${form.description.trim()}\n\nKada: ${kadaLine(form.timing, form.date)}`,
    category: form.category,
    location: form.mode === 'remote' ? 'Online / na daljinu' : form.location,
    // selidba / prevoz / dostava: the second place ("Dokle"); null clears it on an edit
    dropoff_location: form.mode !== 'remote' && form.moving && form.dropoff ? form.dropoff : null,
    price: Number(form.price) > 0 ? Number(form.price) : null,
    status: 'published',
    ...schedule,
    requirements,
    // badge requirements + perks; the database checks the badges again on every offer
    conditions: cleanConditions(form.conditions),
    // "Platiću put" only means something for jobs done in person
    travel_allowance: form.mode !== 'remote' && Number(form.travel) > 0 ? Math.min(MAX_TRAVEL_ALLOWANCE, Math.round(Number(form.travel))) : null,
    // "Zatraži ponudu": sent privately to one provider; an edit never changes who it went to
    ...(!editId && invitedProvider && invitedProvider !== user.id ? { invited_provider: invitedProvider } : {}),
  }
  const listing = editId ? await listingService.updateListing(editId, payload) : await listingService.createListing(payload)
  if (tagList.length > 0) await tagService.createForListing(listing.id, tagList, user.id)

  for (const image of existingImages.filter((item) => photos.removed.includes(item.id))) await listingService.deleteImage(image)
  let flaggedPhotos = 0
  if (photos.files.length > 0) {
    const kept = existingImages.filter((item) => !photos.removed.includes(item.id)).length
    await listingService.uploadImages(user.id, listing.id, photos.files, kept)
    const outcome = await profileService.checkMyMedia()
    flaggedPhotos = (outcome.results || []).filter((item) => item.kind === 'listing' && item.status === 'flagged').length
  }
  // exact address (street and number or GPS): form.exact undefined = untouched, null = removed.
  // The job is already saved, so a failure here is reported, not thrown.
  let addressError = ''
  try {
    if (form.mode !== 'remote' && form.exact?.lat != null) await placeService.setListingAddress(listing.id, form.exact)
    else if (editId && (form.mode === 'remote' || form.exact === null)) await placeService.clearListingAddress(listing.id)
    if (form.mode !== 'remote' && form.moving && form.dropoff && form.dropoffExact?.lat != null) await placeService.setListingDropoffAddress(listing.id, form.dropoffExact)
    else if (editId && form.dropoffExact === null) await placeService.clearListingDropoffAddress(listing.id)
  } catch (error) {
    addressError = error.message || 'Tačna adresa nije sačuvana.'
  }
  // every cached list that could show this job is refreshed on next paint
  queryClient.invalidateQueries({ queryKey: ['search'] })
  queryClient.invalidateQueries({ queryKey: ['me'] })
  if (editId) queryClient.invalidateQueries({ queryKey: ['listing', editId] })
  return { listing, flaggedPhotos, addressError }
}
