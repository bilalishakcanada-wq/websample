import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useGoBack } from '../hooks/useGoBack'
import { useBackSteps } from '../hooks/useBackToClose'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useMode } from './mode'
import { WrenchMascot, FindMascot, WalletMascot, EarnMascot, BoxMascot } from './Mascots'
import { haptic } from '../utils/native'
import { useFullscreen } from './useFullscreen'
import './app.css'

const SLIDES = {
  poster: [
    { Art: WrenchMascot, title: 'Uradi bilo šta već danas', text: 'Šta god je na tvojoj listi — od popravke slavine do selidbe — mi ćemo to srediti.' },
    { Art: FindMascot, title: 'Pronađi provjerene majstore', text: 'Cijela zajednica stručnjaka s ocjenama i recenzijama, spremna da ti skine posao s liste.' },
    { Art: WalletMascot, title: 'Plati tek kad si zadovoljan', text: 'Novac je sigurno rezervisan na Poso.ba dok posao ne bude završen i ti ne oslobodiš uplatu.' },
  ],
  tasker: [
    { Art: BoxMascot, title: 'Biraj poslove u svojoj blizini', text: 'Novi poslovi stižu svaki dan — čišćenje, selidbe, popravke, IT, dizajn i još.' },
    { Art: FindMascot, title: 'Pošalji ponudu za minutu', text: 'Napiši cijenu i kratku poruku. Klijent bira tebe po ocjenama i profilu.' },
    { Art: EarnMascot, title: 'Naplati sigurno', text: 'Klijent plaća unaprijed na Poso.ba, a tebi zarada sjeda na balans čim posao potvrdi.' },
  ],
}

/** Three-slide intro after the goal, with a progress bar. Last slide leads into the real action. */
function Intro() {
  useFullscreen()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [mode] = useMode()
  const [index, setIndex] = useState(0)
  const goBack = useGoBack('/start')
  useBackSteps(index, 0, () => setIndex((i) => Math.max(0, i - 1)))
  const slides = SLIDES[mode] || SLIDES.poster
  const slide = slides[index]
  const Art = slide.Art
  const last = index === slides.length - 1
  const action = mode === 'tasker' ? { label: 'Pregledaj poslove', to: '/search' } : { label: 'Objavi posao', to: '/objavi' }

  const next = () => {
    haptic('light')
    if (last) navigate(action.to)
    else setIndex(index + 1)
  }

  return (
    <div className="ap ap-screen">
      <header className="ap-top">
        <button type="button" className="ap-back" onClick={() => (index === 0 ? goBack() : setIndex(index - 1))} aria-label="Nazad"><ArrowLeft size={22} /></button>
        <div className="ap-progress" aria-hidden="true"><span style={{ width: `${((index + 1) / slides.length) * 100}%` }} /></div>
      </header>

      <div className="ap-intro" key={index}>
        <div className="ap-intro-art"><Art /></div>
        <h1>{slide.title}</h1>
        <p>{slide.text}</p>
      </div>

      <div className="ap-foot ap-foot-split">
        {!user && <Link to={`/register?next=${encodeURIComponent(action.to)}`} className="ap-btn ap-btn-light">Registruj se</Link>}
        <button type="button" className="ap-btn ap-btn-primary" onClick={next}>{last ? action.label : 'Nastavi'}</button>
      </div>
    </div>
  )
}

export default Intro
