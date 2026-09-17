const NAVY = '#0d2a52'
const NAVY_DEEP = '#081b38'
const NAVY_SOFT = '#1b4a8a'
const GOLD = '#f5b400'
const GOLD_DARK = '#d99900'
const SKIN = '#f3c9a6'
const SKIN_2 = '#d9a67c'
const WHITE = '#ffffff'

const STAR = 'M0-10C1-3 3-1 10 0 3 1 1 3 0 10-1 3-3 1-10 0-3-1-1-3 0-10Z'

/**
 * Flat illustration for the "Sigurnost i povjerenje" section: a client and a
 * majstor shaking hands under a big verified shield, a locked chat bubble and
 * a five-star rating. Navy + gold only.
 */
function TrustArt() {
  return (
    <svg className="trust-art" viewBox="0 0 480 600" role="img" aria-label="Klijent i majstor se rukuju ispod verifikovanog štita">
      <rect width="480" height="600" rx="30" fill={NAVY} />
      <circle cx="240" cy="300" r="190" fill={NAVY_SOFT} opacity="0.5" />
      <circle cx="60" cy="520" r="70" fill={GOLD} opacity="0.1" />
      <circle cx="430" cy="90" r="50" fill={GOLD} opacity="0.12" />

      {/* shield */}
      <g transform="translate(240 150)">
        <path d="M0 -92 L78 -62 V6 C78 60 40 96 0 112 C-40 96 -78 60 -78 6 V-62 Z" fill={GOLD} />
        <path d="M0 -74 L62 -50 V4 C62 48 32 78 0 92 C-32 78 -62 48 -62 4 V-50 Z" fill={GOLD_DARK} opacity="0.35" />
        <path d="M-30 6 l20 20 l42 -44" fill="none" stroke={NAVY_DEEP} strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
      </g>

      {/* chat bubble with lock */}
      <g transform="translate(70 120)">
        <rect x="0" y="0" width="96" height="62" rx="18" fill={WHITE} />
        <path d="M18 60 l-6 18 l22 -16 z" fill={WHITE} />
        <rect x="36" y="24" width="24" height="20" rx="5" fill={NAVY} />
        <path d="M40 24 v-6 a8 8 0 0 1 16 0 v6" fill="none" stroke={NAVY} strokeWidth="4" />
      </g>

      {/* rating card */}
      <g transform="translate(316 66)">
        <rect x="0" y="0" width="140" height="56" rx="16" fill={WHITE} />
        {[0, 1, 2, 3, 4].map((index) => (
          <path key={index} d={STAR} transform={`translate(${22 + index * 24} 28) scale(1)`} fill={GOLD} />
        ))}
      </g>

      {/* ground */}
      <ellipse cx="240" cy="556" rx="170" ry="12" fill={NAVY_DEEP} opacity="0.55" />

      {/* client (left) */}
      <g transform="translate(90 300)">
        <rect x="28" y="150" width="26" height="90" rx="12" fill={NAVY_DEEP} />
        <rect x="62" y="150" width="26" height="90" rx="12" fill={NAVY_DEEP} />
        <rect x="20" y="60" width="78" height="104" rx="26" fill="#2c5aa0" />
        <circle cx="59" cy="30" r="30" fill={SKIN_2} />
        <path d="M29 26 a30 30 0 0 1 60 0 v-6 a30 22 0 0 0 -60 0 z" fill={NAVY_DEEP} />
        <circle cx="48" cy="32" r="3" fill={NAVY_DEEP} />
        <circle cx="70" cy="32" r="3" fill={NAVY_DEEP} />
        <path d="M49 44 q10 8 20 0" fill="none" stroke={NAVY_DEEP} strokeWidth="3" strokeLinecap="round" />
        {/* arm out to the right */}
        <rect x="86" y="72" width="70" height="26" rx="13" fill="#2c5aa0" transform="rotate(14 86 85)" />
      </g>

      {/* majstor (right) */}
      <g transform="translate(270 300)">
        <rect x="28" y="150" width="26" height="90" rx="12" fill={NAVY_DEEP} />
        <rect x="62" y="150" width="26" height="90" rx="12" fill={NAVY_DEEP} />
        <rect x="20" y="60" width="78" height="104" rx="26" fill={NAVY} />
        <rect x="20" y="128" width="78" height="14" rx="6" fill={GOLD} />
        <circle cx="59" cy="30" r="30" fill={SKIN} />
        <path d="M27 28 a32 32 0 0 1 64 0 z" fill={GOLD} />
        <rect x="22" y="24" width="74" height="10" rx="5" fill={GOLD_DARK} />
        <circle cx="48" cy="36" r="3" fill={NAVY_DEEP} />
        <circle cx="70" cy="36" r="3" fill={NAVY_DEEP} />
        <path d="M49 48 q10 8 20 0" fill="none" stroke={NAVY_DEEP} strokeWidth="3" strokeLinecap="round" />
        {/* arm out to the left */}
        <rect x="-38" y="72" width="70" height="26" rx="13" fill={NAVY} transform="rotate(-14 32 85)" />
      </g>

      {/* handshake */}
      <g transform="translate(240 392)">
        <rect x="-26" y="-12" width="52" height="26" rx="13" fill={SKIN} />
        <rect x="-8" y="-16" width="30" height="24" rx="10" fill={SKIN_2} />
      </g>

      {/* sparkles */}
      {[[150, 60, 1], [400, 250, 0.8], [110, 460, 0.7], [380, 470, 0.7]].map(([x, y, s], index) => (
        <path key={index} d={STAR} transform={`translate(${x} ${y}) scale(${s})`} fill={WHITE} opacity="0.85" className="earn-art-spark" style={{ animationDelay: `${index * 0.5}s` }} />
      ))}
    </svg>
  )
}

export default TrustArt
