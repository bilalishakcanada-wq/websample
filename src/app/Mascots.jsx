/* Simple, friendly illustrations in Poso.ba colours (navy / gold / white / mint).
   Each one is a sticker-style character used on the welcome and intro screens. */
const NAVY = '#0d2a52'
const INK = '#061530'
const GOLD = '#f5b400'
const MINT = '#8fd3b6'
const WHITE = '#ffffff'

const Face = ({ x = 0, y = 0, s = 1 }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <circle cx="-16" cy="0" r="7" fill={WHITE} stroke={INK} strokeWidth="4" />
    <circle cx="16" cy="0" r="7" fill={WHITE} stroke={INK} strokeWidth="4" />
    <circle cx="-14" cy="1" r="3" fill={INK} />
    <circle cx="18" cy="1" r="3" fill={INK} />
    <path d="M-14 18 Q0 30 14 18" fill="none" stroke={INK} strokeWidth="4" strokeLinecap="round" />
  </g>
)

const Sparkle = ({ x, y, s = 1 }) => (
  <path transform={`translate(${x} ${y}) scale(${s})`} d="M0 -14 L4 -4 14 0 4 4 0 14 -4 4 -14 0 -4 -4z" fill={WHITE} />
)

/** Broom character — cleaning */
export function BroomMascot(props) {
  return (
    <svg viewBox="0 0 240 300" {...props}>
      <Sparkle x="30" y="60" s="0.9" /><Sparkle x="210" y="120" s="0.7" /><Sparkle x="40" y="230" s="0.6" />
      <rect x="108" y="20" width="24" height="150" rx="12" fill={GOLD} stroke={INK} strokeWidth="5" />
      <path d="M60 170 L180 170 L200 270 L40 270 Z" fill={GOLD} stroke={INK} strokeWidth="5" strokeLinejoin="round" />
      <path d="M70 200 L170 200 M64 230 L176 230" stroke={INK} strokeWidth="4" strokeLinecap="round" />
      <rect x="52" y="160" width="136" height="26" rx="13" fill={NAVY} stroke={INK} strokeWidth="5" />
      <Face x="120" y="100" s="1" />
      <path d="M96 130 Q70 150 60 190" stroke={INK} strokeWidth="6" strokeLinecap="round" fill="none" />
      <path d="M144 130 Q170 150 180 190" stroke={INK} strokeWidth="6" strokeLinecap="round" fill="none" />
    </svg>
  )
}

/** Wrench character — repairs / handyman */
export function WrenchMascot(props) {
  return (
    <svg viewBox="0 0 240 300" {...props}>
      <Sparkle x="200" y="50" s="0.8" /><Sparkle x="36" y="120" s="0.7" /><Sparkle x="196" y="250" s="0.6" />
      <path d="M120 40 a44 44 0 1 0 0.1 0z M100 30 l40 0 l0 34 l-40 0z" fill={NAVY} stroke={INK} strokeWidth="5" />
      <rect x="102" y="80" width="36" height="150" rx="14" fill={NAVY} stroke={INK} strokeWidth="5" />
      <rect x="86" y="222" width="68" height="46" rx="16" fill={GOLD} stroke={INK} strokeWidth="5" />
      <Face x="120" y="150" s="0.95" />
      <path d="M100 200 Q64 214 58 250" stroke={INK} strokeWidth="6" strokeLinecap="round" fill="none" />
      <path d="M140 200 Q176 214 182 250" stroke={INK} strokeWidth="6" strokeLinecap="round" fill="none" />
      <rect x="44" y="244" width="30" height="16" rx="8" fill={WHITE} stroke={INK} strokeWidth="4" />
      <rect x="166" y="244" width="30" height="16" rx="8" fill={WHITE} stroke={INK} strokeWidth="4" />
    </svg>
  )
}

/** Moving box character — moving & transport */
export function BoxMascot(props) {
  return (
    <svg viewBox="0 0 240 300" {...props}>
      <Sparkle x="40" y="50" s="0.8" /><Sparkle x="208" y="90" s="0.6" /><Sparkle x="200" y="240" s="0.7" />
      <path d="M50 120 L120 90 L190 120 L190 230 L120 260 L50 230 Z" fill={GOLD} stroke={INK} strokeWidth="5" strokeLinejoin="round" />
      <path d="M50 120 L120 150 L190 120 M120 150 L120 260" stroke={INK} strokeWidth="5" fill="none" />
      <rect x="96" y="60" width="48" height="40" rx="10" fill={NAVY} stroke={INK} strokeWidth="5" />
      <Face x="85" y="195" s="0.75" />
      <path d="M42 150 Q20 170 26 200" stroke={INK} strokeWidth="6" strokeLinecap="round" fill="none" />
      <path d="M198 150 Q220 170 214 200" stroke={INK} strokeWidth="6" strokeLinecap="round" fill="none" />
      <rect x="72" y="256" width="30" height="16" rx="8" fill={WHITE} stroke={INK} strokeWidth="4" />
      <rect x="138" y="256" width="30" height="16" rx="8" fill={WHITE} stroke={INK} strokeWidth="4" />
    </svg>
  )
}

