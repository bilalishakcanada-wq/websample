import { serviceCategories } from '../data/categories'

/* keyword → category id; matched against the folded (no diacritics) title + description */
const RULES = [
  ['cleaning', ['cisc', 'ciscenje', 'pospremanje', 'usisav', 'pranje prozora', 'generalno', 'higijen', 'tepih']],
  ['moving-transport', ['selidb', 'prevoz namjest', 'kombi', 'kamion', 'transport', 'prenos', 'preseljenje']],
  ['delivery', ['dostav', 'kurir', 'paket', 'prevoz', 'pick up']],
  ['plumber', ['slavin', 'cijev', 'vodoinst', 'bojler', 'wc', 'kupatil', 'odvod', 'curi', 'sifon', 'ventil']],
  ['electrician', ['struj', 'elektr', 'uticnic', 'prekidac', 'rasvjet', 'lampa', 'osigurac', 'kabl']],
  ['painting', ['krec', 'farb', 'moler', 'gletov', 'boj', 'zid']],
  ['carpentry', ['stolar', 'drvo', 'vrata', 'polic', 'ormar', 'kuhinjski element', 'lamperij']],
  ['furniture', ['montaz', 'sastav', 'ikea', 'namjest', 'krevet', 'sto ', 'stolic']],
  ['gardening', ['bast', 'vrt', 'kosi', 'trav', 'ziva ograda', 'orezi', 'drvec', 'cvijec']],
  ['childcare', ['djec', 'dijete', 'beb', 'dadilj', 'cuvanje djece']],
  ['pets', ['pas', 'psa', 'mack', 'ljubim', 'setanje', 'pet ']],
  ['tutoring', ['instrukc', 'poduc', 'matemat', 'fizik', 'hemij', 'ispit', 'ucenj', 'skol']],
  ['languages', ['engles', 'njemac', 'jezik', 'konverzac', 'prevod']],
  ['it-support', ['racunar', 'laptop', 'kompjut', 'windows', 'mrez', 'wifi', 'printer', 'instalac', 'virus', 'web', 'sajt', 'aplikac', 'program']],
  ['design', ['dizajn', 'logo', 'grafik', 'banner', 'vizual', 'ilustrac', 'flajer']],
  ['photo-video', ['fotograf', 'video', 'snimanj', 'montaza videa', 'kamer', 'slikanje']],
  ['events', ['event', 'proslav', 'rodjendan', 'vjencanj', 'svadb', 'dj ', 'organizac']],
  ['catering', ['catering', 'kuvar', 'kuhar', 'kolac', 'tort', 'hran', 'jelo']],
  ['beauty', ['frizer', 'sisanj', 'sminka', 'nokt', 'masaz', 'kozmet', 'wellness', 'brij']],
  ['fitness', ['trener', 'trening', 'fitnes', 'teretan', 'joga', 'mrsav']],
  ['auto', ['auto', 'vozil', 'mehanic', 'gume', 'motor', 'servis auta', 'akumulator']],
  ['legal', ['pravn', 'advokat', 'ugovor', 'tuzb', 'notar']],
  ['accounting', ['knjigovod', 'racunovod', 'porez', 'pdv', 'finansij', 'bilans']],
  ['renovation', ['renov', 'adaptac', 'gradjev', 'zidanj', 'plocic', 'keramic', 'fasad', 'krov', 'beton', 'gips', 'laminat', 'parket']],
  ['climate', ['klim', 'grijanj', 'kotao', 'radijator', 'ventilac']],
  ['marketing', ['marketing', 'instagram', 'facebook', 'oglas', 'reklam', 'drustven', 'seo', 'sadrzaj']],
  ['handyman', ['majstor', 'popravk', 'popravi', 'sitne', 'busenje', 'vjesanje', 'tv nosac', 'mont']],
]

const fold = (text) => String(text || '').toLowerCase()
  .replace(/[čć]/g, 'c').replace(/š/g, 's').replace(/ž/g, 'z').replace(/đ/g, 'dj')

/** Best-guess category name for a job text, or '' when nothing matches. */
export function guessCategory(title, description = '') {
  const text = ` ${fold(`${title} ${description}`)} `
  let best = null
  for (const [id, words] of RULES) {
    const score = words.reduce((sum, word) => sum + (text.includes(word) ? (word.length > 5 ? 2 : 1) : 0), 0)
    if (score > 0 && (!best || score > best.score)) best = { id, score }
  }
  if (!best) return ''
  return serviceCategories.find((item) => item.id === best.id)?.name || ''
}
