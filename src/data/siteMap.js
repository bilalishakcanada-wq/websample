// Single source of truth for every informational page on the site.
// The footer, the "Istraži dalje" block on each page and breadcrumbs all
// derive from this list, so adding a page here wires it up everywhere.

export const SITE_PAGES = [
  // ---- Otkrij
  { path: '/kako-radi', title: 'Kako radi', short: 'Od objave posla do završenog rada, korak po korak.', group: 'otkrij', related: ['/vodici', '/zaradi', '/pomoc'] },
  { path: '/za-biznis', title: 'Poso.ba za firme', short: 'Radna snaga na zahtjev, bez zapošljavanja.', group: 'otkrij', related: ['/kako-radi', '/cijene', '/kontakt'] },
  { path: '/zaradi', title: 'Zaradi novac', short: 'Postani izvođač i pronađi poslove u svom gradu.', group: 'otkrij', related: ['/principi-izvodjaca', '/kako-radi', '/vodici'] },
  { path: '/search', title: 'Pretraži poslove', short: 'Svi otvoreni poslovi na listi i mapi.', group: 'otkrij', app: true },
  { path: '/vodici', title: 'Vodiči za cijene', short: 'Koliko košta posao — iz stvarnih oglasa.', group: 'otkrij', related: ['/kako-radi', '/search', '/cijene'] },
  { path: '/pomoc', title: 'Često postavljena pitanja', short: 'Odgovori na najčešća pitanja i live chat.', group: 'otkrij', related: ['/kako-radi', '/kontakt', '/pravila'] },
  { path: '/cijene', title: 'Planovi i cijene', short: 'Šta je besplatno, a šta donose planovi.', group: 'otkrij', related: ['/kako-radi', '/za-biznis', '/pomoc'] },

  // ---- Kompanija
  { path: '/o-nama', title: 'O nama', short: 'Ko smo, zašto Poso.ba postoji i kuda ide.', group: 'kompanija', related: ['/kako-radi', '/pravila-zajednice', '/kontakt'] },
  { path: '/pravila-zajednice', title: 'Pravila zajednice', short: 'Kako se ponašamo jedni prema drugima.', group: 'kompanija', related: ['/principi-izvodjaca', '/pravila', '/pomoc'] },
  { path: '/principi-izvodjaca', title: 'Principi izvođača', short: 'Šta klijenti mogu očekivati od svakog majstora.', group: 'kompanija', related: ['/zaradi', '/pravila-zajednice', '/kako-radi'] },
  { path: '/pravila', title: 'Uslovi korištenja', short: 'Pravila i uslovi korištenja platforme.', group: 'kompanija', related: ['/privatnost', '/pravila-zajednice', '/pomoc'] },
  { path: '/privatnost', title: 'Politika privatnosti', short: 'Koje podatke čuvamo i zašto.', group: 'kompanija', related: ['/pravila', '/kontakt', '/pomoc'] },
  { path: '/kontakt', title: 'Kontakt', short: 'Piši nam — odgovaramo u roku 24 sata.', group: 'kompanija', related: ['/pomoc', '/o-nama', '/za-biznis'] },

  // ---- Postojeći korisnici (app pages, no "related" block needed)
  { path: '/objavi', title: 'Objavi posao', short: 'Opiši šta ti treba i primi ponude.', group: 'korisnici', app: true },
  { path: '/login', title: 'Prijava', short: 'Prijava na račun.', group: 'korisnici', app: true },
  { path: '/dashboard', title: 'Nadzorna ploča', short: 'Tvoji oglasi, ponude i preporuke.', group: 'korisnici', app: true },
  { path: '/messages', title: 'Poruke', short: 'Razgovori sa klijentima i izvođačima.', group: 'korisnici', app: true },
]

export const FOOTER_GROUPS = [
  { id: 'otkrij', title: 'Otkrij' },
  { id: 'kompanija', title: 'Kompanija' },
  { id: 'korisnici', title: 'Postojeći korisnici', extra: [['Pretraži poslove', '/search'], ['Centar za pomoć', '/pomoc']] },
]

export const POPULAR_CATEGORIES = ['Majstor za sve', 'Čišćenje', 'Prevoz i dostava', 'Selidbe i transport', 'Baštovanstvo', 'Električar', 'Montaža namještaja']
export const POPULAR_CITIES = ['Sarajevo', 'Banja Luka', 'Tuzla', 'Zenica', 'Mostar', 'Bijeljina', 'Brčko']

export const pageByPath = (path) => SITE_PAGES.find((page) => page.path === path) || null

// Explicit "related" first, then the rest of the same group, never itself.
export function relatedPages(path, limit = 4) {
  const current = pageByPath(path)
  if (!current) return []
  const explicit = (current.related || []).map(pageByPath).filter(Boolean)
  const sameGroup = SITE_PAGES.filter((page) => page.group === current.group && page.path !== path && !page.app && !explicit.includes(page))
  return [...explicit, ...sameGroup].slice(0, limit)
}
