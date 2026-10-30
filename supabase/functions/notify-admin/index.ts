// Zadatak.ba, external admin notifications.
//
// Called by database triggers (x-sweep-key) when a user writes to support or the
// Kontakt page, or the moderation engine suspends / flags an account. Delivers to whatever
// is configured:
//   TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID  -> Telegram message
//   RESEND_API_KEY + RESEND_FROM + ADMIN_EMAIL -> branded HTML email via Resend
// Without any of these it just reports "skipped", in-app notifications
// (the bell in the header) work regardless.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2.109.0'
import { renderEmailLayout, emailSiteUrl } from '../_shared/brandedEmail.ts'
import { configuredEmailSender } from '../_shared/emailSender.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || ''
const TELEGRAM_CHAT_ID = Deno.env.get('TELEGRAM_CHAT_ID') || ''
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || ''
const RESEND_FROM = configuredEmailSender(Deno.env.get('RESEND_FROM')) || ''
const ADMIN_EMAIL = Deno.env.get('ADMIN_EMAIL') || ''
const SITE_URL = Deno.env.get('SITE_URL') || 'https://zadatak.ba'

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

type Payload = { kind: 'support' | 'moderation' | 'contact'; user_id?: string; name?: string; member_id?: string; action?: string; message?: string; email?: string }
type Rendered = { title: string; text: string; replyTo?: string }

const EMAIL_RE = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/

function render(p: Payload): Rendered {
  const who = `${p.name || 'Korisnik'}${p.member_id ? ` (${p.member_id})` : ''}`
  if (p.kind === 'contact') {
    // a message from the Kontakt page: answering the admin mail goes straight to the sender
    const email = String(p.email || '').trim()
    const replyTo = EMAIL_RE.test(email) ? email : undefined
    return { title: `Kontakt stranica: ${who}`, text: `${p.message || ''}\n\nOdgovori na: ${replyTo || '(nema ispravnog emaila)'}`, replyTo }
  }
  if (p.kind === 'support') {
    return { title: `🆘 Nova poruka podrške, ${who}`, text: `${p.message || ''}\n\nOdgovori: ${SITE_URL}/admin` }
  }
  const label = p.action === 'suspended' ? '⛔ Nalog suspendovan' : '🤖 AI označio nalog'
  return { title: `${label}, ${who}`, text: `${p.message || ''}\n\nPregled: ${SITE_URL}/admin` }
}

async function sendTelegram(title: string, text: string) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return 'skipped'
  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: `${title}\n\n${text}` }),
  })
  return res.ok ? 'sent' : `error ${res.status}`
}

async function sendEmail(title: string, text: string, replyTo?: string) {
  if (!RESEND_API_KEY || !RESEND_FROM || !ADMIN_EMAIL) return 'skipped'
  try {
    const site = emailSiteUrl(SITE_URL)
    site.search = ''; site.hash = ''
    const mail = renderEmailLayout({ subject: title, heading: title, paragraphs: [text],
      action: 'Otvori administraciju', actionUrl: `${site.href.replace(/\/$/, '')}/admin`,
      footer: 'Interna obavijest za administraciju platforme Zadatak.ba.' })
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: RESEND_FROM, to: [ADMIN_EMAIL], ...(replyTo ? { reply_to: replyTo } : {}), ...mail }), signal: AbortSignal.timeout(15000),
    })
    return res.ok ? 'sent' : `error ${res.status}`
  } catch { return 'error unavailable' }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405)
  const sweepKey = req.headers.get('x-sweep-key')
  const { data: setting } = await admin.from('moderation_settings').select('value').eq('key', 'sweep_key').single()
  if (!sweepKey || !setting || setting.value !== sweepKey) return json({ error: 'forbidden' }, 403)

  const payload = (await req.json().catch(() => ({}))) as Payload
  if (!['support', 'moderation', 'contact'].includes(payload.kind)) return json({ error: 'bad payload' }, 400)

  const { title, text, replyTo } = render(payload)
  const [telegram, email] = await Promise.all([sendTelegram(title, text), sendEmail(title, text, replyTo)])
  return json({ telegram, email, configured: { telegram: Boolean(TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID), email: Boolean(RESEND_API_KEY && RESEND_FROM && ADMIN_EMAIL) } })
})
