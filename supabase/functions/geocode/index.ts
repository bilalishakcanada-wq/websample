// Zadatak, street address ⇄ point on the map, inside BiH.
//
//   POST { q: "Ilirska 67", near?: { lat, lng } }  → { results: [{ label, street, place, lat, lng }] }
//   POST { lat, lng }                              → { results: [one address for that point] }
//
// Uses OpenStreetMap Nominatim (free; its rules: at most one request per second, a real User-Agent and
// keeping answers). Every answer is kept in public.geocode_cache, so the same address is asked once.
// NOMINATIM_URL can point at a paid Nominatim-compatible service (LocationIQ, own server) without code changes.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { withCors } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const NOMINATIM = (Deno.env.get('NOMINATIM_URL') || 'https://nominatim.openstreetmap.org').replace(/\/$/, '')
const NOMINATIM_KEY = Deno.env.get('NOMINATIM_KEY') || ''   // LocationIQ and similar want ?key=
const USER_AGENT = 'Zadatak/1.0 (https://bilalishakcanada-wq.github.io/websample/)'
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const inBih = (lat: number, lng: number) => lat >= 42.4 && lat <= 45.4 && lng >= 15.6 && lng <= 19.8
const fold = (text: string) => text.toLowerCase()
  .replace(/č|ć/g, 'c').replace(/š/g, 's').replace(/ž/g, 'z').replace(/đ/g, 'd').replace(/\s+/g, ' ').trim()

type Place = { label: string; street: string | null; place: string | null; lat: number; lng: number }
type NominatimRow = { lat: string; lon: string; display_name?: string; address?: Record<string, string> }

const shape = (row: NominatimRow): Place | null => {
  const lat = Number(row.lat)
  const lng = Number(row.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !inBih(lat, lng)) return null
  const a = row.address || {}
  const road = a.road || a.pedestrian || a.footway || a.square || a.hamlet || null
  const street = road ? [road, a.house_number].filter(Boolean).join(' ') : null
  const quarter = a.suburb || a.neighbourhood || a.quarter || a.village || null
  const town = a.city || a.town || a.municipality || a.village || a.county || null
  const place = [quarter && quarter !== town ? quarter : null, town].filter(Boolean).join(', ') || null
  const label = [street, place].filter(Boolean).join(', ') || (row.display_name || '').split(',').slice(0, 3).join(',').trim()
  return { label, street, place, lat, lng }
}

// one request per second from this instance (Nominatim's limit)
let last = 0
async function ask(path: string, params: Record<string, string>) {
  const wait = last + 1000 - Date.now()
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
  last = Date.now()
  const query = new URLSearchParams({ format: 'jsonv2', addressdetails: '1', 'accept-language': 'bs,hr,sr', ...params })
  if (NOMINATIM_KEY) query.set('key', NOMINATIM_KEY)
  const res = await fetch(`${NOMINATIM}/${path}?${query}`, { headers: { 'User-Agent': USER_AGENT, Referer: 'https://bilalishakcanada-wq.github.io/websample/' } })
  if (!res.ok) throw new Error(`geocoder ${res.status}`)
  return res.json()
}

async function cached(key: string, load: () => Promise<Place[]>) {
  const { data } = await admin.from('geocode_cache').select('result').eq('query_key', key).maybeSingle()
  if (data?.result) return data.result as Place[]
  const results = await load()
  await admin.from('geocode_cache').upsert({ query_key: key, result: results })
  return results
}

Deno.serve(withCors(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405)
  const body = (await req.json().catch(() => ({}))) as { q?: string; near?: { lat?: number; lng?: number }; lat?: number; lng?: number }

  try {
    // point → address
    if (typeof body.lat === 'number' && typeof body.lng === 'number') {
      if (!inBih(body.lat, body.lng)) return json({ results: [], outside: true })
      const key = `r:${body.lat.toFixed(4)},${body.lng.toFixed(4)}`
      const results = await cached(key, async () => {
        const row = await ask('reverse', { lat: String(body.lat), lon: String(body.lng), zoom: '18' }) as NominatimRow
        const place = row && shape(row)
        return place ? [place] : []
      })
      return json({ results })
    }

    // address → points
    const q = String(body.q || '').replace(/\s+/g, ' ').trim().slice(0, 120)
    if (q.length < 3) return json({ results: [] })
    const near = body.near && Number.isFinite(body.near.lat) && Number.isFinite(body.near.lng) && inBih(body.near.lat!, body.near.lng!) ? body.near : null
    const key = `f:${fold(q)}${near ? `@${near.lat!.toFixed(2)},${near.lng!.toFixed(2)}` : ''}`
    const results = await cached(key, async () => {
      const params: Record<string, string> = { q, countrycodes: 'ba', limit: '6' }
      if (near) {
        // prefer the chosen town (about 25 km around it) without excluding the rest of BiH
        params.viewbox = [near.lng! - 0.3, near.lat! + 0.22, near.lng! + 0.3, near.lat! - 0.22].join(',')
      }
      const rows = await ask('search', params) as NominatimRow[]
      const seen = new Set<string>()
      return (rows || []).map(shape).filter((place): place is Place => {
        if (!place || seen.has(place.label)) return false
        seen.add(place.label)
        return true
      })
    })
    return json({ results })
  } catch (err) {
    return json({ results: [], error: String((err as Error).message || err).slice(0, 200) }, 502)
  }
}))
