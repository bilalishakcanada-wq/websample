// Deploy: supabase functions deploy delete-account --no-verify-jwt
// (the function checks the user's token itself; the gateway must let the CORS preflight through)
// Requires project secrets SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, and for the code
// mail RESEND_API_KEY + RESEND_FROM (optional SITE_URL). SQL: supabase/security/13_account_closure.sql.
//
// Closing an account takes a code from the account's email and a reason (sd, 30.10.2026.):
//   { action: 'send_code', mode: 'delete' | 'deactivate' }            -> mails a 6-digit code, valid 15 minutes
//   { action: 'delete' | 'deactivate', code, reason, detail? }         -> checks the code, saves the reason, closes
//   { action: 'reactivate' }                                           -> a deactivated account comes back
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { withCors } from '../_shared/cors.ts'
import { emailSiteUrl, renderEmailLayout } from '../_shared/brandedEmail.ts'
import { configuredEmailSender } from '../_shared/emailSender.ts'

const cors = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const MODES = ['delete', 'deactivate'] as const
type Mode = typeof MODES[number]
const REASONS = ['complicated', 'no_jobs', 'no_providers', 'notifications', 'privacy', 'bad_experience', 'other_account', 'break', 'other']
const CODE_MINUTES = 15
const MAX_ATTEMPTS = 5
const RESEND_SECONDS = 60
const MAX_PER_HOUR = 5

// deno-lint-ignore no-explicit-any
type Admin = ReturnType<typeof createClient<any, 'public', 'public'>>

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}
const hashCode = (userId: string, mode: Mode, code: string) => sha256(`${userId}:${mode}:${code}`)

function newCode() {
  // 6 digits from a uniform draw (no modulo bias)
  const buffer = new Uint32Array(1)
  for (;;) {
    crypto.getRandomValues(buffer)
    if (buffer[0] < 4_294_000_000) return String(buffer[0] % 1_000_000).padStart(6, '0')
  }
}

/** Removes every file under `prefix/` in a bucket, sub-folders included (list() shows folders with id null). */
async function removeFolder(storage: Admin['storage'], bucket: string, prefix: string) {
  const files: string[] = []
  const folders = [prefix]
  while (folders.length > 0) {
    const folder = folders.pop()!
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await storage.from(bucket).list(folder, { limit: 1000, offset })
      if (error || !data?.length) break
      for (const entry of data) (entry.id ? files : folders).push(`${folder}/${entry.name}`)
      if (data.length < 1000) break
    }
  }
  for (let i = 0; i < files.length; i += 1000) await storage.from(bucket).remove(files.slice(i, i + 1000))
}

async function sendCodeMail(to: string, mode: Mode, code: string) {
  const apiKey = Deno.env.get('RESEND_API_KEY') || ''
  const from = configuredEmailSender(Deno.env.get('RESEND_FROM'))
  if (!apiKey || !from) return false
  const site = emailSiteUrl(Deno.env.get('SITE_URL') || 'https://bilalishakcanada-wq.github.io/websample')
  site.search = ''; site.hash = ''
  const what = mode === 'delete' ? 'trajno brisanje' : 'privremenu deaktivaciju'
  const mail = renderEmailLayout({
    subject: `Kod za ${what} naloga: ${code} · Zadatak.ba`,
    kicker: 'Sigurnost računa',
    heading: mode === 'delete' ? 'Kod za brisanje naloga' : 'Kod za deaktivaciju naloga',
    paragraphs: [
      `Neko je u Postavkama zatražio ${what} tvog Zadatak naloga. Upiši ovaj kod u aplikaciju da potvrdiš. Kod vrijedi ${CODE_MINUTES} minuta.`,
      'Ako to nisi bio/la ti, ne upisuj kod nigdje i promijeni lozinku. Bez koda se nalog ne može zatvoriti.',
    ],
    detail: `Kod: ${code}`,
    action: 'Otvori Postavke',
    actionUrl: `${site.href.replace(/\/$/, '')}/account/postavke`,
    footer: 'Ovu poruku ste dobili jer je zatraženo zatvaranje vašeg računa.',
  })
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], ...mail }),
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) console.error('code mail failed', res.status, (await res.text()).slice(0, 300))
    return res.ok
  } catch (err) {
    console.error('code mail failed', String(err))
    return false
  }
}

