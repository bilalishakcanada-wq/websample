// Supabase Auth "Send SMS" hook: sends the phone verification code through Infobip.
// Secrets: SEND_SMS_HOOK_SECRETS (from Auth → Hooks, "v1,whsec_…"), INFOBIP_API_KEY; INFOBIP_BASE_URL and INFOBIP_SENDER optional
// (default: the sender number Infobip gave this account; a registered sender name like Zadatak goes in INFOBIP_SENDER).
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { Webhook } from 'npm:standardwebhooks@1.0.0'

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const fail = (status: number, message: string) => json(status, { error: { http_code: status, message } })

Deno.serve(async (req) => {
  const payload = await req.text()
  const secret = (Deno.env.get('SEND_SMS_HOOK_SECRETS') || '').replace(/^v1,whsec_/, '')
  let event: { user?: { phone?: string; phone_change?: string }; sms?: { otp?: string } }
  try {
    event = new Webhook(secret).verify(payload, Object.fromEntries(req.headers)) as typeof event
  } catch {
    return fail(401, 'Invalid hook signature')
  }

  // a number being added or changed is in phone_change; otherwise the current phone
  const to = String(event.user?.phone_change || event.user?.phone || '').replace(/\D/g, '')
  const otp = event.sms?.otp
  if (!to || !otp) return fail(400, 'Missing phone or code')

  const base = (Deno.env.get('INFOBIP_BASE_URL') || '55l1gx.api.infobip.com').replace(/^https?:\/\//, '').replace(/\/+$/, '')
  const res = await fetch(`https://${base}/sms/2/text/advanced`, {
    method: 'POST',
    headers: { Authorization: `App ${Deno.env.get('INFOBIP_API_KEY')}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      messages: [{ destinations: [{ to }], from: Deno.env.get('INFOBIP_SENDER') || '447491163443', text: `Tvoj Zadatak kod: ${otp}. Ne dijeli ga ni sa kim.` }],
    }),
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
})
