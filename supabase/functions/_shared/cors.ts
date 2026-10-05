// CORS for the Edge Functions the website and the app call from the browser.
//
// Only Zadatak's own pages may call them from a browser: the live site, the
// Android/iOS app shell and local development. Any other site gets 403 before the function runs.
// Calls without an Origin header (cron jobs, database webhooks, Monri's server) are not browser
// calls and pass through unchanged; they are protected by their keys and JWT checks, as before.
//
// Extra origins (a new domain after a rename, a preview host) go in the ALLOWED_ORIGINS secret,
// comma-separated, e.g. "https://zadatak.ba,https://www.zadatak.ba". No redeploy of the code needed.

const DEFAULT_ORIGINS = [
  'https://bilalishakcanada-wq.github.io', // live site (GitHub Pages) and the Android app, which loads it
  'capacitor://localhost', // iOS app shell
  'https://localhost', // Android app shell
  'http://localhost:5173', // npm run dev
  'http://localhost:4173', // npm run preview
]

const allowed = new Set(
  [...DEFAULT_ORIGINS, ...(Deno.env.get('ALLOWED_ORIGINS') || '').split(',')]
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean),
)

export const isAllowedOrigin = (origin: string | null) => origin === null || allowed.has(origin)

const baseHeaders = (origin: string, allowHeaders: string) => ({
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Headers': allowHeaders,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '600',
  Vary: 'Origin',
})

/**
 * Wraps a Deno.serve handler: answers the preflight, refuses other sites, and adds the
 * Access-Control-Allow-Origin header (the caller's own origin, never "*") to every response.
 */
export function withCors(
  handler: (req: Request) => Response | Promise<Response>,
  allowHeaders = 'authorization, x-client-info, apikey, content-type',
) {
  return async (req: Request): Promise<Response> => {
    const origin = req.headers.get('Origin')
    if (!isAllowedOrigin(origin)) {
      return new Response(JSON.stringify({ error: 'origin_not_allowed' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', Vary: 'Origin' },
      })
    }
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: origin ? baseHeaders(origin, allowHeaders) : {} })
    }
    const res = await handler(req)
    if (!origin) return res
    const headers = new Headers(res.headers)
    for (const [key, value] of Object.entries(baseHeaders(origin, allowHeaders))) headers.set(key, value)
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers })
  }
}
