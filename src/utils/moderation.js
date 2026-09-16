const PROHIBITED_TERMS = [
  'oružje', 'oruzje', 'pištolj', 'pistolj', 'puška', 'puska', 'municija', 'granata', 'eksploziv',
  'gun', 'firearm', 'pistol', 'rifle', 'ammunition', 'explosive',
  'droga', 'drogu', 'drogom', 'kokain', 'heroin', 'marihuana', 'marijuana', 'kanabis', 'canabis',
  'ecstasy', 'ekstazi', 'amfetamin', 'metamfetamin', 'cocaine',
  'falsifikat', 'falsifikovan', 'lazna licna', 'lazni pasos', 'prostitucij', 'escort', 'seksualne usluge',
]

const normalize = (value) => String(value || '')
  .toLowerCase()
  .replace(/š/g, 's')
  .replace(/č/g, 'c')
  .replace(/ć/g, 'c')
  .replace(/ž/g, 'z')
  .replace(/đ/g, 'dj')

export const findProhibitedTerm = (...texts) => {
  const combined = normalize(texts.join(' '))
  return PROHIBITED_TERMS.find((term) => combined.includes(normalize(term))) || null
}

// ---------------------------------------------------------------------------
// Rule #1 — no contact details or outside channels anywhere on the platform.
// Mirrors public.moderation_scan() in the database; the server is the authority,
// this only gives people instant feedback before they hit "Sačuvaj".
// ---------------------------------------------------------------------------

const NUM_WORD = '(?:nula|jedan|jedna|jedno|dva|dvije|dvi|tri|[čc]etiri|pet|[šs]est|sedam|osam|devet|zero|one|two|three|four|five|six|seven|eight|nine)'
const SOCIALS = '(?:instagram|insta|facebook|fejsbuk|fejs|messenger|viber|vajber|whatsapp|whats\\s?app|telegram|tiktok|tik\\s?tok|snapchat|linkedin|skype|discord)'

const RULES = [
  ['phone', /(?:\+|00)\s?387[\s./()-]*\d{1,2}[\s./()-]*\d{2,3}[\s./()-]*\d{2,4}(?:[\s./()-]*\d{1,3})?/i, true],
  ['phone', /\b0\d{2}[\s./()-]*\d{3}[\s./()-]*\d{3,4}\b/, true],
  ['phone', /\b0\d{2}[\s./()-]*\d{2}[\s./()-]*\d{2}[\s./()-]*\d{2,3}\b/, true],
  ['phone', /\b0\d{7,9}\b/, true],
  ['phone', /\b38\d{9,10}\b/, true],
  ['phone', /\b\d{9,11}\b/, true],
  ['phone', new RegExp(`${NUM_WORD}(?:[\\s,.-]+${NUM_WORD}){4,}`, 'i'), true],
  ['email', /[A-Za-z0-9._%+-]+(?:@|\s?\(at\)\s?|\s?\[at\]\s?)[A-Za-z0-9-]+(?:\.|\s?\(dot\)\s?|\s?\[dot\]\s?)[A-Za-z]{2,}/i, false],
  ['url', /(?:https?:\/\/|www\.)\S+/i, false],
  ['url', /\b[a-z0-9-]+\.(?:com|ba|net|org|io|me|info|eu|rs|hr|de|at|ch|co|app|site|online|shop)\b(?:\/\S*)?/i, false],
  ['url', /\b(?:wa\.me|t\.me)\b\S*/i, false],
  ['social', new RegExp(`\\b${SOCIALS}[a-z]{0,3}\\b`, 'i'), false],
  ['social', /\b(?:ig|fb|snap)\b\s*(?::|@|-)?\s*@?[A-Za-z0-9_.]{3,}/i, false],
  ['handle', /(?:^|[\s(,;])@[A-Za-z0-9_.]{3,}/, false],
  ['member_id', /\bPB-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}\b/i, false],
]

// Same normalisation as the database: join separated digits, letters-for-digits.
const normalizeDigits = (text) => {
  let out = text.replace(/([0-9oOlI])[\s._/-]+(?=[0-9oOlI])/g, '$1')
  for (let i = 0; i < 4; i += 1) {
    out = out.replace(/(\d)[oO]/g, '$10').replace(/[oO](\d)/g, '0$1').replace(/(\d)[lI]/g, '$11').replace(/[lI](\d)/g, '1$1')
  }
  return out
}

export const CONTACT_KIND_LABEL = {
  phone: 'broj telefona',
  email: 'email adresu',
  url: 'link',
  social: 'društvenu mrežu',
  handle: 'korisničko ime (@)',
  member_id: 'privatni ID',
  image_contact: 'kontakt na slici',
  prohibited: 'zabranjen sadržaj (oružje, droga, falsifikati…)',
}

/** Scan one or more texts. Returns { clean, kinds } — kinds are the rule names that matched. */
export const scanContactInfo = (...texts) => {
  const text = texts.filter(Boolean).join('\n')
  if (!text.trim()) return { clean: true, kinds: [] }
  const norm = normalizeDigits(text)
  const kinds = new Set()
  for (const [kind, pattern, useNorm] of RULES) {
    if (pattern.test(text) || (useNorm && pattern.test(norm))) kinds.add(kind)
  }
  return { clean: kinds.size === 0, kinds: [...kinds].sort() }
}

/** Friendly Bosnian explanation for a failed scan (or null when clean). */
export const contactInfoMessage = (scan, context = 'tekst') => {
  if (!scan || scan.clean) return null
  const what = scan.kinds.map((kind) => CONTACT_KIND_LABEL[kind] || kind)
  const list = what.length === 1 ? what[0] : `${what.slice(0, -1).join(', ')} i ${what[what.length - 1]}`
  return `Pravilo #1: izgleda da ${context} sadrži ${list}. Kontakti i društvene mreže nisu dozvoljeni na Poso.ba — sva komunikacija ide kroz platformu. Ukloni to pa pokušaj ponovo.`
}

/** Chat-specific check: contacts only before acceptance, illegal content always. */
export const scanChatMessage = (text, contactsAllowed) => {
  const prohibited = findProhibitedTerm(text)
  if (prohibited) return { clean: false, kinds: ['prohibited'], term: prohibited }
  if (contactsAllowed) return { clean: true, kinds: [] }
  return scanContactInfo(text)
}

export const RULE_ONE_TEXT = 'Pravilo #1: bez brojeva telefona, emaila, linkova i društvenih mreža — u tekstu i na slikama. Kontakt se razmjenjuje tek nakon prihvaćene ponude, kroz poruke.'
