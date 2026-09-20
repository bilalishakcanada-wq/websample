import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, CircleCheck, Coins } from 'lucide-react'
import { setMode } from './mode'
import { haptic } from '../utils/native'
import { useFullscreen } from './useFullscreen'
import './app.css'

const GOALS = [
  { id: 'poster', icon: CircleCheck, title: 'Uradi posao', sub: 'Nađi izvođača' },
  { id: 'tasker', icon: Coins, title: 'Zaradi novac', sub: 'Postani izvođač' },
]

/** "Šta ti je glavni cilj?" — picks the app face (poster / tasker); changeable later in the account. */
function StartGoal() {
  useFullscreen()
  const navigate = useNavigate()
  const [choice, setChoice] = useState('')

  const next = () => {
    setMode(choice)
    haptic('light')
    navigate('/intro')
  }

  return (
    <div className="ap ap-screen">
      <header className="ap-top">
        <button type="button" className="ap-back" onClick={() => navigate(-1)} aria-label="Nazad"><ArrowLeft size={22} /></button>
      </header>

      <h1 className="ap-title">Šta ti je glavni cilj?</h1>
      <p className="ap-sub">Možeš promijeniti kasnije.</p>

      <div className="ap-goals">
        {GOALS.map(({ id, icon: Icon, title, sub }) => (
          <button key={id} type="button" className={`ap-goal ${choice === id ? 'active' : ''}`} onClick={() => { setChoice(id); haptic('light') }} aria-pressed={choice === id}>
            <Icon size={22} />
            <strong>{title}</strong>
            <span>{sub}</span>
          </button>
        ))}
      </div>

      <div className="ap-foot">
        <button type="button" className="ap-btn ap-btn-primary" disabled={!choice} onClick={next}>Nastavi</button>
      </div>
    </div>
  )
}

export default StartGoal
