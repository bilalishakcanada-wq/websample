import { useLayoutEffect, useRef } from 'react'

const GOLD = '#f5b400'
const GOLD_LIGHT = '#ffd24d'
const INK = '#081b38'
const MINT = '#7bd389'

// Four-point sparkle, centred on the origin (viewBox -10 -10 20 20).
const STAR_PATH = 'M0-10C1-3 3-1 10 0 3 1 1 3 0 10-1 3-3 1-10 0-3-1-1-3 0-10Z'

// [x%, y%, size px] — two trails that "fly" out of the illustrations, like
// the stars on the BiH flag.
const STARS = [
  [3, 38, 14], [6, 46, 8], [9, 41, 18], [12, 50, 10], [15, 44, 7], [18, 55, 12], [8, 60, 9], [14, 66, 16],
  [20, 62, 8], [24, 70, 11], [28, 66, 7], [22, 48, 6],
  [78, 62, 9], [81, 52, 16], [84, 58, 8], [87, 44, 12], [90, 50, 8], [93, 40, 18], [96, 46, 10], [98, 56, 7],
  [85, 34, 7], [91, 62, 12], [95, 30, 9], [76, 46, 6],
]

export function HeroStars() {
  return (
    <div className="hero-stars" aria-hidden="true">
      {STARS.map(([x, y, size], index) => (
        <svg
          key={`${x}-${y}`}
          className="hero-star"
          viewBox="-10 -10 20 20"
          style={{ left: `${x}%`, top: `${y}%`, width: size, height: size, animationDelay: `${(index % 7) * 0.45}s` }}
        >
          <path d={STAR_PATH} fill="white" />
        </svg>
      ))}
    </div>
  )
}

// Ladder leaning into the frame with a character climbing up behind it.
export function LadderArt() {
  return (
    <svg className="hero-art hero-art-ladder" viewBox="0 0 340 660" aria-hidden="true">
      <g transform="rotate(-14 170 330)">
        <g className="hero-climber">
          <path d="M240 300C240 246 336 246 336 306L340 470C341 522 238 522 238 470Z" fill={GOLD} stroke={INK} strokeWidth="6" strokeLinejoin="round" />
          <circle cx="272" cy="336" r="13" fill="white" stroke={INK} strokeWidth="4" />
          <circle cx="310" cy="336" r="13" fill="white" stroke={INK} strokeWidth="4" />
          <circle cx="276" cy="338" r="5" fill={INK} />
          <circle cx="314" cy="338" r="5" fill={INK} />
          <path d="M278 370Q292 384 306 370" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" />
          <path d="M244 344C204 334 192 306 202 268" fill="none" stroke={INK} strokeWidth="16" strokeLinecap="round" />
          <path d="M244 344C204 334 192 306 202 268" fill="none" stroke={GOLD} strokeWidth="8" strokeLinecap="round" />
          <circle cx="202" cy="262" r="15" fill="white" stroke={INK} strokeWidth="5" />
          <path d="M252 474C242 504 214 514 196 506" fill="none" stroke={INK} strokeWidth="16" strokeLinecap="round" />
          <path d="M252 474C242 504 214 514 196 506" fill="none" stroke={GOLD} strokeWidth="8" strokeLinecap="round" />
          <rect x="164" y="494" width="46" height="22" rx="11" fill="white" stroke={INK} strokeWidth="5" />
          <rect x="166" y="506" width="42" height="7" rx="3.5" fill={MINT} />
        </g>
        {[60, 130, 200, 270, 340, 410, 480, 550].map((y) => (
          <rect key={y} x="98" y={y} width="124" height="18" rx="6" fill={GOLD_LIGHT} stroke={INK} strokeWidth="6" />
        ))}
        <rect x="86" y="10" width="26" height="630" rx="9" fill={GOLD} stroke={INK} strokeWidth="6" />
        <rect x="208" y="10" width="26" height="630" rx="9" fill={GOLD} stroke={INK} strokeWidth="6" />
      </g>
    </svg>
  )
}

