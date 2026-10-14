import { useEffect, useRef, useState } from 'react'
import { MapPin } from 'lucide-react'
import '../art/cityScenes.css'

const EVERY = 9000
const FADE = 1800
const still = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Footer panoramas of Bosnian cities, one after another with a slow crossfade.
 *  The drawings load only when the footer comes near, and stop moving while it is off screen. */
export function FooterCities({ className = '' }) {
  const ref = useRef(null)
  const [near, setNear] = useState(false)
  const [visible, setVisible] = useState(false)
  const [scenes, setScenes] = useState(null)
  // `leaving` is the city we just left: it stays underneath until the new one has faded in
  const [{ index, leaving }, setShow] = useState({ index: 0, leaving: null })

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setNear(true)
      setVisible(true)
      return undefined
    }
    const observer = new IntersectionObserver(([entry]) => {
      setVisible(entry.isIntersecting)
      if (entry.isIntersecting) setNear(true)
    }, { rootMargin: '300px 0px' })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!near || scenes) return undefined
    let live = true
    import('../art/cityScenes').then((mod) => { if (live) setScenes(mod.CITY_SCENES) })
    return () => { live = false }
  }, [near, scenes])

  useEffect(() => {
    if (!scenes || !visible || still()) return undefined
    const timer = window.setInterval(() => {
      if (!document.hidden) setShow((show) => ({ index: (show.index + 1) % scenes.length, leaving: show.index }))
    }, EVERY)
    return () => window.clearInterval(timer)
  }, [scenes, visible])

  useEffect(() => {
    if (leaving === null) return undefined
    const timer = window.setTimeout(() => setShow((show) => ({ ...show, leaving: null })), FADE + 100)
    return () => window.clearTimeout(timer)
  }, [leaving])

  return (
    <div ref={ref} className={`city-scenes ${visible ? '' : 'is-paused'} ${className}`.trim()} aria-hidden="true">
      {scenes?.map((scene, i) => (i === index || i === leaving) && (
        <div
          key={scene.key}
          className={`cs-layer${i === index ? ' is-current' : ''}${i === index && leaving !== null ? ' is-in' : ''}`}
          dangerouslySetInnerHTML={{ __html: scene.svg }}
        />
      ))}
      {scenes && <span className="cs-caption" key={scenes[index].key}><MapPin size={13} /> {scenes[index].name}</span>}
    </div>
  )
}
