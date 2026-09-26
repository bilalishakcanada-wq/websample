import { UserRound } from 'lucide-react'
import { badgeIcon } from './badgeIcons'

// Badge priority when there are more than four: verification and rarity first.
const ORDER = ['verified', 'top_rated', 'founder', 'flawless', 'veteran', 'local_hero', 'reliable', 'fast_responder', 'rising_talent', 'trusted_client']

/**
 * Round avatar with a trust-tier ring and up to four badge medallions on the
 * rim. `tier` is the trust tier (new/unverified/verified/trusted/top),
 * `badges` are rows from the badges table.
 */
function AvatarWithBadges({ src, tier = 'unverified', badges = [], size = 128 }) {
  const sorted = [...badges].sort((a, b) => ORDER.indexOf(a.code) - ORDER.indexOf(b.code)).slice(0, 4)
  return (
    <div className={`avatar-badged tier-${tier}`} style={{ '--size': `${size}px` }}>
      <div className="avatar-badged-ring">
        {src ? <img loading="lazy" decoding="async" src={src} alt="" /> : <div className="avatar-badged-fallback"><UserRound size={size * 0.38} /></div>}
      </div>
      {sorted.map((badge, index) => {
        const Icon = badgeIcon(badge.icon)
        return (
          <span key={badge.code} className={`avatar-medal medal-${index} badge-${badge.code} ${badge.color ? 'badge-colored' : ''}`} style={badge.color ? { '--badge-color': badge.color } : undefined} title={`${badge.label} — ${badge.description || ''}`} aria-label={badge.label}>
            <Icon size={size >= 120 ? 15 : 12} />
          </span>
        )
      })}
    </div>
  )
}

export default AvatarWithBadges
