#!/usr/bin/env node
// Loads supabase/locations/bih_locations.csv (or any CSV/JSON with the same columns) into public.bih_locations.
//
//   node scripts/locations/seed-bih-locations.mjs                 → writes supabase/locations/02_seed_bih_locations.sql
//   node scripts/locations/seed-bih-locations.mjs --file my.json  → same, from a JSON array
//   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/locations/seed-bih-locations.mjs --upload
//                                                                 → upserts straight into that database, 500 rows a call
//
// Columns: settlement_name, municipality, region_canton, postal_code, kind (grad | naselje | dio grada),
// population, lat, lng, label (optional, defaults to "Naselje, Općina"), source.
// Rows are upserted by label, so running it again updates points and names instead of duplicating them.
//
// Sample of the data (JSON form):
//   [
//     { "settlement_name": "Otes", "municipality": "Ilidža", "region_canton": "Kanton Sarajevo", "lat": 43.84008, "lng": 18.3054 },
//     { "settlement_name": "Butmir", "municipality": "Ilidža", "region_canton": "Kanton Sarajevo", "lat": 43.82044, "lng": 18.32322 },
//     { "settlement_name": "Hrasnica", "municipality": "Ilidža", "region_canton": "Kanton Sarajevo", "lat": 43.79467, "lng": 18.31716 },
//     { "settlement_name": "Sokolović Kolonija", "municipality": "Ilidža", "region_canton": "Kanton Sarajevo", "kind": "dio grada", "lat": 43.8085, "lng": 18.3165 },
//     { "settlement_name": "Bijeli Brijeg", "municipality": "Mostar", "region_canton": "Hercegovačko-neretvanski kanton", "kind": "dio grada", "lat": 43.348, "lng": 17.802 },
//     { "settlement_name": "Slatina", "municipality": "Tuzla", "region_canton": "Tuzlanski kanton", "kind": "dio grada", "lat": 44.542, "lng": 18.6655 }
//   ]
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const flag = (name) => { const index = args.indexOf(name); return index >= 0 ? (args[index + 1] || true) : null }
const inputFile = flag('--file') || join(here, '../../supabase/locations/bih_locations.csv')
const outFile = flag('--out') || join(here, '../../supabase/locations/02_seed_bih_locations.sql')
const BATCH = 500

export function parseCsv(text) {
  const rows = []
  let row = []; let cell = ''; let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++ } else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') { row.push(cell); cell = '' } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cell); cell = ''
      if (row.some((value) => value !== '')) rows.push(row)
      row = []
    } else cell += ch
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row) }
  const [header, ...body] = rows
  return body.map((values) => Object.fromEntries(header.map((key, index) => [key.trim(), values[index] ?? ''])))
}

const KINDS = new Set(['grad', 'naselje', 'dio grada'])
export function normaliseRow(raw, index) {
  const name = String(raw.settlement_name || '').trim()
  const municipality = String(raw.municipality || '').trim()
  const lat = Number(raw.lat); const lng = Number(raw.lng)
  if (!name || !municipality) throw new Error(`row ${index + 1}: settlement_name and municipality are required`)
  if (!(lat >= 42.4 && lat <= 45.4 && lng >= 15.6 && lng <= 19.8)) throw new Error(`row ${index + 1} (${name}): point ${lat}, ${lng} is not in BiH`)
  const kind = KINDS.has(raw.kind) ? raw.kind : 'naselje'
  return {
    settlement_name: name,
    municipality,
    region_canton: String(raw.region_canton || '').trim() || null,
    postal_code: String(raw.postal_code || '').trim() || null,
    kind,
    population: Math.max(0, Math.round(Number(raw.population) || 0)),
    lat, lng,
    label: String(raw.label || '').trim() || `${name}, ${municipality}`,
    source: String(raw.source || '').trim() || null,
  }
}

const text = readFileSync(inputFile, 'utf8')
const rows = (inputFile.endsWith('.json') ? JSON.parse(text) : parseCsv(text)).map(normaliseRow)
const COLUMNS = ['settlement_name', 'municipality', 'region_canton', 'postal_code', 'kind', 'population', 'lat', 'lng', 'label', 'source']

if (args.includes('--upload')) {
  const url = process.env.SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) { console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are needed for --upload'); process.exit(1) }
  const { createClient } = await import('@supabase/supabase-js')
  const db = createClient(url, key, { auth: { persistSession: false } })
  for (let start = 0; start < rows.length; start += BATCH) {
    const { error } = await db.from('bih_locations').upsert(rows.slice(start, start + BATCH), { onConflict: 'label_key' })
    if (error) { console.error(`rows ${start + 1}-${start + BATCH}: ${error.message}`); process.exit(1) }
    process.stdout.write(`\r${Math.min(start + BATCH, rows.length)} / ${rows.length}`)
  }
  console.log('\ndone')
} else {
  const literal = (value) => (value === null || value === undefined ? 'null'
    : typeof value === 'number' ? String(value) : `'${String(value).replace(/'/g, "''")}'`)
  const parts = [
    '-- Generated by scripts/locations/seed-bih-locations.mjs from supabase/locations/bih_locations.csv. Do not edit by hand.',
    "-- Places: Who's On First / GeoNames (CC BY 4.0). Needs 01_bih_locations.sql. Safe to run more than once.",
    `-- ${rows.length} places.`,
    'begin;',
  ]
  for (let start = 0; start < rows.length; start += BATCH) {
    const values = rows.slice(start, start + BATCH).map((row) => `(${COLUMNS.map((column) => literal(row[column])).join(',')})`)
    parts.push(`insert into public.bih_locations (${COLUMNS.join(', ')}) values\n${values.join(',\n')}\non conflict (label_key) do update set ${COLUMNS.filter((c) => c !== 'label').map((c) => `${c} = excluded.${c}`).join(', ')}, label = excluded.label;`)
  }
  parts.push('commit;', '')
  writeFileSync(outFile, parts.join('\n'))
  console.log(`${rows.length} places → ${outFile}`)
}
