import BrandMark from '../components/BrandMark'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArcHeadline } from '../components/HeroArt'
import { BroomMascot, WrenchMascot, BoxMascot, RollerMascot, LaptopMascot } from './Mascots'
import { haptic } from '../utils/native'
import { dropBootScreen } from '../utils/boot'
import { useFullscreen } from './useFullscreen'
import './app.css'

/* Rotating "URADI ___ ODMAH" scenes: a colour and one of our illustrations. */
const SCENES = [
  { key: 'cleaning', word: 'ČIŠĆENJE', color: '#0d2a52', Mascot: BroomMascot },
  { key: 'repairs', word: 'POPRAVKE', color: '#b86f00', Mascot: WrenchMascot },
  { key: 'moving', word: 'SELIDBU', color: '#1d7a4f', Mascot: BoxMascot },
  { key: 'painting', word: 'KREČENJE', color: '#163a6b', Mascot: RollerMascot },
  { key: 'anything', word: 'BILO ŠTA', color: '#061530', Mascot: LaptopMascot },
]

/** First screen of the phone app for visitors: one big promise, "Počni" and "Prijava". */
function Welcome() {
  useFullscreen()
  const [index, setIndex] = useState(0)
  // the pre-rendered copy of this screen (index.html) has done its job once we are on screen
  useEffect(() => { dropBootScreen() }, [])

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
        <div className="wl-brand"><BrandMark size={28} tile={false} /> Poso.ba</div>
        <ArcHeadline top={`URADI ${scene.word}`} bottom="ODMAH." id="wl-arc" as="div" className="wl-arc" />
        <div className="wl-card"><Mascot /></div>
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
