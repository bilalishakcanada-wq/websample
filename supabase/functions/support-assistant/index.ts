// Zadatak. AI support assistant ("Zadatak asistent").
//
// The signed-in user sends a message (already stored in support_messages with
// needs_human=false). The assistant answers from the help articles the client
// passes in, in Bosnian, and decides whether a person must take over. On
// hand-off it stores the reply with handoff=true and pings the staff through
// support_handoff() with a one-line summary.
//
// Only the current conversation is sent as history (the client passes `since`, and a
// 25-minute gap also starts a new one), together with the user's own jobs, offers,
// payments and balance so it can answer "where is my money / my job" questions.
// The reply carries up to 4 follow-up suggestions the chat shows as buttons.
//
// Needs the ANTHROPIC_API_KEY secret, without it the client falls back to its own
// local assistant (src/utils/supportBrain.js) and the response says configured:false.
// SUPPORT_MODEL overrides the model.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { withCors } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') || ''
const MODEL = Deno.env.get('SUPPORT_MODEL') || 'claude-haiku-5-5'
const IDLE_MS = 25 * 60 * 1000

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

const CORS = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

type Article = { id: string; audience: string; q: string; a: string }
type GuideEntry = { path: string; title: string; where: string }

const systemPrompt = (articles: Article[], guide: GuideEntry[], profile: Record<string, unknown> | null, account: Record<string, unknown>) => `Ti si "Zadatak asistent", digitalni asistent podrške platforme Zadatak, bosanskog marketplacea za usluge (klijenti objavljuju poslove, izvođači/majstori šalju ponude).
Pišeš isključivo na bosanskom, jednostavno, toplo i kratko (2–5 rečenica, bez markdown naslova; smiješ koristiti crtice za korake). Obraćaš se sa "ti".

ZNANJE: odgovaraj SAMO na osnovu ovih članaka i činjenica. Ne izmišljaj funkcije, cijene ni rokove kojih ovdje nema:
${articles.map((a) => `- [${a.audience}] ${a.q}\n  ${a.a}`).join('\n')}

GDJE JE ŠTA NA SAJTU I U APLIKACIJI: kad korisnik pita gdje ili kako nešto uradi, reci tačno gdje to nađe (meni i naziv) i dodaj putanju u zagradi, npr. (/account/novcanik). Pomozi sa svakom opcijom s ove liste:
${guide.map((g) => `- ${g.title} (${g.path}): ${g.where}`).join('\n')}

Činjenice o korisniku s kojim razgovaraš: ${profile ? JSON.stringify(profile) : 'nepoznato'}.
Njegovi podaci na Zadatku (samo njegovi, koristi ih kad pita za svoj balans, poslove, ponude ili plaćanja; iznose piši u KM; link na posao je /listings/<id>): ${JSON.stringify(account)}.

KAKO RAZGOVARAŠ:
- Pozdrav, zahvala, smijeh ili kratka poruka bez pitanja: odgovori ljubazno u jednoj rečenici i ponudi teme, to NIJE razlog za predaju.
- Ako korisnik kaže da ne razumije ili da mu nije pomoglo: objasni jednostavnije, korak po korak, i pitaj jedno konkretno potpitanje.
- Ako pitanje nije jasno: postavi jedno kratko potpitanje umjesto nagađanja.
- Uvijek predloži 2–4 kratka sljedeća pitanja (do 45 znakova) koja korisnik vjerovatno želi postaviti; kad je problem ozbiljan ili nisi siguran, jedan prijedlog neka bude "Razgovaraj sa pravim pomoćnikom".

KADA PREDATI ČOVJEKU (handoff=true): korisnik traži osobu/tim/operatera/pravog pomoćnika; žalba na drugog korisnika, prevara, spor oko novca ili posla; suspenzija ili žalba na kaznu; brisanje/hakovan nalog; problem s plaćanjem/isplatom koji nije opisan u člancima; pitanje koje članci ne pokrivaju ni nakon jednog potpitanja; korisnik je ljut nakon tvog odgovora. Kod predaje: kratko reci da povezuješ s timom, šta si proslijedio i šta korisnik može odmah uraditi (npr. "Pripremi privatni ID PB-…, screenshot razgovora…"), i da tim odgovara ovdje i na email.
NIKAD ne traži i ne daj brojeve telefona, emailove ni društvene mreže, to je Pravilo #1 platforme.
Piši običnim rečenicama: bez dugih crta (—) i bez emojija.

Odgovori isključivo JSON-om: {"reply": "tekst za korisnika", "handoff": true|false, "summary": "jedna rečenica za tim (na bosanskom), problem i šta treba uraditi", "suggestions": ["kratko pitanje", "..."]}`

