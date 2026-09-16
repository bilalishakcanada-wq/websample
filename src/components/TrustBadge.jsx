import { useMemo } from 'react'
import { Award, Clock, ShieldAlert, ShieldCheck, Sparkles } from 'lucide-react'

const TIERS = {
  top: { icon: Award, className: 'tier-top' },
  trusted: { icon: ShieldCheck, className: 'tier-trusted' },
  verified: { icon: ShieldCheck, className: 'tier-verified' },
  new: { icon: Sparkles, className: 'tier-new' },
  unverified: { icon: ShieldAlert, className: 'tier-unverified' },
}

function TrustBadge({ tier, label, trade, size = 'md' }) {
  const config = TIERS[tier] || TIERS.unverified
  const Icon = config.icon
  const text = trade && (tier === 'verified' || tier === 'trusted' || tier === 'top') ? `${label} — ${trade}` : label
  return (
    <span className={`trust-badge ${config.className} trust-badge-${size}`} title={text}>
      <Icon size={size === 'lg' ? 18 : 14} />
      {text}
    </span>
  )
}

const describeLastSeen = (value) => {
  const minutes = Math.floor((Date.now() - new Date(value).getTime()) / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  if (minutes < 5) return { text: 'Aktivan sada', online: true }
  if (minutes < 60) return { text: `Aktivan prije ${minutes} min`, online: false }
  if (hours < 24) return { text: `Aktivan prije ${hours} h`, online: false }
  if (days < 30) return { text: `Aktivan prije ${days} ${days === 1 ? 'dan' : 'dana'}`, online: false }
  return { text: `Aktivan prije ${Math.floor(days / 30)} mj.`, online: false }
}

export function LastSeen({ value }) {
  const seen = useMemo(() => (value ? describeLastSeen(value) : null), [value])
  if (!seen) return null
  const { text, online } = seen
  return (
    <span className={`last-seen ${online ? 'online' : ''}`}>
      <span className="last-seen-dot" />
      <Clock size={13} /> {text}
    </span>
  )
}

export default TrustBadge
