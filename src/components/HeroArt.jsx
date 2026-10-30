import { useLayoutEffect, useRef } from 'react'

// Four-point sparkle, centred on the origin (viewBox -10 -10 20 20).
const STAR_PATH = 'M0-10C1-3 3-1 10 0 3 1 1 3 0 10-1 3-3 1-10 0-3-1-1-3 0-10Z'

// [x%, y%, size px], two trails that "fly" out of the illustrations, like
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

export function ArcHeadline({ top = 'URADI BILO ŠTA', bottom = 'ODMAH.', id = 'hero-arc', as: Tag = 'h1', className = '' }) {
  const svgRef = useRef(null)

  useLayoutEffect(() => {
    const svg = svgRef.current
    fitTextPaths(svg)
    let cancelled = false
    document.fonts?.ready.then(() => { if (!cancelled) fitTextPaths(svg) })
    return () => { cancelled = true }
  }, [top, bottom])

  return (
    <Tag className={`hero-arc ${className}`.trim()}>
      <svg ref={svgRef} viewBox="0 0 1000 470" role="img" aria-labelledby={`${id}-title`}>
        <title id={`${id}-title`}>{`${top} ${bottom}`}</title>
        <defs>
          <path id={`${id}-top`} d={TOP_ARC} />
          <path id={`${id}-bottom`} d={BOTTOM_ARC} />
        </defs>
        <text className="hero-arc-line" data-fill={`#${id}-top`} data-fill-ratio="0.95">
          <textPath href={`#${id}-top`} startOffset="50%" textAnchor="middle">{top}</textPath>
        </text>
        <text className="hero-arc-line hero-arc-accent" data-fill={`#${id}-bottom`} data-fill-ratio="0.7">
          <textPath href={`#${id}-bottom`} startOffset="50%" textAnchor="middle">{bottom}</textPath>
        </text>
      </svg>
    </Tag>
  )
}
