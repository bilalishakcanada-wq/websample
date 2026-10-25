import { createElement, useId } from 'react'
import { LockSimpleIcon } from '@phosphor-icons/react'
import { medalGlyph } from './badgeIcons'
import './BadgeRanking.css'

// One outline per tier, so the level reads from the shape before the colour:
// bronze a round coin, silver a hexagon, gold a scalloped rosette, platinum an eight-point star.
const C = 32
const point = (radius, angle) => `${(C + radius * Math.cos(angle)).toFixed(2)} ${(C + radius * Math.sin(angle)).toFixed(2)}`
const polygon = (count, outer, inner, turn = -Math.PI / 2) => {
  const steps = inner ? count * 2 : count
  return `M${Array.from({ length: steps }, (_, index) => point(inner && index % 2 ? inner : outer, turn + (index * 2 * Math.PI) / steps)).join('L')}Z`
}
const scallops = (count, outer, inner) => {
  const step = (2 * Math.PI) / count
  let path = `M${point(inner, -Math.PI / 2)}`
  for (let index = 0; index < count; index += 1) {
    const start = -Math.PI / 2 + index * step
    path += `Q${point(outer + 3.4, start + step / 2)} ${point(inner, start + step)}`
  }
  return `${path}Z`
}

const SHAPES = {
  bronze: { rim: `M${C} 2a30 30 0 1 0 0.01 0Z`, face: 23, join: 0 },
  silver: { rim: polygon(6, 28.5), face: 21, join: 5 },
  gold: { rim: scallops(12, 28, 27), face: 21, join: 1.5 },
  platinum: { rim: polygon(8, 31, 25.5, -Math.PI / 2), face: 20, join: 2 },
}

/**
 * Badge medal: the tier's shape in its metal, an enamel face, and the badge glyph in the middle.
 * `badge` is a ranked badge (rankBadge). `locked` is a grey outline with a small lock.
 * `shine` plays one light sweep across it (a fresh badge, the opened detail); hovering a gold
 * or platinum medal plays it too.
 */
function TierMedal({ badge, size = 40, locked = false, shine = false, className = '' }) {
  const clip = useId()
  const tier = badge.tier?.key || 'bronze'
  const shape = SHAPES[tier] || SHAPES.bronze
  const { Icon, phosphor } = medalGlyph(badge.icon)
  const glyphSize = Math.round(size * 0.42)
  return (
    <span
      className={`tier-medal tier-${tier} ${locked ? 'is-locked' : ''} ${shine ? 'do-shine' : ''} ${className}`}
      style={{ '--medal-size': `${size}px` }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 64 64" className="tier-medal-art" focusable="false">
        <defs><clipPath id={clip}><path d={shape.rim} /></clipPath></defs>
        <path className="m-rim" d={shape.rim} strokeWidth={shape.join} />
        <circle className="m-face" cx={C} cy={C} r={shape.face} />
        <circle className="m-line" cx={C} cy={C} r={shape.face - 2.6} />
        {!locked && (
          <g clipPath={`url(#${clip})`}>
            <rect className="m-shine" x="-26" y="-12" width="14" height="88" transform="rotate(22 32 32)" />
          </g>
        )}
      </svg>
      <span className="tier-medal-glyph">
        {phosphor ? createElement(Icon, { size: glyphSize, weight: locked ? 'regular' : 'duotone' }) : createElement(Icon, { size: glyphSize, strokeWidth: 1.8 })}
      </span>
      {locked && <span className="tier-medal-lock"><LockSimpleIcon size={Math.min(16, Math.max(9, Math.round(size * 0.22)))} weight="bold" /></span>}
    </span>
  )
}

export default TierMedal
