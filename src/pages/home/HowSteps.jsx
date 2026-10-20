import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, ShieldCheckIcon } from '@phosphor-icons/react'
import BrandMark from '../../components/BrandMark'

const STEPS = [
  { title: 'Objavite posao', text: 'Recite šta vam treba i postavite budget ili željeni termin.' },
  { title: 'Primite ponude', text: 'Primite ponude od provjerenih stručnjaka i usporedite rješenja.' },
  { title: 'Platite sigurno', text: 'Odaberite najbolju uslugu i plaćajte bez stresnog administriranja.' },
]

const STEP_MS = 6000

/** The first screen of the real post flow, with the example title typing itself in. */
function PostScreen() {
  return (
    <div className="hs-screen hs-post">
      <div className="hs-post-top">
        <ArrowLeftIcon size={20} />
        <span className="hs-post-progress"><span /></span>
        <span className="hs-post-cancel">Odustani</span>
      </div>
      <strong className="hs-post-title">Počni s naslovom</strong>
      <span className="hs-post-sub">U par riječi, šta ti treba?</span>
      <span className="hs-post-input">
        {[...'Selidba kauča'].map((char, index) => (
          <span key={index} className="hs-char" style={{ '--i': index }}>{char === ' ' ? '\u00a0' : char}</span>
        ))}
        <span className="hs-caret" />
      </span>
      <span className="hs-post-hint">Najviše 70 znakova</span>
      <span className="hs-post-next">Nastavi</span>
    </div>
  )
}

/** The job just posted, and the notifications the app sends when offers come in. */
function OffersScreen() {
  return (
    <div className="hs-screen hs-offers">
      <span className="hs-offers-head">Moji poslovi</span>
      <div className="hs-offers-job">
        <strong>Selidba kauča</strong>
        <span>Objavljeno upravo sada</span>
      </div>
      <div className="hs-note">
        <BrandMark size={30} />
        <div>
          <strong>Stigla je nova ponuda</strong>
          <span>Imate novu ponudu za „Selidba kauča“</span>
        </div>
      </div>
      <div className="hs-note hs-note-2">
        <BrandMark size={30} />
        <div>
          <strong>Nova ponuda</strong>
          <span>Imate novu ponudu za „Selidba kauča“</span>
        </div>
      </div>
    </div>
  )
}

/** Where the money is while the job is being done, as the app shows it. */
function PayScreen() {
  return (
    <div className="hs-screen hs-pay">
      <span className="hs-pay-icon"><ShieldCheckIcon size={30} weight="duotone" /></span>
      <strong className="hs-pay-title">Sigurno plaćanje</strong>
      <p>Novac se čuva na Zadatku i isplaćuje izvođaču tek kad potvrdiš da je posao završen.</p>
      <ol className="hs-pay-track">
        <li className="done"><span><CheckIcon size={12} weight="bold" /></span>Plaćeno</li>
        <li className="now"><span />Čuva se na Zadatku</li>
        <li><span />Posao je završen</li>
      </ol>
      <span className="hs-post-next hs-pay-btn">Potvrdi</span>
    </div>
  )
}

const SCREENS = [PostScreen, OffersScreen, PayScreen]

/** Home "how it works": the steps on the left, the matching app screen in a phone on the right. */
function HowSteps() {
  const [active, setActive] = useState(0)
  const [running, setRunning] = useState(false)
  const ref = useRef(null)

  // only moves on by itself while it is on screen and the pointer is not resting on it
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return undefined
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined
    const observer = new IntersectionObserver(([entry]) => setRunning(entry.isIntersecting), { threshold: 0.4 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!running) return undefined
    const timer = setTimeout(() => setActive((index) => (index + 1) % STEPS.length), STEP_MS)
    return () => clearTimeout(timer)
  }, [running, active])

  const Screen = SCREENS[active]

  return (
    <div
      className={`how-steps ${running ? 'is-running' : ''}`}
      ref={ref}
      style={{ '--step-ms': `${STEP_MS}ms` }}
      onMouseEnter={() => setRunning(false)}
      onMouseLeave={() => setRunning(!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)}
    >
      <div className="how-steps-copy">
        <h2>Jednostavno 3 koraka do željene usluge</h2>
        <ol className="how-steps-list">
          {STEPS.map((step, index) => (
            <li key={step.title} className={index === active ? 'active' : ''}>
              <button type="button" onClick={() => setActive(index)} aria-pressed={index === active}>
                <span className="how-steps-num">{index + 1}</span>
                <span className="how-steps-text">
                  <strong>{step.title}</strong>
                  <span>{step.text}</span>
                </span>
              </button>
              {index === active && <span className="how-steps-bar" key={active} />}
            </li>
          ))}
        </ol>
        <Link to="/objavi" className="steps-head-cta">Objavi posao <ArrowRightIcon size={18} /></Link>
      </div>

      <div className="how-steps-phone" aria-hidden="true">
        <div className="how-steps-device">
          <Screen key={active} />
        </div>
      </div>
    </div>
  )
}

export default HowSteps