// Character on a rope swing — a rounded gold triangle, a nod to the flag.
export function SwingArt() {
  return (
    <svg className="hero-art hero-art-swing" viewBox="0 0 400 720" aria-hidden="true">
      <g className="hero-swing-group">
        <line x1="340" y1="-20" x2="236" y2="330" stroke="white" strokeWidth="5" strokeLinecap="round" />
        <path d="M216 368C232 336 232 336 248 368" fill="none" stroke={INK} strokeWidth="16" strokeLinecap="round" />
        <path d="M218 368C226 320 232 300 240 286" fill="none" stroke={INK} strokeWidth="16" strokeLinecap="round" />
        <path d="M218 368C226 320 232 300 240 286" fill="none" stroke={GOLD} strokeWidth="8" strokeLinecap="round" />
        <path d="M246 368C244 340 240 326 232 318" fill="none" stroke={INK} strokeWidth="16" strokeLinecap="round" />
        <path d="M246 368C244 340 240 326 232 318" fill="none" stroke={GOLD} strokeWidth="8" strokeLinecap="round" />
        <circle cx="242" cy="282" r="15" fill="white" stroke={INK} strokeWidth="5" />
        <circle cx="230" cy="318" r="15" fill="white" stroke={INK} strokeWidth="5" />
        <path d="M186 566C176 610 168 630 160 644" fill="none" stroke={INK} strokeWidth="16" strokeLinecap="round" />
        <path d="M186 566C176 610 168 630 160 644" fill="none" stroke={GOLD} strokeWidth="8" strokeLinecap="round" />
        <path d="M276 566C288 610 296 630 306 644" fill="none" stroke={INK} strokeWidth="16" strokeLinecap="round" />
        <path d="M276 566C288 610 296 630 306 644" fill="none" stroke={GOLD} strokeWidth="8" strokeLinecap="round" />
        <path d="M232 340Q252 340 264 366L342 516Q358 556 318 562L146 562Q106 556 122 516L200 366Q212 340 232 340Z" fill={GOLD} stroke={INK} strokeWidth="6" strokeLinejoin="round" />
        <circle cx="208" cy="452" r="14" fill="white" stroke={INK} strokeWidth="4" />
        <circle cx="258" cy="452" r="14" fill="white" stroke={INK} strokeWidth="4" />
        <circle cx="212" cy="454" r="6" fill={INK} />
        <circle cx="262" cy="454" r="6" fill={INK} />
        <path d="M214 492Q233 512 252 492" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" />
        <circle cx="180" cy="486" r="9" fill="#ff9fb2" opacity="0.8" />
        <circle cx="288" cy="486" r="9" fill="#ff9fb2" opacity="0.8" />
        {[[296, 402, 7], [318, 446, 9], [340, 492, 7]].map(([cx, cy, r]) => (
          <path key={cx} d={STAR_PATH} fill="white" transform={`translate(${cx} ${cy}) scale(${r / 10})`} />
        ))}
        <rect x="132" y="636" width="54" height="24" rx="12" fill="white" stroke={INK} strokeWidth="5" />
        <rect x="134" y="650" width="50" height="7" rx="3.5" fill={MINT} />
        <rect x="282" y="636" width="54" height="24" rx="12" fill="white" stroke={INK} strokeWidth="5" />
        <rect x="284" y="650" width="50" height="7" rx="3.5" fill={MINT} />
      </g>
    </svg>
  )
}

const TOP_ARC = 'M 20 340 Q 500 40 980 340'
const BOTTOM_ARC = 'M 210 452 Q 500 322 790 452'

// Scale each line so it always fills its arc, whatever font finally loads.
function fitTextPaths(svg) {
  if (!svg) return
  svg.querySelectorAll('text[data-fill]').forEach((text) => {
    const path = svg.querySelector(text.getAttribute('data-fill'))
    if (!path || typeof text.getComputedTextLength !== 'function') return
    text.style.fontSize = ''
    const base = parseFloat(getComputedStyle(text).fontSize)
    const natural = text.getComputedTextLength()
    if (!natural) return
    const target = path.getTotalLength() * Number(text.getAttribute('data-fill-ratio') || 0.94)
    text.style.fontSize = `${Math.floor(base * (target / natural))}px`
  })
}

export function ArcHeadline() {
  const svgRef = useRef(null)

  useLayoutEffect(() => {
    const svg = svgRef.current
    fitTextPaths(svg)
    let cancelled = false
    document.fonts?.ready.then(() => { if (!cancelled) fitTextPaths(svg) })
    return () => { cancelled = true }
  }, [])

  return (
    <h1 className="hero-arc">
      <svg ref={svgRef} viewBox="0 0 1000 470" role="img" aria-labelledby="hero-arc-title">
        <title id="hero-arc-title">Uradi bilo šta. Odmah.</title>
        <defs>
          <path id="hero-arc-top" d={TOP_ARC} />
          <path id="hero-arc-bottom" d={BOTTOM_ARC} />
        </defs>
        <text className="hero-arc-line" data-fill="#hero-arc-top" data-fill-ratio="0.95">
          <textPath href="#hero-arc-top" startOffset="50%" textAnchor="middle">URADI BILO ŠTA</textPath>
        </text>
        <text className="hero-arc-line hero-arc-accent" data-fill="#hero-arc-bottom" data-fill-ratio="0.7">
          <textPath href="#hero-arc-bottom" startOffset="50%" textAnchor="middle">ODMAH.</textPath>
        </text>
      </svg>
    </h1>
  )
}
