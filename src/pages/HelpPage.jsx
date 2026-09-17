import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, BookOpen, ChevronDown, Mail, MessageCircle, Search, ShieldCheck } from 'lucide-react'
import ContactForm from '../components/ContactForm'
import { HELP_ARTICLES, HELP_AUDIENCES, searchHelp } from '../data/helpArticles'

/** Isometric-ish navy/gold blocks for the help hero — drawn in code, no stock art. */
function HelpArt({ side }) {
  const tiles = side === 'left'
    ? [[20, 120, 90, '#f5b400'], [110, 70, 70, '#1b4a8a'], [70, 200, 110, '#123c78'], [180, 150, 60, '#ffd257'], [0, 20, 60, '#123c78']]
    : [[40, 40, 80, '#123c78'], [130, 110, 100, '#f5b400'], [30, 190, 70, '#1b4a8a'], [160, 20, 60, '#ffd257'], [200, 210, 60, '#123c78']]
  return (
    <svg className={`help-art help-art-${side}`} viewBox="0 0 280 300" aria-hidden="true">
      {tiles.map(([x, y, s, c], index) => (
        <g key={index} transform={`translate(${x} ${y})`} opacity="0.95">
          <path d={`M${s / 2} 0 L${s} ${s / 4} L${s / 2} ${s / 2} L0 ${s / 4} Z`} fill={c} />
          <path d={`M0 ${s / 4} L${s / 2} ${s / 2} L${s / 2} ${s} L0 ${s * 0.75} Z`} fill={c} opacity="0.7" />
          <path d={`M${s} ${s / 4} L${s / 2} ${s / 2} L${s / 2} ${s} L${s} ${s * 0.75} Z`} fill={c} opacity="0.45" />
        </g>
      ))}
    </svg>
  )
}

function HelpPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('q') || '')
  const [audience, setAudience] = useState(searchParams.get('za') || '')
  const [open, setOpen] = useState(searchParams.get('clanak') || null)

  useEffect(() => {
    const next = {}
    if (query) next.q = query
    if (audience) next.za = audience
    if (open) next.clanak = open
    setSearchParams(next, { replace: true })
  }, [query, audience, open, setSearchParams])

  const results = useMemo(() => searchHelp(query, audience), [query, audience])
  const grouped = useMemo(() => HELP_AUDIENCES.map((group) => ({ ...group, items: results.filter((item) => item.audience === group.id) })).filter((group) => group.items.length > 0), [results])
  const popular = HELP_ARTICLES.filter((article) => ['post-job', 'fees', 'rule-one', 'contact-unlock', 'badges', 'photos'].includes(article.id))
  const openSupport = () => window.dispatchEvent(new CustomEvent('poso:open-support'))

  return (
    <div className="help-page">
      <section className="help-hero">
        <HelpArt side="left" />
        <HelpArt side="right" />
        <div className="help-hero-inner">
          <span className="help-eyebrow">Poso.ba pomoć</span>
          <h1>Kako ti možemo pomoći?</h1>
          <label className="help-hero-search">
            <Search size={20} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Postavi pitanje — npr. kako dobijam značke, koliko je naknada…" autoFocus />
            {query && <button type="button" onClick={() => setQuery('')} aria-label="Obriši">×</button>}
          </label>
        </div>
      </section>

      <main className="content-container help-body">
        <div className="help-audiences">
          {HELP_AUDIENCES.map((item) => (
            <button key={item.id} type="button" className={`help-audience ${audience === item.id ? 'active' : ''}`} onClick={() => setAudience(audience === item.id ? '' : item.id)}>
              <strong>{item.label}</strong>
              <span>{item.hint}</span>
            </button>
          ))}
        </div>

        {!query && !audience && (
          <section className="help-section">
            <h2>Najčešća pitanja</h2>
            <div className="help-popular">
              {popular.map((article) => (
                <button key={article.id} type="button" className="help-popular-card" onClick={() => { setAudience(article.audience); setOpen(article.id) }}>
                  <BookOpen size={16} /><span>{article.q}</span><ArrowRight size={15} />
                </button>
              ))}
            </div>
          </section>
        )}

        {grouped.length === 0 && (
          <section className="help-section help-empty">
            <h2>Nema odgovora za „{query}“</h2>
            <p className="muted-text">Pitaj nas direktno — asistent odgovara odmah, a tim preuzima sve što on ne zna.</p>
            <button type="button" className="primary-button" onClick={openSupport}><MessageCircle size={16} /> Otvori razgovor</button>
          </section>
        )}

        {grouped.map((group) => (
          <section className="help-section" key={group.id}>
            <h2>{group.label} <span className="muted-text">({group.items.length})</span></h2>
            <div className="faq-list">
              {group.items.map((item) => (
                <div key={item.id} className={`faq-item ${open === item.id ? 'open' : ''}`} id={`clanak-${item.id}`}>
                  <button type="button" className="faq-question" onClick={() => setOpen(open === item.id ? null : item.id)} aria-expanded={open === item.id}>
                    {item.q}<ChevronDown size={18} className="faq-chevron" />
                  </button>
                  {open === item.id && <p className="faq-answer">{item.a}</p>}
                </div>
              ))}
            </div>
          </section>
        ))}

        <section className="help-contact" id="kontakt">
          <div className="help-contact-cards">
            <button type="button" className="help-contact-card" onClick={openSupport}>
              <span className="help-contact-icon"><MessageCircle size={22} /></span>
              <strong>Razgovaraj s nama</strong>
              <span>Asistent odgovara odmah · tim obično u roku od par sati</span>
            </button>
            <a className="help-contact-card" href="#poruka">
              <span className="help-contact-icon"><Mail size={22} /></span>
              <strong>Pošalji poruku</strong>
              <span>Za duže upite i saradnju · odgovor u roku 24 h</span>
            </a>
            <Link className="help-contact-card" to="/pravila-zajednice">
              <span className="help-contact-icon"><ShieldCheck size={22} /></span>
              <strong>Pravila zajednice</strong>
              <span>Pravilo #1, sigurnost i šta nije dozvoljeno</span>
            </Link>
          </div>
          <div className="contact-card" id="poruka">
            <div>
              <h2>Piši nam</h2>
              <p className="muted-text">Nisi našao odgovor? Opiši problem i javit ćemo se na email.</p>
            </div>
            <ContactForm initialTopic={searchParams.get('tema') || 'other'} />
          </div>
        </section>
      </main>
    </div>
  )
}

export default HelpPage
