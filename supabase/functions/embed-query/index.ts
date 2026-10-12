// Zadatak — vector for a search query ("trebam nekoga da mi okreči stan").
//
// The search page calls this only when the plain search found few jobs, then passes the vector to
// search_listings(p_embedding), which adds jobs that mean the same thing in other words.
// Every query's vector is kept (public.query_embeddings), so a repeated query costs nothing.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { withCors } from '../_shared/cors.ts'
import { embed, embeddingsConfigured, toVectorText } from '../_shared/embeddings.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

// same folding as public.fold_text, plus collapsed spaces: "Krečenje  STANA" and "krecenje stana" share one vector
const queryKey = (text: string) => text.toLowerCase()
  .replace(/č|ć/g, 'c').replace(/š/g, 's').replace(/ž/g, 'z').replace(/đ/g, 'd')
  .replace(/\s+/g, ' ').trim()

Deno.serve(withCors(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405)
  const { q } = (await req.json().catch(() => ({}))) as { q?: string }
  const key = queryKey(String(q || '').slice(0, 200))
  if (key.length < 2) return json({ embedding: null })

  const { data: cached } = await admin.rpc('query_embedding_get', { p_key: key })
  if (cached) return json({ embedding: cached })
  if (!embeddingsConfigured()) return json({ embedding: null, configured: false })

  try {
    const [vector] = await embed([key])
    const text = toVectorText(vector)
    await admin.rpc('query_embedding_put', { p_key: key, p_embedding: text })
    return json({ embedding: text })
  } catch (err) {
    return json({ embedding: null, error: String((err as Error).message || err).slice(0, 200) }, 502)
  }
}))
