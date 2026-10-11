import BrandMark from '../components/BrandMark'
import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArcHeadline } from '../components/HeroArt'
import { BosniaArt, useShuffle } from '../components/BosniaArt'
import { haptic } from '../utils/native'
import { dropBootScreen } from '../utils/boot'
import { useFullscreen } from './useFullscreen'
import './app.css'

/* "URADI ___ ODMAH" with one of our Bosnian drawings; a random other one every few seconds. */
const SCENES = [
  { key: 'popravke', word: 'POPRAVKE', color: '#0a1f63', art: 'stariMost' },
  { key: 'bilo-sta', word: 'BILO ŠTA', color: '#0b2a86', art: 'diver' },
  { key: 'ciscenje', word: 'ČIŠĆENJE', color: '#0a1f63', art: 'sebilj' },
  { key: 'selidbu', word: 'SELIDBU', color: '#0d2f94', art: 'dzezva' },
  { key: 'krecenje', word: 'KREČENJE', color: '#09227a', art: 'cevapi' },
  { key: 'montazu', word: 'MONTAŽU', color: '#0b2a86', art: 'navijac' },
]

/** First screen of the phone app for visitors: one big promise, "Počni" and "Prijava". */
function Welcome() {
  useFullscreen()
  const index = useShuffle(SCENES.length, 4200)
  // the pre-rendered copy of this screen (index.html) has done its job once we are on screen
  useEffect(() => { dropBootScreen() }, [])

  const scene = SCENES[index]

  return (
    <div className="wl" style={{ '--wl-color': scene.color }}>
      <div className="wl-stage" key={scene.key}>
        <div className="wl-brand"><BrandMark size={28} tile={false} /> Zadatak</div>
        <ArcHeadline top={`URADI ${scene.word}`} bottom="ODMAH." id="wl-arc" as="div" className="wl-arc" />
        <div className="wl-card"><BosniaArt name={scene.art} /></div>
        <div className="wl-dots" aria-hidden="true">
          {SCENES.map((item, i) => <span key={item.key} className={i === index ? 'active' : ''} />)}
        </div>
      </div>

      <div className="wl-sheet">
        <p>Dobro došli na Zadatak</p>
        <Link to="/start" className="wl-btn wl-btn-primary" onClick={() => haptic('light')}>Počni</Link>
        <Link to="/login" className="wl-btn wl-btn-dark">Prijava</Link>
        <Link to="/search" className="wl-link">Samo pogledaj poslove →</Link>
      </div>
    </div>
  )
}

export default Welcome