// money in escrow must be settled first: deleting would erase the payment record, and a deactivated
// account would leave the other side of the job waiting
async function openPaymentRefusal(admin: Admin, userId: string, mode: Mode) {
  const { count } = await admin.from('job_payments').select('id', { count: 'exact', head: true })
    .or(`client_id.eq.${userId},provider_id.eq.${userId}`).in('status', ['funded', 'requested', 'disputed'])
  if ((count || 0) === 0) return null
  return `Imaš posao sa osiguranom uplatom u toku. Završi ga ili otkaži, pa ${mode === 'delete' ? 'obriši' : 'deaktiviraj'} nalog.`
}

async function sendCode(admin: Admin, userId: string, email: string, mode: Mode) {
  const refusal = await openPaymentRefusal(admin, userId, mode)
  if (refusal) return json({ error: refusal }, 409)

  const now = Date.now()
  const { data: last } = await admin.from('account_closure_codes').select('sent_at, window_start, sent_in_window').eq('user_id', userId).maybeSingle()
  if (last) {
    const since = (now - new Date(last.sent_at).getTime()) / 1000
    if (since < RESEND_SECONDS) return json({ error: `Novi kod možeš tražiti za ${Math.ceil(RESEND_SECONDS - since)} s.`, wait: Math.ceil(RESEND_SECONDS - since) }, 429)
  }
  const sameHour = last && now - new Date(last.window_start).getTime() < 3600_000
  if (sameHour && last.sent_in_window >= MAX_PER_HOUR) return json({ error: 'Poslali smo previše kodova. Pokušaj ponovo za sat vremena.' }, 429)

  const code = newCode()
  const stamp = new Date(now).toISOString()
  const { error: saveError } = await admin.from('account_closure_codes').upsert({
    user_id: userId, purpose: mode, code_hash: await hashCode(userId, mode, code),
    expires_at: new Date(now + CODE_MINUTES * 60_000).toISOString(), attempts: 0, sent_at: stamp,
    window_start: sameHour ? last.window_start : stamp, sent_in_window: sameHour ? last.sent_in_window + 1 : 1,
  })
  if (saveError) {
    console.error('code save failed', saveError.message)
    return json({ error: 'Kod nije poslan. Pokušaj ponovo.' }, 500)
  }
  if (!(await sendCodeMail(email, mode, code))) {
    await admin.from('account_closure_codes').update({ expires_at: stamp }).eq('user_id', userId)
    return json({ error: 'Mail s kodom trenutno ne možemo poslati. Pokušaj kasnije ili piši na info@zadatak.ba.' }, 503)
  }
  return json({ sent: true, minutes: CODE_MINUTES, wait: RESEND_SECONDS })
}

/** null when the code is right (and then used up), otherwise the refusal to send back. */
async function checkCode(admin: Admin, userId: string, mode: Mode, code: string) {
  const { data: row } = await admin.from('account_closure_codes').select('purpose, code_hash, expires_at, attempts').eq('user_id', userId).maybeSingle()
  if (!row || row.purpose !== mode || new Date(row.expires_at).getTime() <= Date.now()) {
    return json({ error: 'Kod je istekao ili nije zatražen. Pošalji novi kod.', expired: true }, 400)
  }
  if (row.attempts >= MAX_ATTEMPTS) return json({ error: 'Previše pogrešnih pokušaja. Pošalji novi kod.', expired: true }, 400)
  if (!/^\d{6}$/.test(code) || (await hashCode(userId, mode, code)) !== row.code_hash) {
    const attempts = row.attempts + 1
    await admin.from('account_closure_codes').update({ attempts }).eq('user_id', userId)
    const left = MAX_ATTEMPTS - attempts
    return json({ error: left > 0 ? `Kod nije tačan. Još ${left} ${left === 1 ? 'pokušaj' : 'pokušaja'}.` : 'Previše pogrešnih pokušaja. Pošalji novi kod.', expired: left <= 0 }, 400)
  }
  // one use only
  await admin.from('account_closure_codes').update({ expires_at: new Date().toISOString(), attempts: MAX_ATTEMPTS }).eq('user_id', userId)
  return null
}

