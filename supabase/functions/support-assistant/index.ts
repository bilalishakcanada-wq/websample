// Poso.ba — AI support assistant ("Poso").
//
// The signed-in user sends a message (already stored in support_messages with
// needs_human=false). The assistant answers from the help articles the client
// passes in, in Bosnian, and decides whether a person must take over. On
// hand-off it stores the reply with handoff=true and pings the staff through
// support_handoff() with a one-line summary.
//
// Needs the ANTHROPIC_API_KEY secret — without it the client falls back to its
// keyword matcher and the response says configured:false.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') || ''
const MODEL = Deno.env.get('SUPPORT_MODEL') || 'claude-haiku-4-5-20251001'

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

type Article = { id: string; audience: string; q: string; a: string }

const systemPrompt = (articles: Article[], profile: Record<string, unknown> | null) => `Ti si "Poso", digitalni asistent podrške platforme Poso.ba — bosanskog marketplacea za usluge (klijenti objavljuju poslove, izvođači/majstori šalju ponude).
Pišeš isključivo na bosanskom, jednostavno, toplo i kratko (2–5 rečenica, bez markdown naslova; smiješ koristiti crtice za korake). Obraćaš se sa "ti".

ZNANJE — odgovaraj SAMO na osnovu ovih članaka i činjenica. Ne izmišljaj funkcije, cijene ni rokove kojih ovdje nema:
${articles.map((a) => `- [${a.audience}] ${a.q}\n  ${a.a}`).join('\n')}

Činjenice o korisniku s kojim razgovaraš: ${profile ? JSON.stringify(profile) : 'nepoznato'}.

KADA PREDATI ČOVJEKU (handoff=true): korisnik traži osobu/tim/operatera; žalba na drugog korisnika, prevara, spor oko novca ili posla; suspenzija ili žalba na kaznu; brisanje/hakovan nalog; problem s plaćanjem/isplatom koji nije opisan u člancima; bilo šta gdje nisi siguran ili članci ne pokrivaju pitanje; korisnik je ljut nakon tvog odgovora. Kod predaje: kratko reci da povezuješ s timom, šta si proslijedio i šta korisnik može odmah uraditi (npr. "Pripremi privatni ID PB-…, screenshot razgovora…"), i da tim odgovara ovdje i na email, obično u roku od par sati.
NIKAD ne traži i ne daj brojeve telefona, emailove ni društvene mreže — to je Pravilo #1 platforme.

Odgovori isključivo JSON-om: {"reply": "tekst za korisnika", "handoff": true|false, "summary": "jedna rečenica za tim (na bosanskom) — problem i šta treba uraditi"}`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
  const { data: auth, error: authError } = await admin.auth.getUser(token)
  if (authError || !auth?.user) return json({ error: 'unauthorized' }, 401)
  const userId = auth.user.id

  const body = await req.json().catch(() => ({}))
  const message = String(body.message || '').slice(0, 2000).trim()
  const articles: Article[] = Array.isArray(body.articles) ? body.articles.slice(0, 60) : []
  if (!message) return json({ error: 'empty' }, 400)
  if (!ANTHROPIC_KEY) return json({ configured: false })

  const [{ data: history }, { data: profile }] = await Promise.all([
    admin.from('support_messages').select('sender, message, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(14),
    admin.from('profiles').select('full_name, account_type, city, account_status, suspension_reason, member_id, created_at').eq('user_id', userId).maybeSingle(),
  ])

  // conversation so far, oldest first, ending with the user's new message
  const turns = (history || []).reverse()
    .map((row) => ({ role: row.sender === 'user' ? 'user' : 'assistant', content: `${row.sender === 'admin' ? '[Poso.ba tim] ' : ''}${row.message}` }))
  if (turns.length === 0 || turns[turns.length - 1].role !== 'user' || turns[turns.length - 1].content !== message) turns.push({ role: 'user', content: message })
  // Anthropic needs alternating roles — merge neighbours with the same role
  const merged: Array<{ role: string; content: string }> = []
  for (const turn of turns) {
    const last = merged[merged.length - 1]
    if (last && last.role === turn.role) last.content += `\n${turn.content}`
    else merged.push({ ...turn })
  }
  if (merged[0].role !== 'user') merged.shift()

  const safeProfile = profile ? { ime: profile.full_name, tip: profile.account_type, grad: profile.city, status: profile.account_status, razlog_suspenzije: profile.suspension_reason, privatni_id: profile.member_id, clan_od: profile.created_at } : null

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: 600, system: systemPrompt(articles, safeProfile), messages: merged }),
  })
  if (!res.ok) return json({ configured: true, error: `anthropic ${res.status}` }, 502)
  const data = await res.json()
  const text: string = (data.content || []).map((c: { text?: string }) => c.text || '').join('')
  let parsed: { reply?: string; handoff?: boolean; summary?: string } = {}
  try { parsed = JSON.parse((text.match(/\{[\s\S]*\}/) || ['{}'])[0]) } catch { parsed = {} }

  const handoff = Boolean(parsed.handoff)
  const reply = String(parsed.reply || '').trim() || 'Povezujem te sa našim timom — javit će ti se ovdje i na email, obično u roku od par sati.'
  const summary = String(parsed.summary || message).slice(0, 300)

  const { data: stored } = await admin.from('support_messages')
    .insert({ user_id: userId, sender: 'assistant', message: reply, needs_human: false, handoff })
    .select('id, user_id, sender, message, created_at, handoff')
    .single()
  if (handoff) await admin.rpc('support_handoff', { p_user_id: userId, p_summary: summary })

  return json({ configured: true, handoff, message: stored })
})
