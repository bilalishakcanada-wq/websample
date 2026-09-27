// Poso.ba — Monri callback: the only place a card payment becomes balance.
//
// Monri POSTs the transaction as JSON and signs it with
//   Authorization: WP3-callback sha512(MONRI_KEY + raw body)
// We verify that signature, then call card_payment_complete(), which is
// idempotent (Monri retries until it gets 200). Deploy with verify_jwt = false:
// Monri has no Supabase token, the signature is the authentication.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const MONRI_KEY = Deno.env.get('MONRI_KEY') || ''

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

async function sha512(text: string) {
  const bytes = await crypto.subtle.digest('SHA-512', new TextEncoder().encode(text))
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// constant-time compare so the digest can't be guessed byte by byte
function same(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405)
  if (!MONRI_KEY) return json({ error: 'CARD_PAYMENTS_OFF' }, 503)

  const raw = await req.text()
  const header = req.headers.get('authorization') || req.headers.get('http_authorization') || ''
  const given = header.replace(/^WP3-callback\s+/i, '').trim().toLowerCase()
  const expected = await sha512(MONRI_KEY + raw)
  if (!given || !same(given, expected)) return json({ error: 'BAD_SIGNATURE' }, 401)

  let tx: Record<string, unknown>
  try { tx = JSON.parse(raw) } catch { return json({ error: 'BAD_JSON' }, 400) }

  const orderNumber = String(tx.order_number || '')
  if (!orderNumber) return json({ error: 'NO_ORDER' }, 400)
  const approved = String(tx.status || '').toLowerCase() === 'approved' && String(tx.response_code || '') === '0000'
  const amountMinor = Number(tx.amount || 0)
  const ref = String(tx.id || tx.approval_code || tx.reference_number || '')

  // keep what support needs, drop card details Monri may echo (masked PAN etc.)
  const { masked_pan: _pan, pan_token: _token, ...kept } = tx as Record<string, unknown>
  const { data, error } = await admin.rpc('card_payment_complete', {
    p_order: orderNumber, p_approved: approved, p_amount_minor: amountMinor, p_ref: ref, p_response: kept,
  })
  if (error) {
    console.error('card_payment_complete failed', { orderNumber, message: error.message })
    // unknown order is permanent — answer 200 so Monri stops retrying; anything else retries
    if (error.message.includes('NEPOZNATA_NARUDZBA')) return json({ ok: false, reason: 'unknown order' })
    return json({ error: 'DB' }, 500)
  }
  return json({ ok: true, status: data })
})
