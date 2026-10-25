// Zadatak asistent's own brain — answers instantly without any AI key, and is the fallback
// when the support-assistant function is not configured or unreachable.
//
// 1. Small talk (greetings, thanks, laughter, "ne razumijem") gets a human reply and topic
//    buttons instead of a hand-off.
// 2. Questions about the user's own account (balans, poslovi, ponude, isplate) are answered
//    from their real data (`context`, read through their own RLS-scoped queries).
// 3. Everything else is ranked against the help articles and the site guide (stems, idf,
//    keyword hits); a clear match is answered, a fuzzy one is offered as choices.
// 4. Only an explicit request for a person or a serious problem (prevara, spor, suspenzija,
//    hakovan nalog...) is handed to the team.
import { HELP_ARTICLES } from '../data/helpArticles'
import { SITE_GUIDE } from '../data/siteGuide'

export const HUMAN_LABEL = 'Razgovaraj sa pravim pomoćnikom'

export const fold = (value) => String(value || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'dj')

const STOP = new Set('kako sta sto gdje gde koji koja koje kada kad ali ili ako jer sam si je smo ste su bih bi biti mogu moze mozes zasto ima imam nema nisam nije mene meni moj moja moje moji tvoj tvoja ovo ono taj ta to da ne na za od do sa se su ce cu li pa te ti mi vi oni ona one ovaj ova kod iz po pri uz hocu zelim treba trebam neki neka nesto jos samo vec bas evo molim pozdrav'.split(' '))

const stem = (word) => (word.length > 5 ? word.slice(0, 5) : word)
const tokens = (text) => fold(text).split(/[^a-z0-9]+/).filter((word) => word.length >= 3 && !STOP.has(word)).map(stem)

// ---- index (built once) ----
const DOCS = [
  ...HELP_ARTICLES.map((article) => ({ kind: 'article', item: article, label: article.q, keywords: article.keywords.map(fold), fields: [[tokens(article.q), 3], [tokens(article.a), 1]] })),
  ...SITE_GUIDE.map((entry) => ({ kind: 'guide', item: entry, label: `Gdje nađem: ${entry.title}`, keywords: entry.keywords.map(fold), fields: [[tokens(entry.title), 3], [tokens(entry.where), 1]] })),
]
const DF = new Map()
for (const doc of DOCS) {
  doc.sets = doc.fields.map(([list, weight]) => [new Set(list), weight])
  for (const word of new Set(doc.fields.flatMap(([list]) => list))) DF.set(word, (DF.get(word) || 0) + 1)
}
const idf = (word) => Math.log(1 + DOCS.length / (DF.get(word) || 0.5))

/** Help articles and guide entries ranked for a question, best first: [{ doc, score }]. */
export function rankHelp(text) {
  const needle = fold(text)
  const words = [...new Set(tokens(text))]
  if (!words.length && needle.length < 3) return []
  return DOCS.map((doc) => {
    let score = 0
    for (const keyword of doc.keywords) if (keyword.length >= 3 && needle.includes(keyword)) score += keyword.length > 5 ? 3 : 2
    for (const word of words) {
      for (const [set, weight] of doc.sets) if (set.has(word)) { score += idf(word) * weight * 0.5; break }
    }
    // the guide answers "where", articles answer "how/why"
    if (doc.kind === 'guide' && /(gdje|gde|nadjem|naci|nalazim|stranic|meni)/.test(needle)) score *= 1.4
    return { doc, score }
  }).filter((hit) => hit.score > 0).sort((a, b) => b.score - a.score)
}

