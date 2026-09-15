import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
dotenv.config()
import cors from 'cors'
import express from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import morgan from 'morgan'
import multer from 'multer'
import { fileTypeFromBuffer } from 'file-type'
import { randomUUID } from 'node:crypto'
import ws from 'ws'
import { createClient } from '@supabase/supabase-js'
import { authSchema, listingSchema, profileSchema, registerSchema, tagSchema } from './validation.js'
import { findProhibitedTerm } from './moderation.js'

const app = express()
const port = Number(process.env.PORT || 3001)
app.set('trust proxy', 1)

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, { realtime: { transport: ws } })
  : null
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map((origin) => origin.trim())

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}))
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}))
app.use(express.json({ limit: '256kb' }))
app.use(morgan('combined'))
const publicResponse = (res, status = 400) => res.status(status).json({ error: 'Zahtjev nije moguće obraditi. Pokušajte ponovo.' })
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => publicResponse(res, 429),
})
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => publicResponse(res, 429),
})
const listingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.user?.id || req.ip,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => publicResponse(res, 429),
})
app.use('/api', apiLimiter)

const authRequired = async (req, res, next) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
  if (!token || !supabase) return publicResponse(res, 401)

  try {
    const userClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${token}` } } })
    const { data, error } = await userClient.auth.getUser()
    if (error || !data.user) return publicResponse(res, 401)
    req.user = data.user
    req.supabase = userClient
    return next()
  } catch {
    return publicResponse(res, 401)
  }
}

const confirmedEmailRequired = (req, res, next) => {
  if (!req.user.email_confirmed_at) return publicResponse(res, 403)
  return next()
}

const parseBody = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body)
  if (!result.success) return publicResponse(res, 400)
  req.validatedBody = result.data
  return next()
}

app.get('/api/health', (_req, res) => {
  res.status(supabase ? 200 : 503).json({ status: supabase ? 'ok' : 'degraded', app: 'poso.ba', timestamp: new Date().toISOString() })
})

app.get('/api/config', (req, res) => {
  res.json({
    appName: process.env.VITE_APP_NAME || 'Poso.ba',
    defaultLocale: process.env.VITE_DEFAULT_LOCALE || 'bs',
    paymentsEnabled: false,
    paymentProvider: 'not_configured',
  })
})

app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    if (!supabase) return publicResponse(res, 503)
    const { email, password, captchaToken } = authSchema.parse(req.body)
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password, options: { captchaToken } })
    if (error) return publicResponse(res, 401)
    return res.json(data)
  } catch {
    return publicResponse(res, 401)
  }
})

app.post('/api/auth/register', authLimiter, async (req, res) => {
  try {
    if (!supabase) return publicResponse(res, 503)
    const { fullName, email, password, city, phone, captchaToken } = registerSchema.parse(req.body)
    const { data, error } = await supabase.auth.signUp({
      email: String(email || '').trim().toLowerCase(),
      password: String(password || ''),
      options: { captchaToken, data: { full_name: String(fullName || '').trim(), city: String(city || '').trim(), phone: String(phone || '').trim(), role: 'USER' } },
    })
    if (error) return publicResponse(res, 400)
    return res.json(data)
  } catch {
    return publicResponse(res, 400)
  }
})

app.get('/api/profile', authRequired, async (req, res) => {
  try {
    const { data, error } = await req.supabase.from('profiles').select('*').eq('user_id', req.user.id).maybeSingle()
    if (error) return publicResponse(res, 400)
    return res.json(data)
  } catch {
    return publicResponse(res, 500)
  }
})

app.patch('/api/profile', authRequired, parseBody(profileSchema), async (req, res) => {
  try {
    const { data, error } = await req.supabase.from('profiles').upsert({ ...req.validatedBody, user_id: req.user.id, email: req.user.email }, { onConflict: 'user_id' }).select().single()
    if (error) return publicResponse(res, 400)
    return res.json(data)
  } catch {
    return publicResponse(res, 400)
  }
})

app.get('/api/listings', async (req, res) => {
  try {
    if (!supabase) return publicResponse(res, 503)
    const page = Math.max(Number(req.query.page || 1), 1)
    const pageSize = Math.min(Math.max(Number(req.query.pageSize || 10), 1), 50)
    const from = (page - 1) * pageSize
    const { data, error, count } = await supabase.from('listings').select('*, listing_tags(tag_id, tags(name))', { count: 'exact' }).eq('status', 'published').range(from, from + pageSize - 1).order('created_at', { ascending: false })
    if (error) return publicResponse(res, 400)
    return res.json({ data, count })
  } catch {
    return publicResponse(res, 400)
  }
})

const moderationBlockedResponse = (res) => res.status(422).json({ error: 'Oglas sadrži sadržaj koji krši Pravila korištenja (npr. oružje ili droga) i ne može biti objavljen.' })

app.post('/api/listings', authRequired, confirmedEmailRequired, listingLimiter, parseBody(listingSchema), async (req, res) => {
  try {
    const { tagIds, ...listing } = req.validatedBody
    const hit = findProhibitedTerm(listing.title, listing.description)
    if (hit) {
      console.warn('Blocked listing for prohibited content', { userId: req.user.id, category: hit.category })
      return moderationBlockedResponse(res)
    }
    const { data, error } = await req.supabase.from('listings').insert({ ...listing, user_id: req.user.id }).select().single()
    if (error) return publicResponse(res, 400)
    if (tagIds.length > 0) {
      const { error: tagError } = await req.supabase.from('listing_tags').insert(tagIds.map((tagId) => ({ listing_id: data.id, tag_id: tagId, created_by: req.user.id })))
      if (tagError) return publicResponse(res, 400)
    }
    return res.status(201).json(data)
  } catch {
    return publicResponse(res, 400)
  }
})

app.patch('/api/listings/:id', authRequired, confirmedEmailRequired, listingLimiter, parseBody(listingSchema.partial()), async (req, res) => {
  try {
    const { tagIds, ...listing } = req.validatedBody
    const hit = findProhibitedTerm(listing.title, listing.description)
    if (hit) {
      console.warn('Blocked listing update for prohibited content', { userId: req.user.id, category: hit.category })
      return moderationBlockedResponse(res)
    }
    const { data, error } = await req.supabase.from('listings').update(listing).eq('id', req.params.id).eq('user_id', req.user.id).select().single()
    if (error) return publicResponse(res, 400)
    if (tagIds) {
      await req.supabase.from('listing_tags').delete().eq('listing_id', data.id).eq('created_by', req.user.id)
      if (tagIds.length > 0) await req.supabase.from('listing_tags').insert(tagIds.map((tagId) => ({ listing_id: data.id, tag_id: tagId, created_by: req.user.id })))
    }
    return res.json(data)
  } catch {
    return publicResponse(res, 400)
  }
})

app.delete('/api/listings/:id', authRequired, listingLimiter, async (req, res) => {
  try {
    const { error } = await req.supabase.from('listings').delete().eq('id', req.params.id).eq('user_id', req.user.id)
    if (error) return publicResponse(res, 400)
    return res.status(204).end()
  } catch {
    return publicResponse(res, 400)
  }
})

app.post('/api/tags', authRequired, parseBody(tagSchema), async (req, res) => {
  try {
    const { data, error } = await req.supabase.from('tags').insert({ name: req.validatedBody.name, created_by: req.user.id }).select().single()
    if (error) return publicResponse(res, 400)
    return res.status(201).json(data)
  } catch {
    return publicResponse(res, 400)
  }
})

app.get('/api/tags', async (_req, res) => {
  try {
    if (!supabase) return publicResponse(res, 503)
    const { data, error } = await supabase.from('tags').select('id, name').order('name')
    if (error) return publicResponse(res, 400)
    return res.json(data)
  } catch {
    return publicResponse(res, 400)
  }
})

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => callback(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)),
})

app.post('/api/uploads/image', authRequired, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return publicResponse(res, 400)
    const type = await fileTypeFromBuffer(req.file.buffer)
    if (!type || !['jpg', 'png', 'webp'].includes(type.ext)) return publicResponse(res, 400)
    const storagePath = `${req.user.id}/${randomUUID()}.${type.ext}`
    const { error: uploadError } = await req.supabase.storage.from('uploads').upload(storagePath, req.file.buffer, {
      contentType: type.mime,
      cacheControl: '3600',
      upsert: false,
    })
    if (uploadError) return publicResponse(res, 400)
    const { data, error } = await req.supabase.from('uploaded_files').insert({
      user_id: req.user.id,
      file_name: req.file.originalname.slice(0, 255),
      file_type: type.mime,
      file_size: req.file.size,
      storage_path: storagePath,
      bucket_name: 'uploads',
    }).select().single()
    if (error) return publicResponse(res, 400)
    return res.status(201).json({ id: data.id, path: storagePath, contentType: type.mime, size: req.file.size })
  } catch {
    return publicResponse(res, 400)
  }
})

app.use((_err, _req, res, _next) => publicResponse(res, 500))

app.listen(port, () => console.log(`Server running on http://localhost:${port}`))
