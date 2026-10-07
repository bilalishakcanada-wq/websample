#!/usr/bin/env node
// Builds supabase/locations/bih_locations.csv: every settlement (naselje), village and town quarter in
// Bosnia and Herzegovina with its municipality, canton/entity and coordinates.
//
// Source: Who's On First (https://whosonfirst.org, data licence: CC0 for WOF's own work, place points mostly
// from GeoNames, CC BY 4.0: "Data from Who's On First / GeoNames"). Clone the BiH repository once:
//   git clone --depth 1 https://github.com/whosonfirst-data/whosonfirst-data-admin-ba /tmp/wof-ba
//   node scripts/locations/build-bih-locations.mjs /tmp/wof-ba
// Then turn the CSV into SQL (or upload it straight to a database) with seed-bih-locations.mjs.
//
// What it does:
//   - keeps current localities and neighbourhoods; drops destroyed/abandoned places (GeoNames PPLW, PPLQ),
//     superseded records and places outside BiH
//   - municipality = the place's WOF "county" (renamed to today's names in municipalities.mjs); a place with
//     no county gets the county polygon it lies in
//   - uses the Bosnian/Croatian/Serbian Latin name when the source has one with č ć š ž đ
//   - one row per name per municipality (GeoNames often lists a village twice); the larger/administrative
//     one wins
//   - adds the town quarters people search for that the source lacks (EXTRA_PLACES, approximate points)
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MUNICIPALITIES, REGIONS } from './municipalities.mjs'
import { EXTRA_PLACES } from './extra-places.mjs'

const wofDir = process.argv[2]
if (!wofDir) { console.error('usage: node build-bih-locations.mjs <whosonfirst-data-admin-ba checkout>'); process.exit(1) }
const here = dirname(fileURLToPath(import.meta.url))
const outFile = join(here, '../../supabase/locations/bih_locations.csv')

// the city names the site offered before (src/data/cityCoordinates.js): such a town keeps its bare name as
// its label, so jobs and profiles saved as "Sarajevo" or "Tuzla" keep matching
const OLD_CITIES = new Set(Object.keys((await import('../../src/data/cityCoordinates.js')).cityCoordinates))

export const fold = (value) => String(value || '').toLowerCase()
  .replace(/š/g, 's').replace(/č/g, 'c').replace(/ć/g, 'c').replace(/ž/g, 'z').replace(/đ/g, 'dj')
  .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()
// GeoNames writes đ as "dj" or "d" in ASCII names
const loose = (value) => fold(value).replace(/dj/g, 'd')

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) yield* walk(path)
    else if (name.endsWith('.geojson') && !name.includes('-alt-')) yield path
  }
}