async function deleteEverything(admin: Admin, userId: string) {
  // everything they uploaded sits under their own folder: profile photo, portfolio, job photos,
  // ID documents and licences, chat photos, proof of work. The rows go with the account; the files
  // would otherwise stay in storage for good.
  for (const bucket of ['avatars', 'media', 'identity', 'uploads']) {
    try { await removeFolder(admin.storage, bucket, userId) } catch (err) { console.error('file cleanup failed', bucket, String(err)) }
  }

  // photos of their jobs (the rows cascade with the profile); older uploads may sit outside their folder
  const { data: jobs } = await admin.from('listings').select('id').eq('user_id', userId)
  const jobIds = (jobs || []).map((job) => job.id)
  if (jobIds.length > 0) {
    const { data: images } = await admin.from('listing_images').select('path').in('listing_id', jobIds)
    const paths = (images || []).map((image) => image.path).filter(Boolean)
    if (paths.length > 0) await admin.storage.from('media').remove(paths)
  }
  // things that should not linger after the person is gone (the rest cascades from auth.users)
  await admin.from('push_subscriptions').delete().eq('user_id', userId)
  await admin.from('task_alerts').delete().eq('user_id', userId)
  await admin.from('notifications').delete().eq('user_id', userId)
  await admin.from('profiles').delete().eq('user_id', userId)

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId)
  if (deleteError) {
    console.error('deleteUser failed', deleteError.message)
    return json({ error: 'Brisanje naloga nije uspjelo. Pokušaj ponovo.' }, 400)
  }
  return json({ success: true })
}

async function deactivate(admin: Admin, userId: string) {
  // gone from search: published jobs pause (the owner publishes them again after coming back),
  // offers still waiting are withdrawn so nobody accepts an offer from an account that is away
  await admin.from('listings').update({ status: 'paused' }).eq('user_id', userId).eq('status', 'published')
  await admin.from('bids').update({ status: 'withdrawn' }).eq('bidder_id', userId).eq('status', 'pending')
  const { error } = await admin.from('profiles').update({ account_status: 'disabled', deactivated_at: new Date().toISOString() })
    .eq('user_id', userId).eq('account_status', 'active')
  if (error) {
    console.error('deactivate failed', error.message)
    return json({ error: 'Deaktivacija nije uspjela. Pokušaj ponovo.' }, 400)
  }
  await admin.from('push_subscriptions').delete().eq('user_id', userId)
  return json({ success: true })
}

Deno.serve(withCors(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const authHeader = req.headers.get('Authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  if (!token) return json({ error: 'Niste prijavljeni.' }, 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } })
  const { data: userData, error: userError } = await userClient.auth.getUser()
  if (userError || !userData.user) return json({ error: 'Sesija nije važeća.' }, 401)
  const userId = userData.user.id
  const email = userData.user.email || ''

  const body = await req.json().catch(() => ({})) as { action?: string; mode?: string; code?: string; reason?: string; detail?: string }
  const admin = createClient(supabaseUrl, serviceRoleKey)

  const { data: profile } = await admin.from('profiles').select('account_status').eq('user_id', userId).maybeSingle()
  const status = profile?.account_status || 'active'

  if (body.action === 'reactivate') {
    if (status !== 'disabled') return json({ success: true })
    const { error } = await admin.from('profiles').update({ account_status: 'active', deactivated_at: null }).eq('user_id', userId).eq('account_status', 'disabled')
    if (error) {
      console.error('reactivate failed', error.message)
      return json({ error: 'Aktivacija nije uspjela. Pokušaj ponovo.' }, 400)
    }
    return json({ success: true })
  }

  // older app versions call without an action: closing now always needs the email code
  if (!['send_code', 'delete', 'deactivate'].includes(body.action || '')) {
    return json({ error: 'Za zatvaranje naloga treba kod s emaila. Osvježi stranicu ili ažuriraj aplikaciju, pa pokušaj ponovo.' }, 400)
  }
  if (!email) return json({ error: 'Nalog nema email adresu. Piši na info@zadatak.ba.' }, 400)

  const mode = (body.action === 'send_code' ? body.mode : body.action) as Mode
  if (!MODES.includes(mode)) return json({ error: 'Izaberi deaktivaciju ili brisanje.' }, 400)
  if (mode === 'deactivate' && status !== 'active') return json({ error: 'Nalog već nije aktivan.' }, 409)

  if (body.action === 'send_code') return sendCode(admin, userId, email, mode)

  const reason = String(body.reason || '')
  const detail = String(body.detail || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 500)
  if (!REASONS.includes(reason)) return json({ error: 'Izaberi razlog.' }, 400)
  if (reason === 'other' && detail.length < 3) return json({ error: 'Napiši ukratko razlog.' }, 400)

  const refusal = await openPaymentRefusal(admin, userId, mode)
  if (refusal) return json({ error: refusal }, 409)

  const wrong = await checkCode(admin, userId, mode, String(body.code || '').replace(/\D/g, ''))
  if (wrong) return wrong

  // the reason stays after deletion, without the person (user_id goes null with the account)
  const { error: reasonError } = await admin.from('account_closure_reasons').insert({ user_id: userId, mode, reason, detail: detail || null })
  if (reasonError) console.error('reason save failed', reasonError.message)

  return mode === 'delete' ? deleteEverything(admin, userId) : deactivate(admin, userId)
}))
