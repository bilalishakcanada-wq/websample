import { useEffect, useState } from 'react'
// unDraw illustrations by Katerina Limpitsouni (undraw.co, free for commercial use, no attribution needed)
import construction from '../../assets/balans/construction-workers.svg?raw'
import mechanic from '../../assets/balans/car-repair.svg?raw'
import moving from '../../assets/balans/delivery-truck.svg?raw'
import deal from '../../assets/balans/business-deal.svg?raw'
import painting from '../../assets/balans/painting-the-room.svg?raw'

// The jobs people pay for on Zadatak; the card shows one scene and changes it every two minutes.
const SCENES = [
  [construction, 'Gradnja'],
  [mechanic, 'Automehaničar'],
  [moving, 'Selidba i prevoz'],
  [deal, 'Dogovor s majstorom'],
  [painting, 'Moleraj'],
].map(([svg, label]) => [svg.replace('<svg ', '<svg preserveAspectRatio="xMidYMax meet" '), label])
const EVERY = 2 * 60 * 1000

/** Illustration side of the balance card, with a slow crossfade to the next scene. */
function BalanceArt() {
  const [index, setIndex] = useState(() => Math.floor(Date.now() / EVERY) % SCENES.length)
  useEffect(() => {
    const timer = window.setInterval(() => { if (!document.hidden) setIndex((i) => (i + 1) % SCENES.length) }, EVERY)
    return () => window.clearInterval(timer)
  }, [])
  return (
    <div className="bal-ill" aria-hidden="true">
      {SCENES.map(([svg, label], i) => (
        <div key={label} className={`bal-ill-scene${i === index ? ' is-on' : ''}`} dangerouslySetInnerHTML={{ __html: svg }} />
      ))}
      <span className="bal-ill-tag" key={index}>{SCENES[index][1]}</span>
    </div>
  )
}

export default BalanceArt
