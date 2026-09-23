/**
 * Kratkoročni TURN kredencijali za pozive u aplikaciji.
 *
 * Zašto postoji: TURN korisničko ime i lozinka ne smiju stajati u frontend buildu
 * — svako bi ih pročitao iz koda i koristio vaš (plaćeni) relej. Ova funkcija ih
 * izdaje prijavljenom korisniku i vrijede sat vremena.
 *
 * Bez podešenog provajdera vraća samo STUN. Pozivi tada rade na većini mreža,
 * ali padaju iza simetričnog NAT-a (dio mobilnih operatera) — otprilike 10–20 %.
 *
 * Podešavanje (jedan od dva načina):
 *   A) vlastiti coturn / Metered / Twilio sa statičnom tajnom:
 *      TURN_URLS="turn:turn.primjer.ba:3478,turns:turn.primjer.ba:5349"
 *      TURN_SECRET="<zajednicka tajna iz coturn konfiguracije>"
 *   B) Cloudflare Calls:
 *      CF_TURN_KEY_ID, CF_TURN_API_TOKEN
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const STUN = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }]
const TTL = 3600

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

/** coturn REST: korisnicko ime je "<istek>:<korisnik>", lozinka HMAC-SHA1 tajnom. */
async function staticSecretCredentials(userId: string, urls: string[], secret: string) {
  const username = `${Math.floor(Date.now() / 1000) + TTL}:${userId}`
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'],
  )
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(username))
  const credential = btoa(String.fromCharCode(...new Uint8Array(mac)))
  return [{ urls, username, credential }]
}

async function cloudflareCredentials(keyId: string, token: string) {
  const response = await fetch(
    `https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ttl: TTL }),
    },
  )
  if (!response.ok) throw new Error(`Cloudflare TURN: ${response.status}`)
  const data = await response.json()
  return [data.iceServers]
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })

  // samo prijavljeni korisnici — inace bi relej bio otvoren svakome
  const authorization = request.headers.get('Authorization') ?? ''
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authorization } } },
  )
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    return new Response(JSON.stringify({ error: 'NEPRIJAVLJEN' }), {
      status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  let iceServers = STUN
  try {
    const cfKey = Deno.env.get('CF_TURN_KEY_ID')
    const cfToken = Deno.env.get('CF_TURN_API_TOKEN')
    const urls = Deno.env.get('TURN_URLS')
    const secret = Deno.env.get('TURN_SECRET')

    if (cfKey && cfToken) {
      iceServers = [...STUN, ...(await cloudflareCredentials(cfKey, cfToken))]
    } else if (urls && secret) {
      iceServers = [...STUN, ...(await staticSecretCredentials(user.id, urls.split(','), secret))]
    }
  } catch (turnError) {
    console.error('TURN kredencijali nisu izdati, nastavljam sa STUN-om:', turnError)
  }

  return new Response(JSON.stringify({ iceServers, ttl: TTL }), {
    headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'private, max-age=300' },
  })
})
