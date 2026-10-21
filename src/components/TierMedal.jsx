import { createElement } from 'react'
import { Lock } from 'lucide-react'
import { badgeIcon } from './badgeIcons'
import './BadgeRanking.css'

/**
 * Badge icon: a flat round seal, its outline in the tier's colour (bronze → platinum), the icon in the middle.
 * `badge` is a ranked badge (rankBadge); `locked` is grey with a small lock.
 */
function TierMedal({ badge, size = 40, locked = false }) {
  const tier = badge.tier?.key || 'bronze'
  return (
    <span className={`tier-medal tier-${tier} ${locked ? 'is-locked' : ''}`} style={{ '--medal-size': `${size}px` }} aria-hidden="true">
      {createElement(badgeIcon(badge.icon), { size: Math.round(size * 0.45), strokeWidth: 1.8 })}
      {locked && <span className="tier-medal-lock"><Lock size={Math.max(9, Math.round(size * 0.24))} /></span>}
    </span>
  )
}

export default TierMedal
