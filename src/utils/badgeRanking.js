// Rangiranje znački: svaka značka ima nivo (1 bronza … 4 platina) i težinu 0–100.
// Baza (badges.tier_level / weight_score / unlock_hint, supabase/badges/01_badge_ranking.sql)
// je izvor istine; ova tabela je rezerva dok taj SQL nije na živoj bazi i za značke
// koje admin doda bez težine.

export const TIERS = {
  1: { key: 'bronze', label: 'Bronza' },
  2: { key: 'silver', label: 'Srebro' },
  3: { key: 'gold', label: 'Zlato' },
  4: { key: 'platinum', label: 'Platina' },
}

const licence = (hint) => ({ tier: 3, weight: 80, hint: `Priloži važeću ${hint} u Moj nalog → Značke.` })

export const DEFAULT_RANK = {
  five_star_50: { tier: 4, weight: 100, hint: 'Skupi 50 recenzija, i to sve od 5 zvjezdica.' },
  id_verified: { tier: 4, weight: 95, hint: 'Slikaj ličnu kartu ili pasoš u Moj nalog → Značke. Tim provjerava da li se slaže s profilom.' },
  verified: { tier: 4, weight: 90, hint: 'Potvrdi identitet i struku kod Zadatak tima.' },
  jobs_50: { tier: 4, weight: 88, hint: 'Završi 50 poslova kao izvođač.' },
  licence_electrician: licence('elektroinstalatersku licencu'),
  licence_plumber: licence('vodoinstalatersku licencu'),
  licence_gas: licence('plinsku licencu'),
  licence_hvac: licence('licencu za klimatizaciju i grijanje'),
  licence_construction: licence('građevinsku licencu'),
  licence_driver: { tier: 3, weight: 78, hint: 'Priloži važeću vozačku dozvolu u Moj nalog → Značke.' },
  police_check: { tier: 3, weight: 76, hint: 'Priloži važeće uvjerenje o nekažnjavanju (MUP / sud) u Moj nalog → Značke.' },
  top_rated: { tier: 3, weight: 74, hint: 'Skupi 10+ recenzija s prosjekom 4.8 ili više.' },
  flawless: { tier: 3, weight: 72, hint: 'Završi 10 poslova bez ijednog otkazivanja s tvoje strane.' },
  veteran: { tier: 3, weight: 68, hint: 'Budi član duže od godinu dana i završi 20+ poslova.' },
  majstor_mjeseca: { tier: 3, weight: 65, hint: 'Zadatak tim je dodjeljuje najbolje ocijenjenom izvođaču u mjesecu.' },
  local_hero: { tier: 2, weight: 55, hint: 'Završi 10 poslova u istom gradu.' },
  founder: { tier: 2, weight: 50, hint: 'Samo za prvih 100 članova Zadatka. Više se ne može dobiti.' },
  reliable: { tier: 2, weight: 45, hint: 'Neka bar 3 tvoje ponude budu prihvaćene i 80% prihvaćenih završi bez povlačenja.' },
  trusted_client: { tier: 2, weight: 45, hint: 'Kao klijent završi 5 poslova i ostavi bar 3 recenzije.' },
  payment_verified: { tier: 2, weight: 40, hint: 'Dodaj IBAN za primanje uplata u Moj nalog → Načini plaćanja.' },
  fast_responder: { tier: 2, weight: 35, hint: 'Odgovaraj na poruke u prosjeku za manje od 1 sat (bar 3 odgovora).' },
  rising_talent: { tier: 2, weight: 30, hint: 'U prvih 30 dana dobij 1–9 recenzija s prosjekom 4.5 ili više.' },
  mobile_verified: { tier: 1, weight: 15, hint: 'Potvrdi broj telefona SMS kodom u Moj nalog → Značke.' },
  jobs_5: { tier: 1, weight: 12, hint: 'Završi 5 poslova kao izvođač.' },
  email_verified: { tier: 1, weight: 10, hint: 'Klikni link iz e-maila koji ti je Zadatak poslao pri registraciji.' },
}

/** Značka s nivoom, težinom i uputom: kolone iz baze imaju prednost, pa katalog, pa rezerva. */
export function rankBadge(badge, catalogByCode = {}) {
  const row = { ...catalogByCode[badge.code], ...badge }
  const fallback = DEFAULT_RANK[badge.code] || { tier: 1, weight: 30, hint: null }
  const tier = Number(row.tier_level) || fallback.tier
  return {
    ...row,
    tier_level: tier,
    weight_score: row.weight_score ?? fallback.weight,
    unlock_hint: row.unlock_hint || fallback.hint,
    tier: TIERS[tier] || TIERS[1],
  }
}

/** Najteže prvo; ista težina → viši nivo, pa abecedno (da redoslijed ne skače). */
export function sortByWeight(badges, catalogByCode = {}) {
  return badges
    .map((badge) => rankBadge(badge, catalogByCode))
    .sort((a, b) => b.weight_score - a.weight_score || b.tier_level - a.tier_level || a.label.localeCompare(b.label, 'bs'))
}

/** Top N osvojenih znački za javni profil (podrazumijevano 5). */
export function topBadges(badges, catalogByCode = {}, limit = 5) {
  return sortByWeight(badges || [], catalogByCode).slice(0, limit)
}

/** "3 / 10 poslova" + udio 0–1 za traku napretka; null kad značka nema brojač. */
export function progressOf(progress) {
  if (!progress || !progress.target) return null
  const current = Math.min(Number(progress.current) || 0, progress.target)
  return { current, target: progress.target, unit: progress.unit, ratio: current / progress.target, left: progress.target - current }
}
