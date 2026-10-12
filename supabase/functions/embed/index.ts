// Zadatak — vectors for jobs and providers.
//
// Called every minute by pg_cron (public.embedding_kick, x-sweep-key) while public.embedding_queue has
// work. Takes a batch, turns each text (title + category + description, or trades + specialties + bio)
// into a vector and stores it in listing_embeddings / profile_embeddings. Search, provider matching and
// job recommendations use them (supabase/algorithms/02–04).
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { embed, embeddingsConfigured, toVectorText } from '../_shared/embeddings.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405)
  const sweepKey = req.headers.get('x-sweep-key')
  const { data: setting } = await admin.from('moderation_settings').select('value').eq('key', 'sweep_key').single()
  if (!sweepKey || !setting || setting.value !== sweepKey) return json({ error: 'forbidden' }, 403)
  if (!embeddingsConfigured()) return json({ configured: false })

  const { batch } = (await req.json().catch(() => ({}))) as { batch?: number }
  const { data: jobs, error } = await admin.rpc('embedding_jobs_take', { p_limit: Math.min(Math.max(batch || 64, 1), 128) })
  if (error) return json({ error: error.message }, 500)
  const rows = (jobs || []) as { kind: string; ref: string; content: string | null }[]
  if (!rows.length) return json({ done: 0 })

  // gone or empty (deleted job, provider without any text): drop from the queue without a vector
  const empty = rows.filter((row) => !row.content?.trim())
  const work = rows.filter((row) => row.content?.trim())
  await Promise.all(empty.map((row) => admin.rpc('embedding_save', { p_kind: row.kind, p_ref: row.ref, p_embedding: null })))

  let vectors: number[][] = []
  try {
    vectors = await embed(work.map((row) => row.content!.trim()))
  } catch (err) {
    // the rows stay queued (attempts went up), the next minute tries again, at most 5 times
    return json({ error: String((err as Error).message || err).slice(0, 300) }, 502)
  }
  const saved = await Promise.all(work.map((row, index) =>
    admin.rpc('embedding_save', { p_kind: row.kind, p_ref: row.ref, p_embedding: toVectorText(vectors[index]) })
      .then(({ error: saveError }) => (saveError ? saveError.message : 'ok'))))
  return json({ done: saved.filter((result) => result === 'ok').length, skipped: empty.length, errors: saved.filter((result) => result !== 'ok') })
})
