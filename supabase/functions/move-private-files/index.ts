// One-off, safe to run again: moves files that belong in the private "uploads" bucket out of the
// public "media" bucket. Until supabase/security/06 and the site's switch (6. 10. 2026.) badge
// documents (licences, ID card for the badge), chat photos and proof of work went to "media", where
// anyone with the link can open them. Each file is copied to "uploads" under the path the site uses
// today, its database reference is pointed at the private copy, and only then is the public copy
// removed. A failed step leaves that file where it was, so the run can simply be repeated.
//
// Chat messages can't be edited (they are evidence in disputes), so a chat photo keeps its old
// link; the site opens it from "uploads" under the same path (src/lib/privateFiles.js).
//
// Deploy: supabase functions deploy move-private-files --no-verify-jwt
// Run from SQL (the key stays in the database), then read the answer:
//   select net.http_post(
//     url := 'https://<project>.supabase.co/functions/v1/move-private-files',
//     headers := jsonb_build_object('Content-Type', 'application/json',
//       'x-sweep-key', (select value from public.moderation_settings where key = 'sweep_key')),
//     body := '{}'::jsonb, timeout_milliseconds := 120000);
//   select status_code, content from net._http_response order by created desc limit 1;
// Body {"dryRun": true} only lists what would move.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
})

const PUBLIC_MEDIA = '/storage/v1/object/public/media/'
const PRIVATE = 'private:uploads/'
const OLD = `%${PUBLIC_MEDIA}%`

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