// ---- intents ----
const HUMAN = /(prav(i|og|im|om) (pomocnik|osob|covjek|agent)|uzivo|ziv[aou] (osob|covjek|agent)|covjek|osob[aeu]\b|operater|agent|\btim(om|u|a)?\b|podrsk[aeu] uzivo|kontakt s|razgovarati s|pricati s|pozovi)/
const SERIOUS = /(prevar|scam|ukra|uze[ol][a]? (pare|novac)|spor\b|reklamac|suspend|blokir|banova|hakov|hakir|provali|zalb|nije dosa|nije dosao|ne javlja|prijet|uvred|nisam dobi[ol]a? (novac|pare|isplat|uplat)|nestal[oi]? (novac|pare)|pogresn[ao] naplat|dupl[ao] naplat|vrati(te)? (mi )?(novac|pare))/
const GREETING = /^(e+|ej+|hej+|haj|hi+|hello|helo|pozz*|poz|zdravo|zdravo+|cao+|selam|merhaba|dobar dan|dobro jutro|dobro vece|dobrovece|zdr|yo|sta ima|kako si|kako ste)\b/
const THANKS = /\b(hvala|fala|hvala ti|super|odlicno|top|svaka cast|ok+|okej|uredu|u redu|jasno|razumijem)\b/
const BYE = /\b(cao|zbogom|vidimo se|laku noc|doviđenja|dovidjenja|to je sve|nista vise)\b/
const isLaugh = (compact) => /^(lol|xd+|:d+)$/.test(compact) || (/^[bhaeix]{4,}$/.test(compact) && (compact.match(/h/g) || []).length >= 2)
const CONFUSED = /(ne razumijem|nije mi jasno|ne kontam|ne kapiram|nejasno|pojasni|objasni (mi )?(bolje|jednostavnije|opet)|sta to znaci|kako to misli)/
const PERSONAL = /\b(moj[aeiu]?|mojih|mojim|mog|mom|mi|imam|meni|svoj[aeiu]?|svojih)\b/
const BALANCE = /(balans|stanje|saldo|novcanik|koliko (para|novca|imam)|pare na)/
const JOBS = /(posa?o|poslov|oglas|zadat)/
const BIDS = /(ponud)/
const PAYOUTS = /(isplat|uplat|placanj|zarad|oslobod)/

const money = (value) => `${Number(value || 0).toFixed(2).replace(/\.00$/, '').replace('.', ',')} KM`

const LISTING_STATUS = { published: 'objavljen, čeka ponude', assigned: 'izvođač odabran, plaćanje osigurano', completed: 'završen', cancelled: 'otkazan', draft: 'nacrt', paused: 'pauziran', closed: 'zatvoren', archived: 'uklonjen' }
const BID_STATUS = { pending: 'na čekanju', accepted: 'prihvaćena', rejected: 'odbijena', withdrawn: 'povučena' }
const PAY_STATUS = { funded: 'novac osiguran na Zadatku', requested: 'izvođač traži isplatu — klijent treba osloboditi uplatu', released: 'isplaćeno', refunded: 'vraćeno klijentu', disputed: 'u sporu — tim pregleda' }

const isProvider = (context) => ['provider', 'both'].includes(context?.accountType)

/** Topic buttons that fit who the user is. */
export function starterSuggestions(context) {
  const personal = context ? ['Koliki mi je balans?', 'Status mojih poslova'] : []
  return isProvider(context)
    ? [...personal, 'Kako dobijam novac za posao?', 'Kolika je naknada i kako rade nivoi?', 'Kako dobijam značke?']
    : [...personal, 'Kako objavim posao?', 'Kako radi plaćanje (Zadatak Pay)?', 'Kako biram izvođača?']
}

const reply = (text, suggestions = [], extra = {}) => ({ reply: text, handoff: false, suggestions: [...new Set(suggestions)].slice(0, 4), ...extra })

