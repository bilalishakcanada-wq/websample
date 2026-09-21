import { SITE_PAGES } from '../data/siteMap'

const BRAND = 'Poso.ba'
const STATIC = {
  '/': 'Poso.ba — Objavi posao, izaberi najboljeg. Riješeno.',
  '/search': 'Pretraži poslove',
  '/objavi': 'Objavi posao',
  '/start': 'Dobro došao/la',
  '/intro': 'Kako radi Poso.ba',
  '/moji-poslovi': 'Moji poslovi',
  '/messages': 'Poruke',
  '/login': 'Prijava',
  '/register': 'Registracija',
  '/forgot-password': 'Zaboravljena lozinka',
  '/reset-password': 'Nova lozinka',
  '/dashboard': 'Nadzorna ploča',
  '/account': 'Moj nalog',
  '/account/profil': 'Profil',
  '/account/ploca': 'Ploča izvođača',
  '/account/placanja': 'Historija plaćanja',
  '/account/nacini-placanja': 'Načini plaćanja',
  '/account/novcanik': 'Balans',
  '/account/obavijesti': 'Obavijesti',
  '/account/vjestine': 'Vještine',
  '/account/znacke': 'Značke',
  '/account/portfolio': 'Portfolio',
  '/account/postavke': 'Postavke',
  '/account/alarmi': 'Alarmi za poslove',
  '/account/informacije': 'Informacije o nalogu',
  '/account/placanje': 'Opcije plaćanja',
  '/account/postavke-obavijesti': 'Postavke obavijesti',
  '/nivoi': 'Nivoi i naknade',
  '/admin': 'Admin',
  '/mod': 'Moderacija',
  '/403': 'Nemaš pristup',
  '/404': 'Stranica nije pronađena',
}

/** Title for a static route: the sitemap knows the info pages, the map above the rest. */
export function titleFor(pathname) {
  const clean = pathname.replace(/\/+$/, '') || '/'
  if (STATIC[clean]) return clean === '/' ? STATIC[clean] : `${STATIC[clean]} · ${BRAND}`
  const page = SITE_PAGES.find((item) => item.path === clean)
  if (page) return `${page.title} · ${BRAND}`
  if (clean.startsWith('/listings/')) return `Posao · ${BRAND}`
  if (clean.startsWith('/korisnik/')) return `Profil · ${BRAND}`
  return BRAND
}

/** Pages with data (a job, a profile) call this once they know the name. */
export function setPageTitle(text) {
  document.title = text ? `${text} · ${BRAND}` : BRAND
}
