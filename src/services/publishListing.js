import { listingService } from './listingService'
import { tagService } from './tagService'
import { profileService } from './profileService'
import { contactInfoMessage, findProhibitedTerm, scanContactInfo } from '../utils/moderation'
import { queryClient } from '../lib/queryClient'

export const timingLabel = (timing, date) => {
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
  const contactScan = scanContactInfo(form.title, form.description)
  if (!contactScan.clean) throw new Error(contactInfoMessage(contactScan, 'oglas'))

  const payload = {
    user_id: user.id,
    title: form.title.trim(),
    description: `${form.description.trim()}\n\nKada: ${timingLabel(form.timing, form.date)}`,
    category: form.category,
    location: form.mode === 'remote' ? 'Online / na daljinu' : form.location,
    price: Number(form.price) > 0 ? Number(form.price) : null,
    status: 'published',
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