const ring = (point, coords) => {
  let inside = false
  const [x, y] = point
  for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
    const [xi, yi] = coords[i]; const [xj, yj] = coords[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}
const inPolygon = (point, polygon) => ring(point, polygon[0]) && !polygon.slice(1).some((hole) => ring(point, hole))
const inGeometry = (point, geometry) => geometry.type === 'Polygon' ? inPolygon(point, geometry.coordinates)
  : geometry.type === 'MultiPolygon' ? geometry.coordinates.some((polygon) => inPolygon(point, polygon)) : false

const SLAVIC = ['name:bos_x_preferred', 'name:hrv_x_preferred', 'name:srp_x_preferred', 'name:hbs_x_preferred', 'name:bos_x_variant', 'name:hrv_x_variant']
const DIACRITIC = /[čćžšđ]/i
const CYRILLIC = /[Ѐ-ӿ]/
// Ð (U+00D0, Icelandic eth) shows up in some sources where Đ is meant
const fixLetters = (value) => String(value || '').replace(/\u00d0/g, 'Đ').replace(/\u00f0/g, 'đ').trim()
// the few places the source only names in English, or spells differently from how people there write it
const RENAMES = { 'East New Sarajevo': 'Istočno Novo Sarajevo' }
const LOCAL_SPELLING = { 'Oteš|Ilidža': 'Otes' }
function bestName(props) {
  const base = fixLetters(props['wof:name'])
  if (RENAMES[base]) return RENAMES[base]
  // WOF's name is GeoNames' ASCII name; GeoNames' own name usually has the č ć š ž đ
  const geonames = fixLetters(props['gn:name'])
  if (geonames && DIACRITIC.test(geonames) && !CYRILLIC.test(geonames) && loose(geonames) === loose(base)) return geonames
  for (const key of SLAVIC) {
    for (const candidate of props[key] || []) {
      if (CYRILLIC.test(candidate) || !DIACRITIC.test(candidate)) continue
      if (loose(candidate) === loose(base)) return fixLetters(candidate)
    }
  }
  return base
}

const KIND = { PPLC: 'grad', PPLA: 'grad', PPLA2: 'grad', PPLA3: 'grad', PPLA4: 'grad', PPL: 'naselje', PPLL: 'naselje', PPLF: 'naselje', PPLS: 'naselje', PPLX: 'dio grada' }
const SKIP_CODES = new Set(['PPLW', 'PPLQ', 'PPLH', 'HLL', 'MT'])

const counties = []
const places = []
for (const file of walk(join(wofDir, 'data'))) {
  const feature = JSON.parse(readFileSync(file, 'utf8'))
  const props = feature.properties
  const type = props['wof:placetype']
  if (type === 'county' && MUNICIPALITIES[props['wof:id']]) counties.push({ id: props['wof:id'], geometry: feature.geometry })
  if (type !== 'locality' && type !== 'neighbourhood') continue
  if (props['edtf:deprecated'] || (props['wof:superseded_by'] || []).length) continue
  if (props['iso:country'] && props['iso:country'] !== 'BA') continue
  const code = props['gn:feature_code'] || props['gn:fcode'] || null
  if (code && SKIP_CODES.has(code)) continue
  const lat = Number(props['lbl:latitude'] ?? props['geom:latitude'])
  const lng = Number(props['lbl:longitude'] ?? props['geom:longitude'])
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
  const hierarchy = (props['wof:hierarchy'] || [])[0] || {}
  places.push({
    name: bestName(props),
    countyId: hierarchy.county_id || null,
    lat, lng,
    kind: type === 'neighbourhood' ? 'dio grada' : (KIND[code] || 'naselje'),
    population: Number(props['gn:population'] || props['wof:population'] || 0),
    current: props['mz:is_current'] ?? -1,
    source: `wof:${props['wof:id']}`,
  })
}

// county → region (canton/entity), by majority of its places
const regionVotes = {}
for (const file of walk(join(wofDir, 'data'))) {
  const props = JSON.parse(readFileSync(file, 'utf8')).properties
  if (props['wof:placetype'] !== 'locality') continue
  const h = (props['wof:hierarchy'] || [])[0] || {}
  if (!h.county_id || !REGIONS[h.region_id]) continue
  const votes = (regionVotes[h.county_id] ||= {})
  votes[h.region_id] = (votes[h.region_id] || 0) + 1
}
const regionOf = (countyId) => {
  const votes = regionVotes[countyId] || {}
  const best = Object.entries(votes).sort((a, b) => b[1] - a[1])[0]
  return best ? REGIONS[best[0]] : null
}

let placedByPolygon = 0
let outside = 0
const rows = []
for (const place of places) {
  let countyId = MUNICIPALITIES[place.countyId] ? place.countyId : null
  if (!countyId) {
    const hit = counties.find((county) => inGeometry([place.lng, place.lat], county.geometry))
    if (!hit) { outside++; continue }
    countyId = hit.id
    placedByPolygon++
  }
  const municipality = MUNICIPALITIES[countyId]
  rows.push({ ...place, name: LOCAL_SPELLING[`${place.name}|${municipality}`] || place.name, municipality, region: regionOf(countyId) })
}

for (const extra of EXTRA_PLACES) {
  const county = Object.entries(MUNICIPALITIES).find(([, name]) => name === extra.municipality)
  if (!county) throw new Error(`unknown municipality ${extra.municipality}`)
  rows.push({ name: extra.name, municipality: extra.municipality, region: regionOf(Number(county[0])), lat: extra.lat, lng: extra.lng,
    kind: 'dio grada', population: 0, current: 1, source: 'dopuna' })
}

// one row per (name, municipality): the administrative/larger/current one wins
const rank = (row) => (row.kind === 'grad' ? 4 : 0) + (row.source === 'dopuna' ? 0 : 1) + (row.current === 1 ? 1 : 0) + Math.log10(1 + row.population)
const byKey = new Map()
let duplicates = 0
for (const row of rows) {
  const key = `${loose(row.name)}|${row.municipality}`
  const seen = byKey.get(key)
  if (seen) duplicates++
  if (!seen || rank(row) > rank(seen) || (rank(row) === rank(seen) && DIACRITIC.test(row.name) && !DIACRITIC.test(seen.name))) byKey.set(key, row)
}

const out = [...byKey.values()].map((row) => {
  const bare = fold(row.name) === fold(row.municipality) || (row.kind === 'grad' && OLD_CITIES.has(row.name))
  return { ...row, label: bare ? row.name : `${row.name}, ${row.municipality}` }
})
// two rows must never share a label: the label is what jobs and profiles store
const labels = new Set()
const unique = out.filter((row) => { const key = loose(row.label); if (labels.has(key)) { duplicates++; return false } labels.add(key); return true })
unique.sort((a, b) => a.municipality.localeCompare(b.municipality, 'bs') || a.name.localeCompare(b.name, 'bs'))

const csvCell = (value) => {
  const text = value === null || value === undefined ? '' : String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}
const header = ['settlement_name', 'municipality', 'region_canton', 'postal_code', 'kind', 'population', 'lat', 'lng', 'label', 'source']
const lines = [header.join(',')].concat(unique.map((row) => [
  row.name, row.municipality, row.region, '', row.kind, row.population || '', row.lat.toFixed(5), row.lng.toFixed(5), row.label, row.source,
].map(csvCell).join(',')))
mkdirSync(dirname(outFile), { recursive: true })
writeFileSync(outFile, `${lines.join('\n')}\n`)
console.log(`${unique.length} places → ${outFile}`)
console.log(`placed by municipality outline: ${placedByPolygon}, outside BiH: ${outside}, merged duplicates: ${duplicates}`)
