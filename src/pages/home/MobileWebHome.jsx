import { Link } from 'react-router-dom'
import { ArrowRight, Star } from 'lucide-react'
import { ArcHeadline, HeroStars } from '../../components/HeroArt'
import { BosniaArt, SCENES, useShuffle } from '../../components/BosniaArt'
import { serviceCategories } from '../../data/categories'
import { usePlatformStats } from '../../hooks/usePlatformStats'

const SHOWN = [
  ['handyman', 'popravke u kući'],
  ['cleaning', 'stan, kuća, ured'],
  ['moving-transport', 'kombi i nosači'],
  ['electrician', 'instalacije'],
  ['gardening', 'košenje, sadnja'],
  ['it-support', 'računari, mreža'],
]
const STEPS = [
  ['Objavi posao', 'Opiši šta ti treba i koliko nudiš.'],
  ['Stižu ponude', 'Majstori iz tvog grada šalju cijene.'],
  ['Izaberi i riješi', 'Plaćaš tek kad je posao gotov.'],
]

/** Home page in a phone browser: the same hero as the desktop, stacked for one hand. The apps keep the Welcome screen. */
function MobileWebHome() {
  const sceneIndex = useShuffle(SCENES.length, 9000)
  const { proof, loading } = usePlatformStats()

  return (
    <main className="mw-home">
      <section className="mw-hero">
        <HeroStars />
        <ArcHeadline id="mw-arc" />
        <p className="mw-tagline">Objavi posao. Izaberi najboljeg. Riješeno.</p>
        <Link to="/objavi" className="hero-btn hero-btn-primary mw-btn">Objavi posao besplatno <ArrowRight size={18} /></Link>
        <Link to="/zaradi" className="hero-btn hero-btn-light mw-btn">Zaradi kao izvođač</Link>
        <div className={`mw-proof ${loading ? 'is-loading' : ''}`}>
          {proof.slice(0, 2).map(({ key, value, label }) => <span key={key}><Star size={13} /> <strong>{value}</strong> {label}</span>)}
        </div>
        <div className="mw-scene" aria-hidden="true">
          {SCENES.map((scene, i) => (
            <div key={scene.key} className={`mw-scene-pair bz-turn ${i === sceneIndex ? 'is-on' : ''}`}>
              <BosniaArt name={scene.left} className="mw-scene-left" />
              <BosniaArt name={scene.right} className="mw-scene-right" />
            </div>
          ))}
        </div>
      </section>

      <div className="mw-head"><h2>Šta ti treba?</h2><Link to="/search">Sve ›</Link></div>
      <div className="mw-cats">
        {SHOWN.map(([id, hint]) => {
          const category = serviceCategories.find((item) => item.id === id)
          if (!category) return null
          const Icon = category.icon
          return (
            <Link key={id} to={`/search?category=${encodeURIComponent(category.name)}`} className="mw-cat">
              <span className="mw-cat-icon"><Icon size={20} /></span>
              <strong>{category.name}</strong>
              <small>{hint}</small>
            </Link>
          )
        })}
      </div>

      <section className="mw-steps">
        <h2>Kako radi</h2>
        <ol>
          {STEPS.map(([title, text], i) => (
            <li key={title}><b>{i + 1}</b><p><strong>{title}</strong>{text}</p></li>
          ))}
        </ol>
        <Link to="/kako-radi" className="mw-more">Više o tome kako radi →</Link>
      </section>
    </main>
  )
}

export default MobileWebHome
