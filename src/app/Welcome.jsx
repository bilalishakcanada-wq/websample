import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArcHeadline } from '../components/HeroArt'
import { BroomMascot, WrenchMascot, BoxMascot, RollerMascot, LaptopMascot } from './Mascots'
import { withBase } from '../utils/paths'
import { haptic } from '../utils/native'
import { useFullscreen } from './useFullscreen'
import './app.css'

/* Rotating "URADI ___ ODMAH" scenes: colour, photo and a mascot sticker. */
const SCENES = [
  { key: 'cleaning', word: 'ČIŠĆENJE', color: '#0d2a52', photo: withBase('/images/categories/cleaning.webp'), Mascot: BroomMascot },
  { key: 'repairs', word: 'POPRAVKE', color: '#c47a00', photo: withBase('/images/categories/home.webp'), Mascot: WrenchMascot },
  { key: 'moving', word: 'SELIDBU', color: '#1d7a4f', photo: withBase('/images/categories/moving.webp'), Mascot: BoxMascot },
  { key: 'painting', word: 'KREČENJE', color: '#163a6b', photo: withBase('/images/categories/construction.webp'), Mascot: RollerMascot },
  { key: 'anything', word: 'BILO ŠTA', color: '#061530', photo: withBase('/images/categories/it.webp'), Mascot: LaptopMascot },
]

/** First screen of the phone app for visitors: one big promise, "Počni" and "Prijava". */
function Welcome() {
  useFullscreen()
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) return undefined
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % SCENES.length), 4200)
    return () => window.clearInterval(timer)
  }, [])

  const scene = SCENES[index]
  const Mascot = scene.Mascot

  return (
    <div className="wl" style={{ '--wl-color': scene.color }}>
      <div className="wl-stage" key={scene.key}>
        <div className="wl-brand">Poso.ba</div>
        <ArcHeadline top={`URADI ${scene.word}`} bottom="ODMAH." id="wl-arc" as="div" className="wl-arc" />
        <div className="wl-card">
          <img src={scene.photo} alt="" />
          <div className="wl-mascot"><Mascot /></div>
        </div>
        <div className="wl-dots" aria-hidden="true">
          {SCENES.map((item, i) => <span key={item.key} className={i === index ? 'active' : ''} />)}
        </div>
      </div>

      <div className="wl-sheet">
        <p>Dobro došli na Poso.ba</p>
        <Link to="/start" className="wl-btn wl-btn-primary" onClick={() => haptic('light')}>Počni</Link>
        <Link to="/login" className="wl-btn wl-btn-dark">Prijava</Link>
        <Link to="/search" className="wl-link">Samo pogledaj poslove →</Link>
      </div>
    </div>
  )
}

export default Welcome