/** Paint roller character — painting / renovation */
export function RollerMascot(props) {
  return (
    <svg viewBox="0 0 240 300" {...props}>
      <Sparkle x="32" y="70" s="0.8" /><Sparkle x="206" y="60" s="0.6" /><Sparkle x="204" y="230" s="0.7" />
      <rect x="40" y="40" width="160" height="70" rx="20" fill={MINT} stroke={INK} strokeWidth="5" />
      <path d="M200 75 L214 75 Q228 75 228 90 L228 130 Q228 146 212 146 L126 146" stroke={INK} strokeWidth="7" fill="none" strokeLinecap="round" />
      <rect x="108" y="140" width="36" height="120" rx="14" fill={NAVY} stroke={INK} strokeWidth="5" />
      <Face x="120" y="75" s="0.8" />
      <path d="M104 200 Q70 210 66 246" stroke={INK} strokeWidth="6" strokeLinecap="round" fill="none" />
      <path d="M148 200 Q182 210 186 246" stroke={INK} strokeWidth="6" strokeLinecap="round" fill="none" />
      <rect x="50" y="240" width="30" height="16" rx="8" fill={WHITE} stroke={INK} strokeWidth="4" />
      <rect x="170" y="240" width="30" height="16" rx="8" fill={WHITE} stroke={INK} strokeWidth="4" />
    </svg>
  )
}

/** Laptop character — IT / online work */
export function LaptopMascot(props) {
  return (
    <svg viewBox="0 0 240 300" {...props}>
      <Sparkle x="36" y="60" s="0.8" /><Sparkle x="206" y="70" s="0.6" /><Sparkle x="204" y="230" s="0.7" />
      <rect x="44" y="60" width="152" height="110" rx="14" fill={NAVY} stroke={INK} strokeWidth="5" />
      <rect x="56" y="72" width="128" height="86" rx="8" fill={WHITE} />
      <path d="M30 176 L210 176 L200 200 L40 200 Z" fill={GOLD} stroke={INK} strokeWidth="5" strokeLinejoin="round" />
      <Face x="120" y="112" s="0.85" />
      <path d="M52 210 Q34 226 40 254" stroke={INK} strokeWidth="6" strokeLinecap="round" fill="none" />
      <path d="M188 210 Q206 226 200 254" stroke={INK} strokeWidth="6" strokeLinecap="round" fill="none" />
      <rect x="84" y="206" width="30" height="16" rx="8" fill={WHITE} stroke={INK} strokeWidth="4" />
      <rect x="126" y="206" width="30" height="16" rx="8" fill={WHITE} stroke={INK} strokeWidth="4" />
    </svg>
  )
}

/** Wallet with a check — "only pay when happy" */
export function WalletMascot(props) {
  return (
    <svg viewBox="0 0 240 300" {...props}>
      <Sparkle x="40" y="60" s="0.8" /><Sparkle x="200" y="240" s="0.7" />
      <rect x="40" y="90" width="160" height="120" rx="18" fill={NAVY} stroke={INK} strokeWidth="5" />
      <rect x="40" y="110" width="160" height="22" fill={INK} opacity="0.35" />
      <rect x="140" y="130" width="70" height="44" rx="12" fill={GOLD} stroke={INK} strokeWidth="5" />
      <circle cx="176" cy="152" r="8" fill={INK} />
      <circle cx="180" cy="80" r="30" fill={MINT} stroke={INK} strokeWidth="5" />
      <path d="M164 80 L176 92 L198 66" stroke={INK} strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Face x="92" y="165" s="0.7" />
    </svg>
  )
}

/** Magnifier over people — "find local pros" */
export function FindMascot(props) {
  return (
    <svg viewBox="0 0 240 300" {...props}>
      <Sparkle x="36" y="60" s="0.8" /><Sparkle x="208" y="200" s="0.7" />
      <circle cx="110" cy="130" r="70" fill={WHITE} stroke={INK} strokeWidth="6" />
      <circle cx="110" cy="130" r="56" fill={MINT} opacity="0.5" />
      <circle cx="90" cy="118" r="14" fill={NAVY} />
      <path d="M62 170 Q90 140 118 170" fill={NAVY} />
      <circle cx="132" cy="122" r="12" fill={GOLD} stroke={INK} strokeWidth="3" />
      <path d="M110 166 Q132 144 154 166" fill={GOLD} stroke={INK} strokeWidth="3" />
      <path d="M160 180 L210 230" stroke={INK} strokeWidth="18" strokeLinecap="round" />
      <path d="M160 180 L210 230" stroke={GOLD} strokeWidth="9" strokeLinecap="round" />
      <path d="M66 96 l6 4 M154 96 l-6 4" stroke={INK} strokeWidth="4" strokeLinecap="round" />
      <g fill={GOLD}><path d="M100 54 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3z" /></g>
    </svg>
  )
}

/** Coins jar — "earn money" */
export function EarnMascot(props) {
  return (
    <svg viewBox="0 0 240 300" {...props}>
      <Sparkle x="40" y="50" s="0.8" /><Sparkle x="204" y="90" s="0.6" />
      <rect x="60" y="80" width="120" height="170" rx="26" fill={WHITE} stroke={INK} strokeWidth="6" />
      <rect x="76" y="60" width="88" height="30" rx="10" fill={NAVY} stroke={INK} strokeWidth="5" />
      <circle cx="92" cy="200" r="20" fill={GOLD} stroke={INK} strokeWidth="4" />
      <circle cx="134" cy="214" r="20" fill={GOLD} stroke={INK} strokeWidth="4" />
      <circle cx="120" cy="174" r="20" fill={GOLD} stroke={INK} strokeWidth="4" />
      <text x="120" y="182" textAnchor="middle" fontFamily="Manrope, sans-serif" fontWeight="800" fontSize="16" fill={INK}>KM</text>
      <Face x="120" y="125" s="0.7" />
      <circle cx="200" cy="150" r="14" fill={GOLD} stroke={INK} strokeWidth="4" />
      <circle cx="214" cy="200" r="10" fill={GOLD} stroke={INK} strokeWidth="4" />
    </svg>
  )
}
