import { Link, useLocation } from 'react-router-dom'
import { Mail, MessageCircle, ShieldCheck } from 'lucide-react'

const HIDDEN_ON = ['/login', '/register', '/forgot-password', '/reset-password', '/admin']

const POPULAR_CATEGORIES = ['Majstor za sve', 'Čišćenje', 'Prevoz i dostava', 'Selidbe i transport', 'Baštovanstvo', 'Električar', 'Montaža namještaja']
const POPULAR_CITIES = ['Sarajevo', 'Banja Luka', 'Tuzla', 'Zenica', 'Mostar', 'Bijeljina', 'Brčko']

const COLUMNS = [
  {
    title: 'Otkrij',
    links: [
      ['Kako radi', '/kako-radi'],
      ['Poso.ba za firme', '/za-biznis'],
      ['Zaradi novac', '/zaradi'],
      ['Pretraži poslove', '/search'],
      ['Vodiči za cijene', '/vodici'],
      ['Često postavljena pitanja', '/pomoc'],
      ['Planovi i cijene', '/#cijene'],
    ],
  },
  {
    title: 'Kompanija',
    links: [
      ['O nama', '/o-nama'],
      ['Pravila zajednice', '/pravila'],
      ['Principi izvođača', '/zaradi#principi'],
      ['Uslovi korištenja', '/pravila'],
      ['Politika privatnosti', '/privatnost'],
      ['Kontakt', '/pomoc#kontakt'],
    ],
  },
  {
    title: 'Postojeći korisnici',
    links: [
      ['Objavi posao', '/objavi'],
      ['Pretraži poslove', '/search'],
      ['Prijava', '/login'],
      ['Nadzorna ploča', '/dashboard'],
      ['Poruke', '/messages'],
      ['Centar za pomoć', '/pomoc'],
    ],
  },
  {
    title: 'Popularne kategorije',
    links: [
      ...POPULAR_CATEGORIES.map((name) => [name, `/search?category=${encodeURIComponent(name)}`]),
      ['Sve kategorije', '/search'],
    ],
  },
  {
    title: 'Popularne lokacije',
    links: POPULAR_CITIES.map((name) => [name, `/search?city=${encodeURIComponent(name)}`]),
  },
]

function FooterLink({ to, children }) {
  // Hash links to the homepage need a full navigation so the anchor is honoured.
  if (to.startsWith('/#')) return <a href={to}>{children}</a>
  return <Link to={to}>{children}</Link>
}

function SiteFooter() {
  const { pathname } = useLocation()
  if (HIDDEN_ON.some((prefix) => pathname.startsWith(prefix))) return null

  return (
    <footer className="site-footer-dark">
      <div className="site-footer-inner">
        <div className="site-footer-columns">
          {COLUMNS.map((column) => (
            <div className="site-footer-col" key={column.title}>
              <h4>{column.title}</h4>
              <ul>
                {column.links.map(([label, to]) => (
                  <li key={`${column.title}-${label}`}><FooterLink to={to}>{label}</FooterLink></li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="site-footer-bottom">
          <div className="site-footer-brand">
            <span className="brand-mark">P</span>
            <div>
              <strong>Poso.ba</strong>
              <span>Marketplace za usluge u Bosni i Hercegovini</span>
            </div>
          </div>
          <div className="site-footer-trust">
            <span><ShieldCheck size={14} /> Moderirani oglasi</span>
            <span><MessageCircle size={14} /> Zaštićena komunikacija</span>
            <a href="mailto:podrska@poso.ba"><Mail size={14} /> podrska@poso.ba</a>
          </div>
          <span className="site-footer-copy">© {new Date().getFullYear()} Poso.ba. Sva prava zadržana.</span>
        </div>
      </div>
    </footer>
  )
}

export default SiteFooter
