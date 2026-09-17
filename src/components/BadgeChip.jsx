import { badgeIcon } from './badgeIcons'

const SPECIAL = new Set(['founder', 'flawless', 'local_hero', 'veteran', 'trusted_client'])

/** One badge pill. `badge` is a row from the badges table ({ code, label, description, icon, color }). */
function BadgeChip({ badge, size = 'md' }) {
  const Icon = badgeIcon(badge.icon)
  return (
    <span
      className={`badge-pill badge-${badge.code} ${SPECIAL.has(badge.code) ? 'badge-special' : ''} ${badge.color ? 'badge-colored' : ''} badge-${size}`}
      style={badge.color ? { '--badge-color': badge.color } : undefined}
      title={badge.description || badge.label}
    >
      <Icon size={size === 'lg' ? 15 : 13} /> {badge.label}
    </span>
  )
}

export default BadgeChip
