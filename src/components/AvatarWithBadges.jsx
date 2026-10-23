import { BadgeCheck, UserRound } from 'lucide-react'

const VERIFIED = new Set(['verified', 'trusted', 'top'])

/**
 * Round profile photo. A verified person (tier verified / trusted / top) gets one small check on the rim;
 * the badges themselves are listed under the profile, not stuck around the photo.
 */
function AvatarWithBadges({ src, tier = 'unverified', size = 128 }) {
  return (
    <div className="avatar-badged" style={{ '--size': `${size}px` }}>
      <div className="avatar-badged-ring">
        {src ? <img loading="lazy" decoding="async" src={src} alt="" /> : <div className="avatar-badged-fallback"><UserRound size={Math.round(size * 0.4)} strokeWidth={1.6} /></div>}
      </div>
      {VERIFIED.has(tier) && <span className="avatar-verified" title="Verifikovan"><BadgeCheck size={Math.max(16, Math.round(size * 0.2))} /></span>}
    </div>
  )
}

export default AvatarWithBadges
