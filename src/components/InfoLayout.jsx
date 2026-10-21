import { Link, useLocation } from 'react-router-dom'
import { ArrowRight, ChevronRight } from 'lucide-react'
import BackHome from './BackHome'
import { pageByPath, relatedPages } from '../data/siteMap'
import { useRevealOnScroll } from '../hooks/useRevealOnScroll'

function InfoLayout({ eyebrow, title, lead, children, cta, wide = false }) {
  const { pathname } = useLocation()
  const page = pageByPath(pathname)
  const related = relatedPages(pathname)
  useRevealOnScroll()

  return (
    <div className="app-shell page-with-mobile-nav info-page">
      <header className="app-page-header info-header">
        <div>
          <BackHome />
          <nav className="breadcrumbs" aria-label="Putanja">
            <Link to="/">Početna</Link><ChevronRight size={14} />
            <span>{page?.title || title}</span>
          </nav>
          {eyebrow && <span className="eyebrow small-eyebrow">{eyebrow}</span>}
          <h1>{title}</h1>
          {lead && <p className="info-lead">{lead}</p>}
        </div>
      </header>

      <main className={`content-container ${wide ? 'content-wide' : 'content-narrow'}`}>
        {children}

        {cta && (
          <section className="cta-strip reveal">
            <div>
              {cta.eyebrow && <span className="eyebrow small-eyebrow">{cta.eyebrow}</span>}
              <h2>{cta.text}</h2>
            </div>
            <Link to={cta.to} className="primary-button">{cta.label} <ArrowRight size={16} /></Link>
          </section>
        )}

        {related.length > 0 && (
          <section className="related-pages reveal">
            <h2>Istraži dalje</h2>
            <div className="related-grid">
              {related.map((item) => (
                <Link key={item.path} to={item.path} className="related-card">
                  <strong>{item.title}</strong>
                  <span>{item.short}</span>
                  <ArrowRight size={16} />
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

export default InfoLayout
