// Small hand-written checks instead of zod: zod added ~13 kB (gzip) to every screen that lists jobs,
// and these few fields are all the browser validates. Same rules as before: trimmed strings with a
// max (and sometimes min) length, HTML tags stripped, unknown keys dropped. The server keeps zod.

const invalid = () => { throw new Error('invalid') }
const stripTags = (value) => value.replace(/<[^>]*>/g, '')

const text = (max, { min = 0, sanitize = false } = {}) => (value) => {
  if (typeof value !== 'string') invalid()
  const trimmed = value.trim()
  if (trimmed.length > max || trimmed.length < min) invalid()
  return sanitize ? stripTags(trimmed) : trimmed
}

// '' (no price) or a finite, non-negative number up to 1,000,000; numeric strings are coerced
const price = (value) => {
  if (value === '') return ''
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0 || number > 1000000) invalid()
  return number
}

export const profileInputSchema = {
  fullName: text(120, { sanitize: true }),
  city: text(80, { sanitize: true }),
  phone: text(40, { sanitize: true }),
  bio: text(1000, { sanitize: true }),
}

export const tagInputSchema = {
  name: text(40, { min: 1, sanitize: true }),
}

export const listingInputSchema = {
  title: text(120, { min: 3, sanitize: true }),
  description: text(5000, { sanitize: true }),
  category: text(80, { sanitize: true }),
  location: text(120, { sanitize: true }),
  price,
  tags: text(400),
}

export const parseInput = (schema, value) => {
  try {
    if (!value || typeof value !== 'object') invalid()
    return Object.fromEntries(Object.entries(schema).map(([key, check]) => [key, check(value[key])]))
  } catch {
    throw new Error('Provjerite unesene podatke.')
  }
}