/** The path inside "media" for an old public link, or null for anything else. */
function mediaPath(url: unknown): string | null {
  if (typeof url !== 'string') return null
  const at = url.indexOf(PUBLIC_MEDIA)
  return at === -1 ? null : decodeURIComponent(url.slice(at + PUBLIC_MEDIA.length).split(/[?#]/)[0])
}

/** A database reference to old public files: which files it points at and how to repoint it. */
type Ref = { what: string; files: Map<string, string>; update: ((to: Map<string, string>) => PromiseLike<unknown>) | null }

async function listingOf(paymentId: string): Promise<string | null> {
  const { data } = await admin.from('job_payments').select('listing_id').eq('id', paymentId).maybeSingle()
  return data?.listing_id ?? null
}

/** <user>/work/<file> → <user>/work/<listing>/<file>: the read rule for the client and the provider needs the job. */
const workPath = (path: string, listing: string) => {
  const [user, , ...rest] = path.split('/')
  return rest.length > 1 ? path : `${user}/work/${listing}/${rest[0]}`
}

async function collect(): Promise<Ref[]> {
  const refs: Ref[] = []
  const fail = (what: string, error: { message: string } | null) => { if (error) throw new Error(`${what}: ${error.message}`) }

  // badge documents: <user>/<kind>-<type>-<time>.<ext>, the same path in "uploads"
  const { data: docs, error: docsError } = await admin.from('verification_requests').select('id, document_url').like('document_url', OLD)
  fail('verification_requests', docsError)
  for (const row of docs || []) {
    const from = mediaPath(row.document_url)
    if (!from) continue
    refs.push({
      what: `verification_requests ${row.id}`,
      files: new Map([[from, from]]),
      update: (to) => admin.from('verification_requests').update({ document_url: PRIVATE + to.get(from) }).eq('id', row.id).throwOnError(),
    })
  }

  // photo proof: <user>/proof/<payment>/<kind>-<time>.jpg → <user>/work/<listing>/proof-<kind>-<time>.jpg
  const { data: proofs, error: proofsError } = await admin.from('work_proofs').select('id, payment_id, photo_url').like('photo_url', OLD)
  fail('work_proofs', proofsError)
  for (const row of proofs || []) {
    const from = mediaPath(row.photo_url)
    const listing = from && await listingOf(row.payment_id)
    if (!from || !listing) continue
    const [user, , , name] = from.split('/')
    const to = name ? `${user}/work/${listing}/proof-${name}` : workPath(from, listing)
    refs.push({
      what: `work_proofs ${row.id}`,
      files: new Map([[from, to]]),
      update: (moved) => admin.from('work_proofs').update({ photo_url: PRIVATE + moved.get(from) }).eq('id', row.id).throwOnError(),
    })
  }

  // photos sent with submitted work: <user>/work/<file> → <user>/work/<listing>/<file>
  const { data: submissions, error: submissionsError } = await admin.from('work_submissions').select('id, payment_id, evidence_urls')
  fail('work_submissions', submissionsError)
  for (const row of submissions || []) {
    const urls: string[] = row.evidence_urls || []
    const old = urls.map(mediaPath).filter((path): path is string => Boolean(path))
    if (old.length === 0) continue
    const listing = await listingOf(row.payment_id)
    if (!listing) continue
    refs.push({
      what: `work_submissions ${row.id}`,
      files: new Map(old.map((from) => [from, workPath(from, listing)])),
      update: (moved) => admin.from('work_submissions').update({
        evidence_urls: urls.map((url) => { const from = mediaPath(url); return from ? PRIVATE + moved.get(from) : url }),
      }).eq('id', row.id).throwOnError(),
    })
  }

  // chat photos: <user>/chat/<conversation>/<file>, the same path; the message itself stays as it is
  const { data: messages, error: messagesError } = await admin.from('messages').select('id, attachment_url').eq('attachment_type', 'image').like('attachment_url', OLD)
  fail('messages', messagesError)
  for (const row of messages || []) {
    const from = mediaPath(row.attachment_url)
    if (from && from.split('/')[1] === 'chat') refs.push({ what: `messages ${row.id}`, files: new Map([[from, from]]), update: null })
  }

  return refs
}

/** Copies one file from "media" to "uploads"; 'done' when an earlier run already moved it. */
async function copy(from: string, to: string): Promise<'copied' | 'done'> {
  const { data: blob, error } = await admin.storage.from('media').download(from)
  if (error || !blob) {
    const folder = to.split('/').slice(0, -1).join('/')
    const name = to.split('/').pop()
    const { data: there } = await admin.storage.from('uploads').list(folder, { search: name })
    if (there?.some((entry) => entry.name === name)) return 'done'
    throw new Error(`download ${from}: ${error?.message || 'empty'}`)
  }
  const { error: uploadError } = await admin.storage.from('uploads').upload(to, blob, { contentType: blob.type || 'image/jpeg', cacheControl: '31536000' })
  if (uploadError && !/exists|duplicate/i.test(uploadError.message)) throw new Error(`upload ${to}: ${uploadError.message}`)
  return 'copied'
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const key = req.headers.get('x-sweep-key')
  const { data: setting } = await admin.from('moderation_settings').select('value').eq('key', 'sweep_key').maybeSingle()
  if (!key || !setting || setting.value !== key) return json({ error: 'forbidden' }, 403)
  const { dryRun = false } = await req.json().catch(() => ({}))

  let refs: Ref[]
  try { refs = await collect() } catch (err) { return json({ error: String(err) }, 500) }
  const files = new Map<string, string>() // from -> to
  for (const ref of refs) for (const [from, to] of ref.files) files.set(from, to)
  if (dryRun) return json({ dryRun: true, files: [...files].map(([from, to]) => ({ from, to })), refs: refs.map((ref) => ref.what) })

  const copied = new Set<string>() // in "uploads" now, whether by this run or an earlier one
  const done = new Set<string>() // the public copy is already gone
  const report: Array<{ step: string; ok: boolean; error?: string }> = []
  for (const [from, to] of files) {
    try {
      if ((await copy(from, to)) === 'done') done.add(from)
      else report.push({ step: `copy ${from} -> ${to}`, ok: true })
      copied.add(from)
    } catch (err) { report.push({ step: `copy ${from}`, ok: false, error: String(err) }) }
  }

  // a public copy goes only once every reference to it points at the private one
  const keep = new Set<string>([...files.keys()].filter((from) => !copied.has(from)))
  for (const ref of refs) {
    if ([...ref.files.keys()].some((from) => !copied.has(from))) { for (const from of ref.files.keys()) keep.add(from); continue }
    if (!ref.update) continue
    try { await ref.update(ref.files); report.push({ step: `update ${ref.what}`, ok: true }) } catch (err) {
      for (const from of ref.files.keys()) keep.add(from)
      report.push({ step: `update ${ref.what}`, ok: false, error: String(err) })
    }
  }
  const remove = [...copied].filter((from) => !keep.has(from) && !done.has(from))
  let moved = 0
  if (remove.length > 0) {
    const { error } = await admin.storage.from('media').remove(remove)
    report.push({ step: `remove ${remove.length} public copies`, ok: !error, error: error?.message })
    if (!error) moved = remove.length
  }

  const ok = report.every((line) => line.ok)
  return json({ ok, moved, kept: [...keep], report }, ok ? 200 : 500)
})
