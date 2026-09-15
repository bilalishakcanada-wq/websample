import { z } from 'zod'

const text = (max) => z.string().trim().max(max)
const sanitizedText = (max) => text(max).transform((value) => value.replace(/<[^>]*>/g, ''))

export const profileInputSchema = z.object({
  fullName: sanitizedText(120),
  city: sanitizedText(80),
  phone: sanitizedText(40),
  bio: sanitizedText(1000),
})

export const tagInputSchema = z.object({
  name: text(40).min(1).transform((value) => value.replace(/<[^>]*>/g, '')),
})

export const listingInputSchema = z.object({
  title: text(120).min(3).transform((value) => value.replace(/<[^>]*>/g, '')),
  description: sanitizedText(5000),
  category: sanitizedText(80),
  location: sanitizedText(120),
  price: z.union([z.literal(''), z.coerce.number().finite().nonnegative().max(1000000)]),
  tags: text(400),
})

export const parseInput = (schema, value) => {
  const result = schema.safeParse(value)
  if (!result.success) {
    throw new Error('Provjerite unesene podatke.')
  }
  return result.data
}