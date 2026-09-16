import { Award, BadgeCheck, Crown, Gem, Handshake, MapPinned, Medal, ShieldCheck, TrendingUp, Zap } from 'lucide-react'

// Icon names come from the badges table so new badges can be added in SQL only.
const ICONS = {
  'shield-check': ShieldCheck,
  star: Award,
  'trending-up': TrendingUp,
  'badge-check': BadgeCheck,
  zap: Zap,
  crown: Crown,
  gem: Gem,
  'map-pinned': MapPinned,
  medal: Medal,
  handshake: Handshake,
}

const SPECIAL = new Set(['founder', 'flawless', 'local_hero', 'veteran', 'trusted_client'])

/** One badge pill. `badge` is a row from the badges table ({ code, label, description, icon }). */
function BadgeChip({ badge, size = 'md' }) {
  const Icon = ICONS[badge.icon] || Award
  return (
    <span
      className={`badge-pill badge-${badge.code} ${SPECIAL.has(badge.code) ? 'badge-special' : ''} badge-${size}`}
      title={badge.description || badge.label}
    >
      <Icon size={size === 'lg' ? 15 : 13} /> {badge.label}
    </span>
  )
}

export default BadgeChip
