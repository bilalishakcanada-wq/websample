// Text → vector of 512 numbers (OpenAI text-embedding-3-small, shortened to 512 dimensions).
// Used by `embed` (jobs and providers, in batches) and `embed-query` (one search query).
// Without OPENAI_API_KEY nothing is sent anywhere and callers get null.

const OPENAI_KEY = Deno.env.get('OPENAI_API_KEY') || ''
const MODEL = Deno.env.get('EMBEDDING_MODEL') || 'text-embedding-3-small'
export const DIMENSIONS = 512

export const embeddingsConfigured = () => Boolean(OPENAI_KEY)

/** Vectors for the given texts, in the same order. Throws on an API error. */
export async function embed(texts: string[]): Promise<number[][]> {
  if (!OPENAI_KEY) throw new Error('OPENAI_API_KEY missing')
  if (!texts.length) return []
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, input: texts.map((text) => text.slice(0, 8000) || ' '), dimensions: DIMENSIONS }),
  })
  if (!res.ok) throw new Error(`openai ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const body = await res.json() as { data: { index: number; embedding: number[] }[] }
  const out: number[][] = new Array(texts.length)
  for (const row of body.data) out[row.index] = row.embedding
  return out
}

/** pgvector text form: "[0.1,0.2,…]" (same as JSON). */
export const toVectorText = (vector: number[]) => `[${vector.map((value) => Number(value.toFixed(6))).join(',')}]`
