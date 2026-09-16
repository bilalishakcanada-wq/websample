// Poso.ba — external admin notifications.
//
// Called by database triggers (x-sweep-key) when a user writes to support
// or the moderation engine suspends / flags an account. Delivers to whatever
// is configured:
//   TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID  -> Telegram message
//   RESEND_API_KEY + ADMIN_EMAIL           -> email via Resend
// Without any of these it just reports "skipped" — in-app notifications
// (the bell in the header) work regardless.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || ''
const TELEGRAM_CHAT_ID = Deno.env.get('TELEGRAM_CHAT_ID') || ''
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || ''
const ADMIN_EMAIL = Deno.env.get('ADMIN_EMAIL') || ''
const SITE_URL = Deno.env.get('SITE_URL') || 'https://poso.ba'

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

type Payload = { kind: 'support' | 'moderation'; user_id?: string; name?: string; member_id?: string; action?: string; message?: string }

function render(p: Payload) {
  const who = `${p.name || 'Korisnik'}${p.member_id ? ` (${p.member_id})` : ''}`
  if (p.kind === 'support') {
    return { title: `🆘 Nova poruka podrške — ${who}`, text: `${p.message || ''}\n\nOdgovori: ${SITE_URL}/admin` }
  }
  const label = p.action === 'suspended' ? '⛔ Nalog suspendovan' : '🤖 AI označio nalog'
  return { title: `${label} — ${who}`, text: `${p.message || ''}\n\nPregled: ${SITE_URL}/admin` }
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

async function sendEmail(title: string, text: string) {
  if (!RESEND_API_KEY || !ADMIN_EMAIL) return 'skipped'
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'Poso.ba <onboarding@resend.dev>', to: [ADMIN_EMAIL], subject: title, text }),
  })
  return res.ok ? 'sent' : `error ${res.status}`
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405)
  const sweepKey = req.headers.get('x-sweep-key')
  const { data: setting } = await admin.from('moderation_settings').select('value').eq('key', 'sweep_key').single()
  if (!sweepKey || !setting || setting.value !== sweepKey) return json({ error: 'forbidden' }, 403)

  const payload = (await req.json().catch(() => ({}))) as Payload
  if (!payload.kind) return json({ error: 'bad payload' }, 400)

  const { title, text } = render(payload)
  const [telegram, email] = await Promise.all([sendTelegram(title, text), sendEmail(title, text)])
  return json({ telegram, email, configured: { telegram: Boolean(TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID), email: Boolean(RESEND_API_KEY && ADMIN_EMAIL) } })
})
