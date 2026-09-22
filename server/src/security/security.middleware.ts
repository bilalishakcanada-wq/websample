/**
 * Sigurnosni sloj za Node servis (KYC orkestrator, webhookovi, fakture).
 *
 * ČITAJ PRIJE UPOTREBE — šta ovaj fajl NE radi:
 * Poso.ba frontend ne prolazi kroz ovaj servis; on zove Supabase direktno.
 * Zato ovdje NEMA zaštite za objavu posla, ponude, poruke ni escrow — napadač
 * bi jednostavno zvao `https://<projekt>.supabase.co/rest/v1/...` i ovaj kod
 * ne bi ni saznao za to. Ograničenje učestalosti za te putanje je u bazi
 * (`public.rate_limit_hit`, supabase/security/02) i na Cloudflareu.
 *
 * Ovaj middleware štiti samo rute koje stvarno idu kroz Node: KYC upload,
 * webhookove provajdera i generisanje faktura.
 */
import helmet from 'helmet'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import { z, ZodSchema } from 'zod'
import type { NextFunction, Request, RequestHandler, Response } from 'express'
import crypto from 'node:crypto'

// ------------------------------------------------------------------ CORS
const ALLOWED = new Set([
  'https://poso.ba',
  'https://www.poso.ba',
  'https://bilalishakcanada-wq.github.io',
  ...(process.env.NODE_ENV !== 'production' ? ['http://localhost:54971', 'http://localhost:4173'] : []),
])

export const corsGuard = cors({
  origin(origin, done) {
    // origin je undefined za server-to-server pozive (webhookovi) — njih pušta,
    // ali ih štiti provjera potpisa, ne CORS
    if (!origin || ALLOWED.has(origin)) return done(null, true)
    done(new Error(`CORS: nedozvoljen origin ${origin}`))
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
  maxAge: 600,
})

// --------------------------------------------------------------- Headeri
export const secureHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],   // inline kritični CSS iz prerendera
      imgSrc: ["'self'", 'data:', 'blob:', 'https://kshzsnceukbpwpgpicsh.supabase.co'],
      connectSrc: ["'self'", 'https://kshzsnceukbpwpgpicsh.supabase.co', 'wss://kshzsnceukbpwpgpicsh.supabase.co'],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: [],
    },
  },
  hsts: { maxAge: 63072000, includeSubDomains: true, preload: true },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  noSniff: true,
  frameguard: { action: 'deny' },
})

// -------------------------------------------------- Ograničenje učestalosti
const byUserOrIp = (req: Request) =>
  (req as Request & { user?: { id: string } }).user?.id ?? req.ip ?? 'unknown'

/** Opšte: 300 zahtjeva u minuti po korisniku. */
export const generalLimiter = rateLimit({
  windowMs: 60_000, limit: 300, keyGenerator: byUserOrIp,
  standardHeaders: 'draft-7', legacyHeaders: false,
  message: { error: 'PREVISE_ZAHTJEVA', poruka: 'Previše zahtjeva. Pokušaj za minutu.' },
})

/** Osjetljivo (KYC upload, fakture): 10 u minuti. */
export const sensitiveLimiter = rateLimit({
  windowMs: 60_000, limit: 10, keyGenerator: byUserOrIp,
  standardHeaders: 'draft-7', legacyHeaders: false,
  message: { error: 'PREVISE_ZAHTJEVA', poruka: 'Previše pokušaja. Sačekaj minutu.' },
})

/**
 * Pogađanje lozinki/OTP-a: 5 u 15 minuta PO KORISNIČKOM IMENU, ne po IP-u.
 * Napadač sa botnetom mijenja IP; meta ostaje ista. Brojanje po meti hvata i to.
 * (Prijava na Poso.ba ide kroz Supabase Auth, koji ima svoje limite — ovo vrijedi
 * za OTP i potvrde koje servis sam izdaje.)
 */
export const bruteForceLimiter = rateLimit({
  windowMs: 15 * 60_000, limit: 5,
  keyGenerator: (req: Request) => String(req.body?.email ?? req.body?.phone ?? req.ip),
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7', legacyHeaders: false,
  message: { error: 'PREVISE_POKUSAJA', poruka: 'Previše neuspjelih pokušaja. Pokušaj za 15 minuta.' },
})

// ------------------------------------------------------------- Validacija
/**
 * Odbija sve što nije u shemi. `.strict()` je ključan: bez njega napadač šalje
 * dodatna polja (npr. `role`, `balance`) koja ORM može proslijediti u upis.
 */
export const validate =
  (schema: ZodSchema, where: 'body' | 'query' | 'params' = 'body'): RequestHandler =>
  (req, res, next) => {
    const parsed = schema.safeParse(req[where])
    if (!parsed.success) {
      return res.status(400).json({
        error: 'NEISPRAVAN_ZAHTJEV',
        polja: parsed.error.issues.map((i) => ({ polje: i.path.join('.'), problem: i.message })),
      })
    }
    req[where] = parsed.data as never   // dalje ide SAMO očišćeni oblik
    next()
  }

/** Tekst bez HTML-a: odbija, ne "čisti" — tiho čišćenje krije napad. */
export const plainText = (max: number) =>
  z.string().trim().min(1).max(max)
    .refine((v) => !/[<>]/.test(v), 'HTML oznake nisu dozvoljene')
    .refine((v) => !/javascript:|data:text\/html/i.test(v), 'Nedozvoljen sadržaj')

export const schemas = {
  uuid: z.string().uuid(),
  novac: z.number().finite().positive().max(1_000_000).multipleOf(0.01),
  kycUpload: z.object({
    caseId: z.string().uuid(),
    kind: z.enum(['id_card', 'passport', 'drivers_licence', 'company_extract']),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
  }).strict(),
}

// ------------------------------------------------------- Potpis webhookova
/**
 * Webhook nije autentifikovan time što zna našu adresu. Potpis se poredi
 * `timingSafeEqual`-om (obično poređenje curi informaciju kroz vrijeme izvršavanja),
 * a vremenska oznaka sprječava ponovno slanje presnimljenog zahtjeva.
 */
export function verifyWebhook(secretEnv: string, maxAgeSec = 300): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const secret = process.env[secretEnv]
    if (!secret) return res.status(500).json({ error: 'WEBHOOK_SECRET_NIJE_PODESEN' })

    const signature = String(req.headers['x-signature'] ?? '')
    const timestamp = Number(req.headers['x-timestamp'] ?? 0)
    if (!signature || !timestamp) return res.status(401).json({ error: 'NEPOTPISAN_ZAHTJEV' })
    if (Math.abs(Date.now() / 1000 - timestamp) > maxAgeSec) {
      return res.status(401).json({ error: 'ZASTARIO_POTPIS' })
    }

    const raw = (req as Request & { rawBody?: Buffer }).rawBody ?? Buffer.from(JSON.stringify(req.body))
    const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.`).update(raw).digest()
    const received = Buffer.from(signature, 'hex')
    if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) {
      return res.status(401).json({ error: 'NEISPRAVAN_POTPIS' })
    }
    next()
  }
}

/** Idempotency-Key je obavezan na svemu što pomjera novac. */
export const requireIdempotencyKey: RequestHandler = (req, res, next) => {
  const key = req.headers['idempotency-key']
  if (typeof key !== 'string' || key.length < 16 || key.length > 128) {
    return res.status(400).json({
      error: 'IDEMPOTENCY_KEY_OBAVEZAN',
      poruka: 'Pošalji Idempotency-Key zaglavlje (16–128 znakova) za finansijske operacije.',
    })
  }
  next()
}
