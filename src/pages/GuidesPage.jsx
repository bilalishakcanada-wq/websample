import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3, Info } from 'lucide-react'
import BackHome from '../components/BackHome'
import { serviceCategories } from '../data/categories'
import { contactService } from '../services/contactService'

const km = (value) => `${Number(value).toLocaleString('bs-BA')} KM`

function GuidesPage() {
  const [stats, setStats] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    contactService.categoryPriceStats()
      .then((rows) => active && setStats(rows))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [])

  const byCategory = new Map(stats.map((row) => [row.category, row]))
  const withData = serviceCategories.filter((category) => byCategory.get(category.name)?.priced_count > 0)
  const withoutData = serviceCategories.filter((category) => !byCategory.get(category.name)?.priced_count)

  return (
    <div className="app-shell page-with-mobile-nav info-page">
      <header className="app-page-header"><div><BackHome /><span className="eyebrow small-eyebrow">Vodiči za cijene</span><h1>Koliko košta posao u BiH?</h1></div></header>
      <main className="content-container">
        <p className="info-lead">
          Rasponi ispod se računaju iz <strong>stvarnih objavljenih oglasa</strong> na Poso.ba — ne iz procjena. Što više oglasa, to je slika tačnija.
        </p>
        <div className="info-note"><Info size={16} /> Medijan je "tipična" cijena: pola oglasa je ispod, pola iznad. Manje ga pomjeraju ekstremi nego prosjek.</div>

        {loading && <div className="skeleton-list">{[1, 2, 3].map((item) => <div className="skeleton-card" key={item} />)}</div>}

        {!loading && withData.length > 0 && (
          <section className="guide-grid">
            {withData.map(({ id, name, icon: Icon }) => {
              const row = byCategory.get(name)
              return (
                <article className="guide-card" key={id}>
                  <div className="guide-card-head"><Icon size={20} /><h2>{name}</h2></div>
                  <div className="guide-median"><span>Tipična cijena</span><strong>{km(row.median_price)}</strong></div>
                  <dl className="guide-range">
                    <div><dt>Najniža</dt><dd>{km(row.min_price)}</dd></div>
                    <div><dt>Prosjek</dt><dd>{km(row.avg_price)}</dd></div>
                    <div><dt>Najviša</dt><dd>{km(row.max_price)}</dd></div>
                  </dl>
                  <small><BarChart3 size={13} /> Na osnovu {row.priced_count} {row.priced_count === 1 ? 'oglasa' : 'oglasa'}</small>
                  <Link to={`/search?category=${encodeURIComponent(name)}`} className="text-link">Pogledaj poslove →</Link>
                </article>
              )
            })}
          </section>
        )}

        {!loading && withoutData.length > 0 && (
          <section className="info-section">
            <h2>Još nema dovoljno podataka</h2>
            <p className="muted-text">Za ove kategorije još nije objavljen oglas sa cijenom. Budi prvi — tvoj oglas puni ovaj vodič.</p>
            <div className="trade-chips">
              {withoutData.map(({ id, name }) => (
                <Link key={id} to={`/objavi`} className="trade-chip">{name}</Link>
              ))}
            </div>
          </section>
        )}

        <section className="cta-strip">
          <div><span className="eyebrow small-eyebrow">Imaš posao?</span><h2>Objavi ga i dobij ponude umjesto nagađanja.</h2></div>
          <Link to="/objavi" className="primary-button">Objavi posao</Link>
        </section>
      </main>
    </div>
  )
}

export default GuidesPage
