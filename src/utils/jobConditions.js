// Uslovi (značke koje izvođač mora imati) i pogodnosti (šta klijent obezbjeđuje) na poslu.
// Kodovi moraju biti isti kao u supabase/offers/job_conditions.sql (job_requirement_codes / job_perk_codes);
// baza odbije sve ostalo i sama provjerava značke kad izvođač šalje ponudu.

export const MAX_REQUIRED_BADGES = 5

export const REQUIREMENTS = [
  { code: 'licence_electrician', label: 'Električarska licenca', short: 'Licenca: struja', group: 'licence' },
  { code: 'licence_plumber', label: 'Vodoinstalaterska licenca', short: 'Licenca: voda', group: 'licence' },
  { code: 'licence_gas', label: 'Plinska licenca', short: 'Licenca: plin', group: 'licence' },
  { code: 'licence_hvac', label: 'Licenca za klimatizaciju i grijanje', short: 'Licenca: klima', group: 'licence' },
  { code: 'licence_construction', label: 'Građevinska licenca', short: 'Licenca: gradnja', group: 'licence' },
  { code: 'licence_driver', label: 'Vozačka dozvola', short: 'Vozačka dozvola', group: 'licence' },
  { code: 'police_check', label: 'Uvjerenje o nekažnjavanju', short: 'Nekažnjavan', group: 'trust' },
  { code: 'mobile_verified', label: 'Telefon verifikovan', short: 'Telefon potvrđen', group: 'trust' },
  { code: 'payment_verified', label: 'Način plaćanja verifikovan', short: 'IBAN dodan', group: 'trust' },
]

export const PERKS = [
  // label: u formi (klijent govori), shown: na stranici posla pod "Klijent obezbjeđuje"
  { code: 'materials', label: 'Obezbjeđujem materijal', shown: 'Materijal' },
  { code: 'tools', label: 'Obezbjeđujem alat', shown: 'Alat' },
  { code: 'parking', label: 'Besplatan parking', shown: 'Besplatan parking' },
  { code: 'meal', label: 'Obrok i osvježenje', shown: 'Obrok i osvježenje' },
  { code: 'transport_help', label: 'Pomažem s prevozom stvari', shown: 'Pomoć s prevozom stvari' },
]

const REQ_BY_CODE = Object.fromEntries(REQUIREMENTS.map((item) => [item.code, item]))
const PERK_BY_CODE = Object.fromEntries(PERKS.map((item) => [item.code, item]))

export const requirementLabel = (code) => REQ_BY_CODE[code]?.label || code
export const perkLabel = (code) => PERK_BY_CODE[code]?.label || code
export const perkShown = (code) => PERK_BY_CODE[code]?.shown || perkLabel(code)

/** Licenca koju kategorija posla obično traži — samo prijedlog u formi, klijent odlučuje. */
const SUGGESTED_FOR_CATEGORY = {
  'Električar': 'licence_electrician',
  'Vodoinstalater': 'licence_plumber',
  'Klimatizacija i grijanje': 'licence_hvac',
  'Renoviranje i građevinski radovi': 'licence_construction',
  'Selidbe i transport': 'licence_driver',
  'Prevoz i dostava': 'licence_driver',
  'Čuvanje djece': 'police_check',
}
export const suggestedRequirement = (category) => SUGGESTED_FOR_CATEGORY[category] || null

/** Čist objekt za bazu: samo poznati kodovi, bez duplikata, u redoslijedu kataloga. */
export function cleanConditions(value) {
  const requires = new Set(Array.isArray(value?.requires) ? value.requires : [])
  const perks = new Set(Array.isArray(value?.perks) ? value.perks : [])
  const out = {}
  const req = REQUIREMENTS.map((item) => item.code).filter((code) => requires.has(code)).slice(0, MAX_REQUIRED_BADGES)
  const prk = PERKS.map((item) => item.code).filter((code) => perks.has(code))
  if (req.length) out.requires = req
  if (prk.length) out.perks = prk
  return out
}

export const hasConditions = (value) => Boolean(value?.requires?.length || value?.perks?.length)

/** Kratak opis za pregled prije objave. */
export function conditionsSummary(value) {
  const parts = [...(value?.requires || []).map((code) => REQ_BY_CODE[code]?.short || code), ...(value?.perks || []).map(perkLabel)]
  return parts.join(' · ')
}

/**
 * Gdje izvođač dobija značku koja mu nedostaje: lična karta ima svoj tok,
 * IBAN svoju stranicu, ostale značke se traže na stranici Značke.
 */
export function badgeFixLink(code, next) {
  const back = next ? `?next=${encodeURIComponent(next)}` : ''
  if (code === 'id_verified') return `/account/verifikacija${back}`
  if (code === 'payment_verified') return `/account/nacini-placanja${back}`
  return `/account/znacke${back}#${code}`
}
