import { useId, useMemo } from 'react'
import { LockSimpleIcon } from '@phosphor-icons/react'
import { stickerMarkup } from './badgeStickers'
import './BadgeRanking.css'

/**
 * Badge as a hand-drawn sticker (see badgeStickers.js). `badge` is a ranked badge (rankBadge).
 * From about 90 px up the sticker carries its printed tier strip; smaller ones leave it to the text
 * next to them. `locked` is a faded grey sticker with a small lock. `stamp` plays the "slapped on"
 * entrance once (the badge up close, a fresh badge).
 */
function TierMedal({ badge, size = 40, locked = false, stamp = false, className = '' }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const tier = badge.tier?.key || 'bronze'
  const tab = size >= 90
  const markup = useMemo(
    () => stickerMarkup(badge, { uid, tab, fine: size >= 56, tier }),
    [badge, uid, tab, size, tier],
  )
  return (
    <span
      className={`tier-medal tier-${tier} ${tab ? 'has-tab' : ''} ${locked ? 'is-locked' : ''} ${stamp ? 'do-stamp' : ''} ${className}`}
      style={{ '--medal-size': `${size}px` }}
      aria-hidden="true"
    >
      <span className="tier-medal-art" dangerouslySetInnerHTML={{ __html: markup }} />
      {locked && <span className="tier-medal-lock"><LockSimpleIcon size={Math.min(16, Math.max(9, Math.round(size * 0.2)))} weight="bold" /></span>}
    </span>
  )
}

export default TierMedal
