import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, ClipboardList, ShieldCheck, Wallet } from 'lucide-react'
import TrustArt from './TrustArt'
import EarnArt from './EarnArt'
import { haptic } from '../utils/native'

const SEEN_KEY = 'poso-tour-seen'

/** Phone with a job form and the gold "+" — slide one. */
function PostArt() {
  return (
    <svg className="post-art" viewBox="0 0 480 600" role="img" aria-label="Telefon sa formom za objavu posla">
      <rect width="480" height="600" rx="30" fill="#0d2a52" />
      <circle cx="240" cy="300" r="190" fill="#163a6b" opacity="0.5" />
      <circle cx="70" cy="90" r="46" fill="#f5b400" opacity="0.12" />
      <circle cx="420" cy="520" r="60" fill="#f5b400" opacity="0.1" />
      <g transform="translate(140 110)">
        <rect x="0" y="0" width="200" height="380" rx="30" fill="#061530" />
        <rect x="12" y="14" width="176" height="352" rx="22" fill="#ffffff" />
        <rect x="70" y="24" width="60" height="8" rx="4" fill="#dfe6f1" />
        <rect x="30" y="56" width="110" height="12" rx="6" fill="#0d2a52" />
        <rect x="30" y="84" width="140" height="30" rx="10" fill="#f3f5f9" stroke="#dfe6f1" strokeWidth="2" />
        <rect x="30" y="126" width="140" height="30" rx="10" fill="#f3f5f9" stroke="#dfe6f1" strokeWidth="2" />
        <rect x="30" y="168" width="140" height="70" rx="12" fill="#f3f5f9" stroke="#dfe6f1" strokeWidth="2" />
        <rect x="40" y="182" width="90" height="8" rx="4" fill="#c9d3e3" />
        <rect x="40" y="200" width="110" height="8" rx="4" fill="#c9d3e3" />
        <rect x="40" y="218" width="70" height="8" rx="4" fill="#c9d3e3" />
        <rect x="30" y="262" width="140" height="40" rx="14" fill="#f5b400" />
        <rect x="70" y="278" width="60" height="8" rx="4" fill="#0d2a52" />
        <rect x="80" y="344" width="40" height="6" rx="3" fill="#dfe6f1" />
      </g>
      <g transform="translate(330 400)">
        <circle r="46" fill="#f5b400" />
        <rect x="-4" y="-22" width="8" height="44" rx="4" fill="#0d2a52" />
        <rect x="-22" y="-4" width="44" height="8" rx="4" fill="#0d2a52" />
      </g>
      <g fill="#f5b400" opacity="0.9">
        <path d="M96 420 l6 14 14 6 -14 6 -6 14 -6 -14 -14 -6 14 -6z" />
        <path d="M400 150 l4 10 10 4 -10 4 -4 10 -4 -10 -10 -4 10 -4z" />
      </g>
    </svg>
  )
}

const SLIDES = [
  { icon: ClipboardList, title: 'Opiši šta ti treba', text: 'Objavi posao u par koraka — od popravke slavine do web dizajna. Besplatno.', art: <PostArt /> },
  { icon: ShieldCheck, title: 'Izaberi provjerenog izvođača', text: 'Ponude stižu brzo. Gledaš ocjene, značke i profil prije nego što se odlučiš.', art: <TrustArt /> },
  { icon: Wallet, title: 'Plati tek kad je gotovo', text: 'Poso.ba Pay čuva novac dok posao ne bude urađen. Bez rizika za obje strane.', art: <EarnArt /> },
]

const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true || document.documentElement.classList.contains('is-native')

/** Three-slide intro on the first launch of the installed app (never on the plain website). */
function WelcomeTour() {
  const navigate = useNavigate()
  const [show, setShow] = useState(false)
  const [index, setIndex] = useState(0)
  const trackRef = useRef(null)

  useEffect(() => {
    let seen = true
    try { seen = localStorage.getItem(SEEN_KEY) === '1' } catch { /* private mode */ }
    // ?tour=1 previews it anywhere (handy for the team)
    const forced = new URLSearchParams(window.location.search).get('tour') === '1'
    if (forced || (!seen && isStandalone())) setShow(true)
  }, [])

  useEffect(() => {
    if (!show) return undefined
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [show])

  if (!show) return null

  const finish = (to) => {
    try { localStorage.setItem(SEEN_KEY, '1') } catch { /* ignore */ }
    setShow(false)
    if (to) navigate(to)
  }

  const goTo = (next) => {
    const clamped = Math.max(0, Math.min(SLIDES.length - 1, next))
    setIndex(clamped)
    haptic('light')
    trackRef.current?.scrollTo({ left: clamped * trackRef.current.clientWidth, behavior: 'smooth' })
  }

  const onScroll = () => {
    const track = trackRef.current
    if (!track) return
    const next = Math.round(track.scrollLeft / track.clientWidth)
    if (next !== index) setIndex(next)
  }

  const last = index === SLIDES.length - 1

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-label="Dobrodošli na Poso.ba">
      <button type="button" className="tour-skip" onClick={() => finish()}>Preskoči</button>
      <div className="tour-track" ref={trackRef} onScroll={onScroll}>
        {SLIDES.map((slide) => {
          const Icon = slide.icon
          return (
            <section className="tour-slide" key={slide.title}>
              <div className="tour-art">{slide.art}</div>
              <span className="tour-icon"><Icon size={20} /></span>
              <h2>{slide.title}</h2>
              <p>{slide.text}</p>
            </section>
          )
        })}
      </div>
      <div className="tour-foot">
        <div className="tour-dots" aria-hidden="true">
          {SLIDES.map((slide, i) => <span key={slide.title} className={i === index ? 'active' : ''} />)}
        </div>
        {last ? (
          <div className="tour-actions">
            <button type="button" className="primary-button" onClick={() => finish('/objavi')}>Objavi posao</button>
            <button type="button" className="ghost-button" onClick={() => finish('/search')}>Pregledaj poslove</button>
          </div>
        ) : (
          <button type="button" className="primary-button tour-next" onClick={() => goTo(index + 1)}>Dalje <ArrowRight size={16} /></button>
        )}
      </div>
    </div>
  )
}

export default WelcomeTour
