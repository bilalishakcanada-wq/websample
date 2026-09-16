// Poso.ba — AI image moderation for Rule #1 (no contact details on the platform).
//
// Two ways in:
//   1. A signed-in user right after uploading (Authorization: Bearer <jwt>) —
//      only their own queued images are processed, so they get instant feedback.
//   2. The 5-minute database sweep (x-sweep-key header, value stored in
//      public.moderation_settings) — processes everyone's queue.
//
// Needs the ANTHROPIC_API_KEY secret. Without it images stay queued as
// "unconfigured" and are visible to admins.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') || ''
const MODEL = Deno.env.get('MODERATION_MODEL') || 'claude-haiku-4-5-20251001'

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sweep-key',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const PROMPT = `You moderate images for a services marketplace in Bosnia. Users must not share any way to contact them outside the platform.
Look at the image and decide whether it contains contact information or promotion of an outside channel:
- phone numbers in any format (typed, handwritten, on a business card, on a van, on a sign)
- email addresses, website URLs, QR codes
- social media handles, usernames or "@name" text, or logos of Instagram/Facebook/TikTok/Viber/WhatsApp/Telegram/Snapchat next to a name
- text like "zovite", "pozovi", "call me", "nazovi"
Ordinary photos of people, tools, finished work, rooms or logos without contact details are fine.
Answer with JSON only: {"contact_info": true or false, "found": ["short list of what you saw"], "reason": "one sentence in Bosnian"}`

type Verdict = { status: 'clean' | 'flagged' | 'unconfigured' | 'error'; reason?: string; found?: string[] }

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

async function analyseImage(url: string): Promise<Verdict> {
  if (!ANTHROPIC_KEY) return { status: 'unconfigured' }
  const res = await fetch(url)
  if (!res.ok) return { status: 'error', reason: `fetch ${res.status}` }
  const type = (res.headers.get('content-type') || 'image/jpeg').split(';')[0].trim()
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(type)) return { status: 'error', reason: `unsupported ${type}` }
  const bytes = new Uint8Array(await res.arrayBuffer())
  if (bytes.length > 5 * 1024 * 1024) return { status: 'error', reason: 'image larger than 5 MB' }

  const ai = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: type, data: toBase64(bytes) } },
          { type: 'text', text: PROMPT },
        ],
      }],
    }),
  })
  if (!ai.ok) return { status: 'error', reason: `anthropic ${ai.status}: ${(await ai.text()).slice(0, 200)}` }
  const data = await ai.json()
  const text: string = (data.content || []).map((c: { text?: string }) => c.text || '').join('')
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return { status: 'error', reason: 'unparseable model answer' }
  try {
    const parsed = JSON.parse(match[0])
    return { status: parsed.contact_info ? 'flagged' : 'clean', reason: parsed.reason, found: parsed.found }
  } catch {
    return { status: 'error', reason: 'unparseable model answer' }
  }
}

// "https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>" -> { bucket, path }
function storageRef(url: string): { bucket: string; path: string } | null {
  const marker = '/storage/v1/object/public/'
  const idx = url.indexOf(marker)
  if (idx < 0) return null
  const rest = url.slice(idx + marker.length)
  const slash = rest.indexOf('/')
  if (slash < 0) return null
  return { bucket: rest.slice(0, slash), path: decodeURIComponent(rest.slice(slash + 1)) }
}

type QueueItem = { id: string; user_id: string; kind: 'avatar' | 'portfolio'; media_url: string; source_id: string | null; attempts: number }

async function enforce(item: QueueItem, verdict: Verdict) {
  if (verdict.status === 'flagged') {
    const ref = storageRef(item.media_url)
    if (item.kind === 'avatar') {
      await admin.from('profiles').update({ avatar_url: '' }).eq('user_id', item.user_id)
    } else if (item.source_id) {
      await admin.from('portfolio_items').delete().eq('id', item.source_id)
    }
    if (ref) await admin.storage.from(ref.bucket).remove([ref.path])
    await admin.from('moderation_events').insert({
      user_id: item.user_id,
      source_table: item.kind === 'avatar' ? 'profiles' : 'portfolio_items',
      source_id: item.source_id,
      fields: [item.kind === 'avatar' ? 'avatar_url' : 'media_url'],
      kinds: ['image_contact'],
      snippet: [verdict.reason, ...(verdict.found || [])].filter(Boolean).join(' · ').slice(0, 200),
      action: 'removed',
    })
    await admin.rpc('apply_moderation_strike', { p_user_id: item.user_id })
  }

  const done = verdict.status === 'clean' || verdict.status === 'flagged'
  await admin.from('moderation_queue').update({
    status: verdict.status,
    result: { reason: verdict.reason ?? null, found: verdict.found ?? null, model: ANTHROPIC_KEY ? MODEL : null },
    attempts: verdict.status === 'unconfigured' ? item.attempts : item.attempts + 1,
    processed_at: done ? new Date().toISOString() : null,
  }).eq('id', item.id)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  let mode: 'sweep' | 'user'
  let userId: string | null = null

  const sweepKey = req.headers.get('x-sweep-key')
  if (sweepKey) {
    const { data } = await admin.from('moderation_settings').select('value').eq('key', 'sweep_key').single()
    if (!data || data.value !== sweepKey) return json({ error: 'forbidden' }, 403)
    mode = 'sweep'
  } else {
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
    const { data, error } = await admin.auth.getUser(token)
    if (error || !data?.user) return json({ error: 'unauthorized' }, 401)
    userId = data.user.id
    mode = 'user'
  }

  let query = admin
    .from('moderation_queue')
    .select('id, user_id, kind, media_url, source_id, attempts')
    .in('status', ['pending', 'unconfigured'])
    .lt('attempts', 5)
    .order('created_at', { ascending: true })
    .limit(mode === 'sweep' ? 20 : 3)
  if (mode === 'user') query = query.eq('user_id', userId!)

  const { data: items, error } = await query
  if (error) return json({ error: error.message }, 500)

  const results: Array<{ id: string; kind: string; status: string; reason?: string }> = []
  for (const item of (items || []) as QueueItem[]) {
    let verdict: Verdict
    try {
      verdict = await analyseImage(item.media_url)
    } catch (err) {
      verdict = { status: 'error', reason: String(err).slice(0, 200) }
    }
    await enforce(item, verdict)
    results.push({ id: item.id, kind: item.kind, status: verdict.status, reason: verdict.reason })
  }

  return json({ mode, configured: Boolean(ANTHROPIC_KEY), processed: results.length, results })
})
