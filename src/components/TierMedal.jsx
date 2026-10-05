import { createElement, useId } from 'react'
import { Lock } from 'lucide-react'
import { badgeIcon } from './badgeIcons'
import './BadgeRanking.css'

// Boje okvira po nivou: [svijetla, tamna]. Platina je brend plava s ledenim odsjajem.
const FRAME = {
  bronze: ['#efb98a', '#9c5428'],
  silver: ['#f4f7fb', '#8593a8'],
  gold: ['#ffe28f', '#d99900'],
  platinum: ['#e3ebff', '#0d2a52'],
}

/**
 * Šestougaona medalja značke: okvir u boji nivoa (bronza → platina), ikona u sredini.
 * `badge` je rangirana značka (rankBadge), `locked` je siva sa lokotom.
 */
function TierMedal({ badge, size = 48, locked = false }) {
  const id = useId().replace(/:/g, '')
  const tier = badge.tier?.key || 'bronze'
  const [light, dark] = FRAME[tier]
  return (
    <span className={`tier-medal tier-${tier} ${locked ? 'is-locked' : ''}`} style={{ '--medal-size': `${size}px`, '--badge-color': badge.color || undefined }} aria-hidden="true">
      <svg viewBox="0 0 48 52" width={size} height={size * 52 / 48}>
        <defs>
          <linearGradient id={`f${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={light} />
            <stop offset="0.55" stopColor={dark} />
            <stop offset="1" stopColor={light} />
          </linearGradient>
          <linearGradient id={`s${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
            <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M24 1.5 46 14v24L24 50.5 2 38V14Z" fill={`url(#f${id})`} />
        <path d="M24 6.5 41.5 16.5v19L24 45.5 6.5 35.5v-19Z" fill="#fff" className="tier-medal-face" />
        <path d="M24 1.5 46 14v12H2V14Z" fill={`url(#s${id})`} />
        {tier === 'platinum' && <path d="M40 3.5l1.1 2.4 2.4 1.1-2.4 1.1L40 10.5l-1.1-2.4-2.4-1.1 2.4-1.1Z" fill="#fff" className="tier-medal-spark" />}
      </svg>
      <span className="tier-medal-icon">{createElement(badgeIcon(badge.icon), { size: size * 0.4, strokeWidth: 2.1 })}</span>
      {locked && <span className="tier-medal-lock"><Lock size={Math.max(10, size * 0.22)} /></span>}
    </span>
  )
}

export default TierMedal
