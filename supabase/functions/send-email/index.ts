// Zadatak — notification emails (nova ponuda, prihvaćena ponuda, poruka, uplata…).
//
// Called by the on_notification_email trigger (x-sweep-key) for every in-app notification whose
// type is worth a mail and whose user has not turned mails off (profiles.notify_email). Renders
// the notification in one of the three looks (A Mostar, B sofra, C Baščaršija) at random and
// sends it, at most once per user + type + link every 15 minutes and 20 per user per day.
//
// Sender, set as Edge Function secrets (Dashboard → Edge Functions → Secrets):
//   RESEND_API_KEY + EMAIL_FROM                      → Resend (own domain, best delivery), or
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM  → any SMTP, e.g. Gmail app password
//                                                      (smtp.gmail.com, 465), the same as Auth uses.
// Without either it answers {skipped:'no sender'} and nothing breaks.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import nodemailer from 'npm:nodemailer@6.9.16'
import { escapeHtml, pickVariant, renderEmail } from '../_shared/emailLayouts.js'
import { EMAIL_TYPES, emailMessage } from '../_shared/notificationEmails.js'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SITE_URL = (Deno.env.get('SITE_URL') || 'https://bilalishakcanada-wq.github.io/websample').replace(/\/$/, '')
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SMTP_HOST = Deno.env.get('SMTP_HOST')
const SMTP_PORT = Number(Deno.env.get('SMTP_PORT') || 465)
const SMTP_USER = Deno.env.get('SMTP_USER')
const SMTP_PASS = Deno.env.get('SMTP_PASS')
const EMAIL_FROM = Deno.env.get('EMAIL_FROM') || (SMTP_USER ? `Zadatak <${SMTP_USER}>` : '')

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

type Payload = { notification_id?: string; user_id: string; type?: string; title: string; message?: string; link?: string }
type Mail = { to: string; subject: string; html: string; text: string; unsubscribe: string }

async function send(mail: Mail) {
  const headers = { 'List-Unsubscribe': `<${mail.unsubscribe}>` }
  if (RESEND_API_KEY) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: EMAIL_FROM, to: [mail.to], subject: mail.subject, html: mail.html, text: mail.text, headers }),
    })
    if (!res.ok) throw new Error(`resend ${res.status}: ${(await res.text()).slice(0, 200)}`)
    return 'resend'
  }
  const transport = nodemailer.createTransport({ host: SMTP_HOST, port: SMTP_PORT, secure: SMTP_PORT === 465, auth: { user: SMTP_USER, pass: SMTP_PASS } })
  await transport.sendMail({ from: EMAIL_FROM, to: mail.to, subject: mail.subject, html: mail.html, text: mail.text, headers })
  return 'smtp'
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405)
  const sweepKey = req.headers.get('x-sweep-key')
  const { data: setting } = await admin.from('moderation_settings').select('value').eq('key', 'sweep_key').single()
  if (!sweepKey || !setting || setting.value !== sweepKey) return json({ error: 'forbidden' }, 403)

  const payload = (await req.json().catch(() => ({}))) as Payload
  if (!payload.user_id || !payload.title) return json({ error: 'bad payload' }, 400)
  const type = payload.type || ''
  if (!EMAIL_TYPES[type]) return json({ skipped: 'type' })
  if (!RESEND_API_KEY && !(SMTP_HOST && SMTP_USER && SMTP_PASS)) return json({ skipped: 'no sender' })
  if (!EMAIL_FROM) return json({ skipped: 'no EMAIL_FROM' })

  const { data: profile } = await admin.from('profiles').select('notify_email, full_name, account_status').eq('user_id', payload.user_id).maybeSingle()
  if (profile?.notify_email === false) return json({ skipped: 'opted out' })

  const { data: userData } = await admin.auth.admin.getUserById(payload.user_id)
  const user = userData?.user
  if (!user?.email || !user.email_confirmed_at) return json({ skipped: 'no confirmed email' })
  if (/\.(test|invalid|example|local|localhost)$/i.test(user.email)) return json({ skipped: 'test address' })

  // throttle: the same kind of mail about the same thing once per 15 minutes, 20 mails a day
  const since15 = new Date(Date.now() - 15 * 60 * 1000).toISOString()
  const since24 = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const link = payload.link || ''
  const [{ count: recent }, { count: today }] = await Promise.all([
    admin.from('email_log').select('id', { count: 'exact', head: true }).eq('user_id', payload.user_id).eq('type', type).eq('link', link).gte('sent_at', since15),
    admin.from('email_log').select('id', { count: 'exact', head: true }).eq('user_id', payload.user_id).gte('sent_at', since24),
  ])
  if ((recent ?? 0) > 0) return json({ skipped: 'throttled' })
  if ((today ?? 0) >= 20) return json({ skipped: 'daily cap' })

  const variant = pickVariant()
  const message = emailMessage({ ...payload, type }, { site: SITE_URL, firstName: String(profile?.full_name || '').split(/\s+/)[0] })
  const html = renderEmail(variant, message, SITE_URL)
  const text = `${payload.title}\n\n${payload.message || ''}\n\n${message.url}\n\n—\nZadatak · Mailove o obavijestima možete isključiti: ${SITE_URL}/account/postavke-obavijesti`

  try {
    const via = await send({ to: user.email, subject: message.subject, html, text, unsubscribe: `${SITE_URL}/account/postavke-obavijesti` })
    await admin.from('email_log').insert({ user_id: payload.user_id, notification_id: payload.notification_id || null, type, link, variant, status: 'sent' })
    return json({ sent: via, variant })
  } catch (error) {
    const reason = String((error as Error)?.message || error).slice(0, 300)
    await admin.from('email_log').insert({ user_id: payload.user_id, notification_id: payload.notification_id || null, type, link, variant, status: 'error', error: escapeHtml(reason) })
    return json({ error: reason }, 502)
  }
})
