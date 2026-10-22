import { serviceCategories } from '../data/categories'
import { withBase } from './paths'

// Only categories with a photo that actually shows that work; every other category gets its icon instead
// of a borrowed picture (a paint brush on a plumbing job).
const PHOTOS = {
  handyman: 'home',
  cleaning: 'cleaning',
  'it-support': 'it',
  design: 'design',
  renovation: 'construction',
  electrician: 'electrician',
  'moving-transport': 'moving',
  gardening: 'gardening',
  marketing: 'marketing',
}

const fold = (text) => String(text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'dj')
const stem = (text) => fold(text).split(/[\s/,-]+/)[0].slice(0, 5)

/** The category a listing's category text means: exact name first, then the same first word ("Selidba" → "Selidbe i transport"). */
export function findCategory(name) {
  if (!name) return null
  return serviceCategories.find((c) => fold(c.name) === fold(name))
    || serviceCategories.find((c) => stem(c.name) === stem(name) && stem(name).length >= 4)
    || null
}

/** A photo of this kind of work, or null when there is none (show the category icon then). */
export function categoryPhoto(name, { thumb = false } = {}) {
  const file = PHOTOS[findCategory(name)?.id]
  return file ? withBase(`/images/categories/${thumb ? 'thumb/' : ''}${file}.webp`) : null
}
