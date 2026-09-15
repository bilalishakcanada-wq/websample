import { z } from 'zod'

const boundedText = (max) => z.string().trim().max(max)
const sanitizedText = (max) => boundedText(max).transform((value) => value.replace(/<[^>]*>/g, ''))

export const profileSchema = z.object({
  full_name: sanitizedText(120).optional(),
  phone: sanitizedText(40).optional(),
  city: sanitizedText(80).optional(),
  bio: sanitizedText(1000).optional(),
  avatar_url: z.string().url().max(2048).optional().or(z.literal('')),
})

export const listingSchema = z.object({
  title: boundedText(120).min(3).transform((value) => value.replace(/<[^>]*>/g, '')),
  description: sanitizedText(5000).optional(),
  category: sanitizedText(80).optional(),
  location: sanitizedText(120).optional(),
  price: z.number().finite().nonnegative().max(1000000).nullable().optional(),
  currency: z.enum(['BAM']).default('BAM'),
  status: z.enum(['draft', 'published', 'paused', 'closed', 'archived']).default('draft'),
  tagIds: z.array(z.string().uuid()).max(10).default([]),
})

export const tagSchema = z.object({ name: boundedText(40).min(1).transform((value) => value.replace(/<[^>]*>/g, '')) })

export const authSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128),
  captchaToken: z.string().min(1).max(4096),
})

export const registerSchema = authSchema.extend({
  fullName: boundedText(120).min(2).transform((value) => value.replace(/<[^>]*>/g, '')),
  city: sanitizedText(80).optional(),
  phone: sanitizedText(40).optional(),
})

export const publicError = () => new Error('Zahtjev nije moguće obraditi. Pokušajte ponovo.')