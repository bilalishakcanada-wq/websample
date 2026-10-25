import { useEffect, useState } from 'react'
import { withBase } from '../../utils/paths'

// Real photos of the work people pay for on Zadatak; the card shows one and changes it every two minutes.
const PHOTOS = [
  ['/images/categories/electrician.webp', 'Električar', '62% 30%'],
  ['/images/categories/home.webp', 'Majstor za sve', '50% 50%'],
  ['/images/categories/cleaning.webp', 'Čišćenje', '40% 35%'],
  ['/images/categories/construction.webp', 'Gradnja', '55% 40%'],
  ['/images/jobs/elektrika.webp', 'Elektroinstalacije', '60% 40%'],
]
const EVERY = 2 * 60 * 1000

/** Photo side of the balance card, with a slow crossfade to the next photo. */
function BalanceArt() {
  const [index, setIndex] = useState(() => Math.floor(Date.now() / EVERY) % PHOTOS.length)
  useEffect(() => {
    const timer = window.setInterval(() => { if (!document.hidden) setIndex((i) => (i + 1) % PHOTOS.length) }, EVERY)
    return () => window.clearInterval(timer)
  }, [])
  return (
    <div className="bal-photo" aria-hidden="true">
      {PHOTOS.map(([src, label, position], i) => (
        <img key={src} src={withBase(src)} alt="" loading={i === index ? 'eager' : 'lazy'} decoding="async" className={i === index ? 'is-on' : ''} style={{ objectPosition: position }} />
      ))}
      <span className="bal-photo-tag" key={index}>{PHOTOS[index][1]}</span>
    </div>
  )
}

export default BalanceArt