Deno.serve(withCors(async (req) => {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
  const { data: auth, error: authError } = await admin.auth.getUser(token)
  if (authError || !auth?.user) return json({ error: 'unauthorized' }, 401)
  const userId = auth.user.id

  const body = await req.json().catch(() => ({}))
  const message = String(body.message || '').slice(0, 2000).trim()
  const articles: Article[] = Array.isArray(body.articles) ? body.articles.slice(0, 60) : []
  const guide: GuideEntry[] = Array.isArray(body.guide) ? body.guide.slice(0, 60).map((g: GuideEntry) => ({ path: String(g.path || '').slice(0, 80), title: String(g.title || '').slice(0, 80), where: String(g.where || '').slice(0, 300) })) : []
  const since = typeof body.since === 'string' && !Number.isNaN(Date.parse(body.since)) ? new Date(body.since).toISOString() : null
  if (!message) return json({ error: 'empty' }, 400)
  if (!ANTHROPIC_KEY) return json({ configured: false })

  let historyQuery = admin.from('support_messages').select('sender, message, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(20)
  if (since) historyQuery = historyQuery.gte('created_at', since)
  const [{ data: history }, { data: profile }, { data: listings }, { data: bids }, { data: payments }, { data: lastTx }] = await Promise.all([
    historyQuery,
    admin.from('profiles').select('full_name, account_type, city, account_status, suspension_reason, member_id, created_at, balance').eq('user_id', userId).maybeSingle(),
    admin.from('listings').select('id, title, status, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(8),
    admin.from('bids').select('amount, status, created_at, listing:listings(id, title)').eq('bidder_id', userId).order('created_at', { ascending: false }).limit(8),
    admin.from('job_payments').select('amount, net_amount, status, created_at, client_id, listing:listings(id, title)').or(`client_id.eq.${userId},provider_id.eq.${userId}`).order('created_at', { ascending: false }).limit(6),
    admin.from('wallet_transactions').select('amount, kind, note, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(3),
  ])

  // this conversation only: oldest first, cut at the last 25-minute gap
  const ordered = (history || []).reverse().filter((row) => !String(row.message).startsWith('(predaja timu)'))
  let first = 0
  for (let i = 1; i < ordered.length; i++) if (Date.parse(ordered[i].created_at) - Date.parse(ordered[i - 1].created_at) > IDLE_MS) first = i
  const turns = ordered.slice(first)
    .map((row) => ({ role: row.sender === 'user' ? 'user' : 'assistant', content: `${row.sender === 'admin' ? '[Zadatak tim] ' : ''}${row.message}` }))
  if (turns.length === 0 || turns[turns.length - 1].role !== 'user' || turns[turns.length - 1].content !== message) turns.push({ role: 'user', content: message })
  // Anthropic needs alternating roles, merge neighbours with the same role
  const merged: Array<{ role: string; content: string }> = []
  for (const turn of turns) {
    const last = merged[merged.length - 1]
    if (last && last.role === turn.role) last.content += `\n${turn.content}`
    else merged.push({ ...turn })
  }
  while (merged.length && merged[0].role !== 'user') merged.shift()
  if (!merged.length) merged.push({ role: 'user', content: message })

  const safeProfile = profile ? { ime: profile.full_name, tip: profile.account_type, grad: profile.city, status: profile.account_status, razlog_suspenzije: profile.suspension_reason, privatni_id: profile.member_id, clan_od: profile.created_at } : null
  const account = {
    balans_km: profile?.balance ?? null,
    zadnje_promjene_balansa: lastTx || [],
    moji_oglasi: listings || [],
    moje_ponude: (bids || []).map((bid) => ({ iznos: bid.amount, status: bid.status, posao: bid.listing })),
    placanja: (payments || []).map((pay) => ({ iznos: pay.amount, neto_izvodjacu: pay.net_amount, status: pay.status, uloga: pay.client_id === userId ? 'klijent' : 'izvođač', posao: pay.listing })),
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: 600, system: systemPrompt(articles, guide, safeProfile, account), messages: merged }),
  })
  if (!res.ok) return json({ configured: true, error: `anthropic ${res.status}: ${(await res.text()).slice(0, 300)}` }, 502)
  const data = await res.json()
  const text: string = (data.content || []).map((c: { text?: string }) => c.text || '').join('')
  let parsed: { reply?: string; handoff?: boolean; summary?: string; suggestions?: unknown } = {}
  try { parsed = JSON.parse((text.match(/\{[\s\S]*\}/) || ['{}'])[0]) } catch { parsed = {} }

  const handoff = Boolean(parsed.handoff)
  const reply = String(parsed.reply || '').replace(/\s*—\s*/g, ', ').trim() || 'Povezujem te sa našim timom, javit će ti se ovdje i na email.'
  const summary = String(parsed.summary || message).slice(0, 300)
  const suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions.map((item) => String(item).trim().slice(0, 60)).filter(Boolean).slice(0, 4) : []

  const { data: stored } = await admin.from('support_messages')
    .insert({ user_id: userId, sender: 'assistant', message: reply, needs_human: false, handoff })
    .select('id, user_id, sender, message, created_at, handoff')
    .single()
  if (handoff) await admin.rpc('support_handoff', { p_user_id: userId, p_summary: summary })

  return json({ configured: true, handoff, message: stored, suggestions })
}))
