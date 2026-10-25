// Supabase Auth "Send SMS" hook: sends the phone verification code through Twilio (when TWILIO_ACCOUNT_SID is set) or Infobip.
// Secrets: SEND_SMS_HOOK_SECRETS (from Auth → Hooks, "v1,whsec_…"); Twilio: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM;
// Infobip: INFOBIP_API_KEY, optional INFOBIP_BASE_URL and INFOBIP_SENDER (default: the sender number Infobip gave this account).
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { Webhook } from 'npm:standardwebhooks@1.0.0'

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const fail = (status: number, message: string) => json(status, { error: { http_code: status, message } })

Deno.serve(async (req) => {
  const payload = await req.text()
  // the dashboard value may hold several secrets ("v1,whsec_a|v1,whsec_b"); any one may sign
  const secrets = (Deno.env.get('SEND_SMS_HOOK_SECRETS') || '').split('|')
    .map((value) => value.trim().replace(/^v1,/, '').replace(/^whsec_/, '')).filter(Boolean)
  const headers = Object.fromEntries(req.headers)
  type HookEvent = { user?: { phone?: string; phone_change?: string }; sms?: { otp?: string } }
  let event: HookEvent | null = null
  for (const secret of secrets) {
    try {
      event = new Webhook(secret).verify(payload, headers) as HookEvent
      break
    } catch { /* try the next secret */ }
  }
  if (!event) {
    console.error('Send SMS hook: signature check failed', { secrets: secrets.length, hasSignature: Boolean(headers['webhook-signature']) })
    return fail(401, 'Invalid hook signature')
  }

  // a number being added or changed is in phone_change; otherwise the current phone
  const to = String(event.user?.phone_change || event.user?.phone || '').replace(/\D/g, '')
  const otp = event.sms?.otp
  if (!to || !otp) return fail(400, 'Missing phone or code')

  const text = `Zadatak kod: ${otp}\nUpiši ga u aplikaciju da potvrdiš broj. Ne dijeli ga ni sa kim.\n\n@bilalishakcanada-wq.github.io #${otp}`
  // zadnji red poruke je za automatsko upisivanje koda na Androidu (WebOTP)
  return Deno.env.get('TWILIO_ACCOUNT_SID') ? sendTwilio(to, text) : sendInfobip(to, text)
})

// Twilio: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM (the Twilio phone number, or an MG… Messaging Service SID)
async function sendTwilio(to: string, text: string) {
  const sid = (Deno.env.get('TWILIO_ACCOUNT_SID') || '').trim()
  const token = (Deno.env.get('TWILIO_AUTH_TOKEN') || '').trim()
  const from = (Deno.env.get('TWILIO_FROM') || '').trim()
  const form = new URLSearchParams({ To: `+${to}`, Body: text })
  form.set(from.startsWith('MG') ? 'MessagingServiceSid' : 'From', from)
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: `Basic ${btoa(`${sid}:${token}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
    signal: AbortSignal.timeout(10000),
  }).catch((error) => ({ ok: false, status: 0, text: async () => String(error) }) as Response)
  if (!res.ok) {
    const detail = await res.text()
    console.error('Twilio send failed', { status: res.status, detail: detail.slice(0, 500) })
    return fail(res.status === 400 ? 400 : 500, 'SMS could not be sent')
  }
  return json(200, {})
}

async function sendInfobip(to: string, text: string) {
  // the key may be pasted with "App " in front or a stray space
  const apiKey = (Deno.env.get('INFOBIP_API_KEY') || '').trim().replace(/^App\s+/i, '')
  const base = (Deno.env.get('INFOBIP_BASE_URL') || '55l1gx.api.infobip.com').replace(/^https?:\/\//, '').replace(/\/+$/, '')
  const res = await fetch(`https://${base}/sms/2/text/advanced`, {
    method: 'POST',
    headers: { Authorization: `App ${apiKey}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ messages: [{ destinations: [{ to }], from: Deno.env.get('INFOBIP_SENDER') || '447491163443', text }] }),
    signal: AbortSignal.timeout(10000),
  }).catch((error) => ({ ok: false, status: 0, text: async () => String(error) }) as Response)

  if (!res.ok) {
    const detail = await res.text()
    console.error('Infobip send failed', { status: res.status, detail: detail.slice(0, 500) })
    return fail(500, 'SMS could not be sent')
  }
  // Infobip answers 200 per request; a refused number is marked REJECTED inside
  const sent = await res.json().catch(() => null)
  const status = sent?.messages?.[0]?.status
  if (status?.groupName === 'REJECTED') {
    console.error('Infobip rejected the SMS', status)
    return fail(400, 'SMS could not be sent to this number')
  }
  return json(200, {})
}
