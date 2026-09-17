// Poso.ba — AI trust agent.
//
// Reads everything the platform knows about an account (profile, listings,
// bids, messages, reviews, Rule #1 events, reports) and writes a trust
// assessment that only admins can see: score, risk level, signals and a
// recommended action. It never bans on its own unless the admin turns on
// moderation_settings.ai_auto_suspend — by default it flags for a human.
//
// Ways in: the 30-minute sweep (x-sweep-key) or a staff member (Authorization JWT)
// asking for one user: { "user_id": "..." }.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') || ''
const MODEL = Deno.env.get('TRUST_MODEL') || 'claude-haiku-4-5-20251001'

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sweep-key',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const SYSTEM = `You are the trust & safety analyst for Poso.ba, a Bosnian services marketplace (like Airtasker).
You receive a dossier about one account and must judge how trustworthy it is and whether it is trying to abuse the platform.

Rule #1 of the platform: no phone numbers, emails, links or social media anywhere except in messages after a bid is accepted.
Other abuse to look for: fake or copied profiles, fake reviews (review rings, self-reviews, many 5-star reviews in a short time from new accounts),
bid spam, price manipulation, scams (asking for advance payment, moving off-platform), harassment, prohibited services, identity mismatch
(name vs. bio vs. trades), and accounts created to evade a suspension.

Be fair: a new account with little activity is "low risk / low trust" — not suspicious. Do not punish people for being new.
Answer in JSON only:
{"trust_score": 0-100, "risk_level": "low"|"medium"|"high", "summary": "2-3 sentences in Bosnian for the admin",
 "signals": ["short bullet in Bosnian", ...], "recommended_action": "none"|"watch"|"review"|"suspend", "confidence": 0.0-1.0}`

type Assessment = {
  trust_score: number
  risk_level: 'low' | 'medium' | 'high'
  summary: string
  signals: string[]
  recommended_action: 'none' | 'watch' | 'review' | 'suspend'
  confidence: number
  model?: string
  assessed_at?: string
}

async function assess(dossier: unknown): Promise<Assessment | { error: string }> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 700,
      system: SYSTEM,
      messages: [{ role: 'user', content: `Dossier:\n${JSON.stringify(dossier).slice(0, 60000)}` }],
    }),
  })
  if (!res.ok) return { error: `anthropic ${res.status}: ${(await res.text()).slice(0, 200)}` }
  const data = await res.json()
  const text: string = (data.content || []).map((c: { text?: string }) => c.text || '').join('')
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return { error: 'unparseable model answer' }
  try {
    const parsed = JSON.parse(match[0])
    return {
      trust_score: Math.max(0, Math.min(100, Number(parsed.trust_score) || 0)),
      risk_level: ['low', 'medium', 'high'].includes(parsed.risk_level) ? parsed.risk_level : 'low',
      summary: String(parsed.summary || '').slice(0, 600),
      signals: Array.isArray(parsed.signals) ? parsed.signals.slice(0, 10).map((s: unknown) => String(s).slice(0, 160)) : [],
      recommended_action: ['none', 'watch', 'review', 'suspend'].includes(parsed.recommended_action) ? parsed.recommended_action : 'none',
      confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0)),
      model: MODEL,
      assessed_at: new Date().toISOString(),
    }
  } catch {
    return { error: 'unparseable model answer' }
  }
}

async function processUser(userId: string, autoSuspend: boolean) {
  const { data: dossier, error } = await admin.rpc('trust_agent_dossier', { p_user_id: userId })
  if (error || !dossier) return { user_id: userId, status: 'error', reason: error?.message || 'no dossier' }

  const result = await assess(dossier)
  if ('error' in result) return { user_id: userId, status: 'error', reason: result.error }

  await admin.from('profiles').update({ ai_assessment: result, ai_assessed_at: result.assessed_at }).eq('user_id', userId)

  if (result.recommended_action === 'review' || result.recommended_action === 'suspend') {
    await admin.from('moderation_events').insert({
      user_id: userId,
      source_table: 'profiles',
      fields: [],
      kinds: ['ai_assessment'],
      snippet: `AI: ${result.risk_level} rizik, povjerenje ${result.trust_score}/100 — ${result.summary}`.slice(0, 240),
      action: 'flagged',
    })
  }

  if (autoSuspend && result.recommended_action === 'suspend' && result.confidence >= 0.8) {
    await admin.rpc('apply_moderation_strike', { p_user_id: userId }) // no-op below 3 strikes
    await admin.from('profiles').update({
      account_status: 'suspended',
      suspended_until: new Date(Date.now() + 7 * 86400000).toISOString(),
      suspension_reason: `AI agent (auto): ${result.summary}`.slice(0, 300),
    }).eq('user_id', userId)
    await admin.from('moderation_events').insert({
      user_id: userId, source_table: 'profiles', snippet: `AI auto-suspenzija 7 dana: ${result.summary}`.slice(0, 240), action: 'suspended',
    })
  }

  return { user_id: userId, status: 'assessed', risk_level: result.risk_level, trust_score: result.trust_score, recommended_action: result.recommended_action }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const body = await req.json().catch(() => ({}))

  let mode: 'sweep' | 'admin'
  const sweepKey = req.headers.get('x-sweep-key')
  if (sweepKey) {
    const { data } = await admin.from('moderation_settings').select('value').eq('key', 'sweep_key').single()
    if (!data || data.value !== sweepKey) return json({ error: 'forbidden' }, 403)
    mode = 'sweep'
  } else {
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
    const { data, error } = await admin.auth.getUser(token)
    if (error || !data?.user) return json({ error: 'unauthorized' }, 401)
    const { data: isStaff } = await admin.rpc('is_staff_user', { p_user_id: data.user.id })
    if (isStaff !== true) return json({ error: 'forbidden' }, 403)
    mode = 'admin'
  }

  if (!ANTHROPIC_KEY) return json({ mode, configured: false, processed: 0, results: [], note: 'ANTHROPIC_API_KEY nije postavljen' })

  const { data: settings } = await admin.from('moderation_settings').select('value').eq('key', 'ai_auto_suspend').maybeSingle()
  const autoSuspend = settings?.value === 'true'

  let userIds: string[] = []
  if (mode === 'admin' && body.user_id) {
    userIds = [String(body.user_id)]
  } else {
    const { data: queue } = await admin.rpc('trust_agent_queue', { p_limit: Math.min(Number(body.limit) || 10, 25) })
    userIds = (queue || []).map((row: { user_id: string }) => row.user_id)
  }

  const results = []
  for (const userId of userIds) {
    try {
      results.push(await processUser(userId, autoSuspend))
    } catch (err) {
      results.push({ user_id: userId, status: 'error', reason: String(err).slice(0, 200) })
    }
  }
  return json({ mode, configured: true, auto_suspend: autoSuspend, processed: results.length, results })
})
