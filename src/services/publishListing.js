import { listingService } from './listingService'
import { tagService } from './tagService'
import { profileService } from './profileService'
import { contactInfoMessage, findProhibitedTerm, scanContactInfo } from '../utils/moderation'
import { queryClient } from '../lib/queryClient'
import { cleanRequirements, scheduleFromForm, todayBa } from '../utils/schedule'
import { MAX_TRAVEL_ALLOWANCE } from '../utils/reach'

// the "Kada:" line stays in the description so older app versions still show the date
const kadaLine = (timing, date) => {
  if (timing === 'flexible' || !date) return 'Fleksibilan termin'
  if (timing === 'before') return `Prije ${date}`
  return `Na dan ${date}`
}

/**
 * Validates and publishes (or updates) a job from the wizard form shared by the
 * desktop wizard and the phone flow. Throws a user-facing Error on problems.
 * Returns { listing, flaggedPhotos }.
 */
export async function publishListing({ user, form, photos = { files: [], removed: [] }, existingImages = [], tagList = [], editId = null }) {
  const hit = findProhibitedTerm(form.title, form.description)
  if (hit) throw new Error('Oglas sadrži sadržaj koji krši Pravila korištenja (npr. oružje ili droga) i ne može biti objavljen.')
  const requirements = cleanRequirements(form.requirements)
  if (findProhibitedTerm(requirements.join(' '))) throw new Error('Oglas sadrži sadržaj koji krši Pravila korištenja (npr. oružje ili droga) i ne može biti objavljen.')
  const contactScan = scanContactInfo(form.title, form.description, ...requirements)
  if (!contactScan.clean) throw new Error(contactInfoMessage(contactScan, 'oglas'))
  const schedule = scheduleFromForm(form)
  if (schedule.due_date && schedule.due_date < todayBa()) throw new Error('Datum je već prošao — odaberi današnji ili neki kasniji dan.')

  const payload = {
    user_id: user.id,
    title: form.title.trim(),
    description: `${form.description.trim()}\n\nKada: ${kadaLine(form.timing, form.date)}`,
    category: form.category,
    location: form.mode === 'remote' ? 'Online / na daljinu' : form.location,
    price: Number(form.price) > 0 ? Number(form.price) : null,
    status: 'published',
    ...schedule,
    requirements,
    // "Platiću put" only means something for jobs done in person
    travel_allowance: form.mode !== 'remote' && Number(form.travel) > 0 ? Math.min(MAX_TRAVEL_ALLOWANCE, Math.round(Number(form.travel))) : null,
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
  // every cached list that could show this job is refreshed on next paint
  queryClient.invalidateQueries({ queryKey: ['search'] })
  queryClient.invalidateQueries({ queryKey: ['me'] })
  if (editId) queryClient.invalidateQueries({ queryKey: ['listing', editId] })
  return { listing, flaggedPhotos }
}
