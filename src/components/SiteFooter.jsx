import { Link, useLocation } from 'react-router-dom'
import { Mail, MessageCircle, ShieldCheck } from 'lucide-react'
import { FOOTER_GROUPS, POPULAR_CATEGORIES, POPULAR_CITIES, SITE_PAGES } from '../data/siteMap'

const HIDDEN_ON = ['/login', '/register', '/forgot-password', '/reset-password', '/admin', '/mod']

const COLUMNS = [
  ...FOOTER_GROUPS.map((group) => ({
    title: group.title,
    links: [
      ...SITE_PAGES.filter((page) => page.group === group.id).map((page) => [page.title, page.path]),
      ...(group.extra || []),
    ],
  })),
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