function personalAnswer(needle, context) {
  if (!context) return null
  const asksMine = PERSONAL.test(needle) || /^(status|stanje)\b/.test(needle)
  if (!asksMine) return null

  if (BALANCE.test(needle) && context.balance != null) {
    const last = context.lastTransaction
    return reply(
      `Tvoj balans je ${money(context.balance)}.${last ? ` Zadnja promjena: ${Number(last.amount) > 0 ? '+' : ''}${money(last.amount)}${last.note ? ` (${last.note})` : ''}.` : ''}\nSve uplate, naknade i isplate vidiš u Moj nalog → Plaćanje → Balans (/account/novcanik).`,
      ['Kako primam isplate?', 'Šta je balans na mom nalogu?'],
    )
  }

  if (PAYOUTS.test(needle) && context.payments?.length) {
    const lines = context.payments.slice(0, 4).map((pay) => `- ${pay.title || 'Posao'}: ${money(pay.amount)} — ${PAY_STATUS[pay.status] || pay.status}`)
    return reply(`Ovo su tvoja zadnja plaćanja kroz Zadatak Pay:\n${lines.join('\n')}\nDetalji su u Moj nalog → Plaćanje → Historija (/account/placanja).`, ['Kad i kako dobijam novac za posao?', 'Kako radi plaćanje (Zadatak Pay)?'])
  }

  if (BIDS.test(needle)) {
    if (!context.bids?.length) return reply('Još nisi poslao/la nijednu ponudu. Poslove za tebe nađeš u „Pretraži poslove“ (/search) — otvori oglas i klikni „Pošalji ponudu“.', ['Kako počinjem zarađivati?', 'Zašto ne vidim neke poslove u preporukama?'])
    const lines = context.bids.slice(0, 5).map((bid) => `- ${bid.title || 'Oglas'}: ${money(bid.amount)} — ${BID_STATUS[bid.status] || bid.status}`)
    return reply(`Tvoje zadnje ponude:\n${lines.join('\n')}\nSve ponude su u Moji poslovi (/moji-poslovi).`, ['Kako biram izvođača?', 'Šta je uspješnost i kako je podižem?'])
  }

  if (JOBS.test(needle) || /^status\b/.test(needle)) {
    if (!context.listings?.length && !context.bids?.length) return reply('Još nemaš nijedan posao na Zadatku. Novi objaviš za par minuta preko „Objavi posao“ (/objavi) — besplatno je.', ['Kako objavim posao?', 'Koliko košta objava posla?'])
    const lines = (context.listings || []).slice(0, 5).map((listing) => `- ${listing.title}: ${LISTING_STATUS[listing.status] || listing.status}${listing.bidCount ? ` · ${listing.bidCount} ponud${listing.bidCount === 1 ? 'a' : 'e'}` : ''} (/listings/${listing.id})`)
    const bidLine = context.bids?.length ? `\nPoslao/la si i ${context.bids.length} ponud${context.bids.length === 1 ? 'u' : 'e'} na tuđe poslove.` : ''
    return reply(`${lines.length ? `Tvoji poslovi:\n${lines.join('\n')}` : 'Nemaš svojih objavljenih poslova.'}${bidLine}\nSve je na jednom mjestu u Moji poslovi (/moji-poslovi).`, ['Mogu li urediti ili otkazati posao?', 'Moje ponude', 'Kako radi plaćanje (Zadatak Pay)?'])
  }
  return null
}

const firstName = (context) => (context?.firstName ? `, ${context.firstName}` : '')

/**
 * The assistant's answer: { reply, handoff, summary?, suggestions }.
 * `history` is this conversation so far (oldest first), `context` the user's own data or null.
 */
