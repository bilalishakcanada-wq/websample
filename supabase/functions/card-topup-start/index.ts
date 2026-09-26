// Poso.ba — start a card top-up through Monri WebPay Form.
//
// The browser calls this with { amount } (KM). We open a card_payments row and
// return the signed form fields; the browser POSTs them to Monri, where the
// card is entered (card data never touches Poso.ba). Money reaches the balance
// only through card-topup-callback, never through the return redirect.
//
// Secrets (Supabase → Edge Functions → Secrets):
//   MONRI_KEY                 merchant key (signs the digest)
//   MONRI_AUTHENTICITY_TOKEN  merchant authenticity token
//   MONRI_ENV                 'test' (default) → ipgtest.monri.com, 'live' → ipg.monri.com
// Without MONRI_KEY/MONRI_AUTHENTICITY_TOKEN card payments are off (503 CARD_PAYMENTS_OFF).
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SITE_URL = (Deno.env.get('SITE_URL') || 'https://bilalishakcanada-wq.github.io/websample').replace(/\/$/, '')
const MONRI_KEY = Deno.env.get('MONRI_KEY') || ''
const MONRI_TOKEN = Deno.env.get('MONRI_AUTHENTICITY_TOKEN') || ''
const LIVE = Deno.env.get('MONRI_ENV') === 'live'
const MONRI_FORM = LIVE ? 'https://ipg.monri.com/v2/form' : 'https://ipgtest.monri.com/v2/form'

const MIN_KM = 5
const MAX_KM = 2000

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

async function sha512(text: string) {
  const bytes = await crypto.subtle.digest('SHA-512', new TextEncoder().encode(text))
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)
  if (!MONRI_KEY || !MONRI_TOKEN) return json({ error: 'CARD_PAYMENTS_OFF' }, 503)

  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
  const { data: auth } = await admin.auth.getUser(token)
  const user = auth?.user
  if (!user) return json({ error: 'FORBIDDEN' }, 401)

  const body = await req.json().catch(() => ({}))
  const amount = Math.round(Number(body?.amount) * 100) / 100
  if (!Number.isFinite(amount) || amount < MIN_KM || amount > MAX_KM) return json({ error: 'BAD_AMOUNT', min: MIN_KM, max: MAX_KM }, 400)

  const { data: profile } = await admin.from('profiles')
    .select('full_name, email, phone, city, account_status, suspended_until').eq('user_id', user.id).maybeSingle()
  if (!profile) return json({ error: 'NO_PROFILE' }, 400)
  if (profile.account_status !== 'active' || (profile.suspended_until && new Date(profile.suspended_until) > new Date())) {
    return json({ error: 'SUSPENDED' }, 403)
  }

  // no more than 5 unfinished attempts in 10 minutes — stops card testing through our form
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  const { count } = await admin.from('card_payments').select('id', { count: 'exact', head: true })
    .eq('user_id', user.id).gte('created_at', since)
  if ((count || 0) >= 5) return json({ error: 'TOO_MANY_ATTEMPTS' }, 429)

  const orderNumber = `PB${Date.now().toString(36).toUpperCase()}${crypto.randomUUID().slice(0, 6).toUpperCase()}`
  const amountMinor = Math.round(amount * 100)
  const { error: insertError } = await admin.from('card_payments')
    .insert({ user_id: user.id, order_number: orderNumber, amount_km: amount, test_mode: !LIVE })
  if (insertError) return json({ error: 'DB', detail: insertError.message }, 500)

  const currency = 'BAM'
  const fields: Record<string, string> = {
    ch_full_name: (profile.full_name || 'Poso.ba korisnik').slice(0, 30),
    ch_address: 'N/A',
    ch_city: (profile.city || 'Sarajevo').slice(0, 30),
    ch_zip: '71000',
    ch_country: 'BA',
    ch_phone: (profile.phone || '000000').slice(0, 30),
    ch_email: (profile.email || user.email || '').slice(0, 100),
    order_info: `Poso.ba uplata na balans ${amount.toFixed(2)} KM`,
    order_number: orderNumber,
    amount: String(amountMinor),
    currency,
    language: 'ba',
    transaction_type: 'purchase',
    authenticity_token: MONRI_TOKEN,
    digest: await sha512(MONRI_KEY + orderNumber + amountMinor + currency),
    success_url_override: `${SITE_URL}/account/novcanik?uplata=ok&narudzba=${orderNumber}`,
    cancel_url_override: `${SITE_URL}/account/novcanik?uplata=otkazano&narudzba=${orderNumber}`,
    callback_url_override: `${SUPABASE_URL}/functions/v1/card-topup-callback`,
  }
  return json({ action: MONRI_FORM, fields, order_number: orderNumber, test_mode: !LIVE })
})