export function localAnswer(text, { context = null, history = [] } = {}) {
  const needle = fold(text).replace(/\s+/g, ' ').trim()
  const words = needle.split(' ').filter(Boolean)
  const starters = starterSuggestions(context)

  if (HUMAN.test(needle) || needle === fold(HUMAN_LABEL)) {
    return { reply: 'Naravno — povezujem te sa pravim pomoćnikom iz Zadatak tima. Javit će ti se ovdje i na email, obično u roku od par sati. Slobodno odmah napiši šta se desilo, što detaljnije.', handoff: true, summary: `Korisnik traži osobu. Zadnje: ${history.filter((item) => item.sender === 'user').slice(-3).map((item) => item.message).join(' | ').slice(0, 250)}`, suggestions: [] }
  }

  if (SERIOUS.test(needle)) {
    return { reply: 'Ovo je važno, pa ga odmah predajem pravom pomoćniku iz Zadatak tima — on ima pristup tvom nalogu i plaćanjima. Dok čekaš, pripremi:\n- naslov posla ili link do oglasa\n- screenshot razgovora ili uplate\n- svoj privatni ID (PB-…) iz Profila\nTim odgovara ovdje i na email, obično u roku od par sati.', handoff: true, summary: `Ozbiljan problem: ${text.slice(0, 250)}`, suggestions: [] }
  }

  if (!/[a-z0-9]/.test(needle) || isLaugh(needle.replace(/\s/g, ''))) {
    return reply(`😄 Tu sam${firstName(context)}! Kad ti nešto zatreba, pitaj me ili izaberi temu:`, starters)
  }

  if (GREETING.test(needle) && words.length <= 4) {
    return reply(`Zdravo${firstName(context)}! 👋 Ja sam Zadatak asistent. Mogu ti pomoći oko objave posla, ponuda, plaćanja, balansa, značaka i naloga — a mogu i pogledati stanje tvojih poslova. Šta te zanima?`, starters)
  }

  if (CONFUSED.test(needle)) {
    const lastAnswer = [...history].reverse().find((item) => item.sender === 'assistant')
    const topic = lastAnswer ? rankHelp(history.filter((item) => item.sender === 'user').slice(-2, -1).map((item) => item.message).join(' '))[0] : null
    const simple = topic?.doc.kind === 'article' ? `\n\nUkratko: ${topic.doc.item.a.split(/(?<=[.!?])\s/)[0]}` : ''
    return reply(`Izvini, probat ću jasnije.${simple}\n\nNapiši mi svojim riječima šta želiš uraditi (npr. „hoću da platim majstora“ ili „ne vidim svoju ponudu“) — ili izaberi temu. Ako ti je lakše, pravi pomoćnik je jedan klik dalje.`, [...starters.slice(0, 3), HUMAN_LABEL])
  }

  if (THANKS.test(needle) && words.length <= 4) {
    return reply('Nema na čemu! 🙂 Ako zatreba još nešto, tu sam.', starters.slice(0, 3))
  }
  if (BYE.test(needle) && words.length <= 4) {
    return reply('Prijatno! Razgovor se sam zatvara nakon 25 minuta, a kad se vratiš, čeka te prazan prozor za novo pitanje.', [])
  }

  if (needle === 'nije mi pomoglo' || needle.startsWith('nije mi pomog')) {
    return reply('Žao mi je. Opiši mi problem s još par detalja (šta klikneš i šta se desi), pa ću probati ponovo — ili te odmah spojim sa pravim pomoćnikom.', [HUMAN_LABEL])
  }

  const personal = personalAnswer(needle, context)
  if (personal) return personal

  const hits = rankHelp(text)
  const [best, second] = hits
  const related = hits.slice(1, 4).filter((hit) => hit.score >= best.score * 0.45).map((hit) => hit.doc.label)
  // a strong hit is answered (close runners-up become buttons); a weak one only when it clearly leads
  if (best && (best.score >= 4 || (best.score >= 2 && (!second || best.score >= second.score * 1.5)))) {
    const { doc } = best
    const body = doc.kind === 'article'
      ? doc.item.a
      : `${doc.item.title}: ${doc.item.where} (${doc.item.path})`
    const where = doc.kind === 'article' ? SITE_GUIDE.find((entry) => entry.keywords.some((keyword) => fold(text).includes(fold(keyword))) && !body.includes(entry.path)) : null
    return reply(`${body}${where ? `\n\nGdje: ${where.where} (${where.path})` : ''}`, [...related, 'Nije mi pomoglo'])
  }

  if (hits.length) {
    return reply('Nisam siguran da sam te dobro razumio. Misliš li na nešto od ovoga?', [...hits.slice(0, 3).map((hit) => hit.doc.label), HUMAN_LABEL])
  }
  return reply('Hmm, to ne znam sigurno. Probaj pitati drugim riječima (npr. „kako da platim“, „gdje mi je balans“) ili izaberi temu — a ako treba, spojit ću te sa pravim pomoćnikom.', [...starters.slice(0, 3), HUMAN_LABEL])
}
