const NAVY = '#0d2a52'
const NAVY_DEEP = '#081b38'
const NAVY_SOFT = '#1b4a8a'
const GOLD = '#f5b400'
const GOLD_DARK = '#d99900'
const SKIN = '#f3c9a6'
const WHITE = '#ffffff'
const MINT = '#2f9e5f'

const STAR = 'M0-10C1-3 3-1 10 0 3 1 1 3 0 10-1 3-3 1-10 0-3-1-1-3 0-10Z'

/**
 * Flat illustration for the "Budi svoj šef" hero: a majstor with a hard hat
 * and tool belt giving a thumbs-up next to a phone that just showed a paid job,
 * with KM coins drifting up. Brand navy + gold only, no photo.
 */
function EarnArt() {
  return (
    <svg className="earn-art" viewBox="0 0 600 500" role="img" aria-label="Majstor sa telefonom i isplatom">
      {/* soft backdrop */}
      <circle cx="310" cy="250" r="210" fill={NAVY_SOFT} opacity="0.55" />
      <circle cx="120" cy="120" r="46" fill={GOLD} opacity="0.12" />
      <circle cx="520" cy="400" r="70" fill={GOLD} opacity="0.1" />
      {/* ground shadow */}
      <ellipse cx="300" cy="446" rx="200" ry="14" fill={NAVY_DEEP} opacity="0.5" />

      {/* ---- phone ---- */}
      <g transform="translate(360 110)">
        <rect x="0" y="0" width="170" height="300" rx="26" fill={NAVY_DEEP} />
        <rect x="10" y="12" width="150" height="276" rx="18" fill={WHITE} />
        <rect x="58" y="20" width="54" height="6" rx="3" fill="#dfe6f1" />
        {/* job card */}
        <rect x="24" y="44" width="122" height="96" rx="14" fill="#eef3fb" />
        <rect x="36" y="58" width="70" height="9" rx="4" fill={NAVY} />
        <rect x="36" y="74" width="96" height="7" rx="3" fill="#b9c4d6" />
        <rect x="36" y="87" width="80" height="7" rx="3" fill="#b9c4d6" />
        <rect x="36" y="106" width="64" height="22" rx="11" fill={GOLD} />
        <text x="68" y="121" textAnchor="middle" fontFamily="Manrope, sans-serif" fontWeight="800" fontSize="12" fill={NAVY_DEEP}>220 KM</text>
        <circle x="0" cx="126" cy="117" r="11" fill={MINT} />
        <path d="M120 117 l4 4 l8 -9" fill="none" stroke={WHITE} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {/* two smaller rows */}
        <rect x="24" y="154" width="122" height="44" rx="12" fill="#eef3fb" />
        <rect x="36" y="168" width="58" height="8" rx="4" fill={NAVY} opacity="0.7" />
        <rect x="104" y="166" width="34" height="14" rx="7" fill={GOLD} opacity="0.8" />
        <rect x="24" y="208" width="122" height="44" rx="12" fill="#eef3fb" />
        <rect x="36" y="222" width="48" height="8" rx="4" fill={NAVY} opacity="0.7" />
        <rect x="104" y="220" width="34" height="14" rx="7" fill={GOLD} opacity="0.8" />
        <rect x="62" y="270" width="46" height="5" rx="2.5" fill="#dfe6f1" />
      </g>

      {/* ---- coins ---- */}
      {[[470, 70, 22], [545, 120, 16], [500, 30, 12]].map(([x, y, r], index) => (
        <g key={index} transform={`translate(${x} ${y})`} className="earn-art-coin" style={{ animationDelay: `${index * 0.6}s` }}>
          <circle r={r} fill={GOLD_DARK} />
          <circle r={r} cx="-2" cy="-2" fill={GOLD} />
          <text y={r * 0.35} textAnchor="middle" fontFamily="Archivo, Manrope, sans-serif" fontWeight="900" fontSize={r * 0.95} fill={NAVY_DEEP}>KM</text>
        </g>
      ))}

      {/* ---- majstor ---- */}
      <g transform="translate(150 96)">
        {/* legs */}
        <rect x="42" y="250" width="34" height="100" rx="14" fill={NAVY_DEEP} />
        <rect x="88" y="250" width="34" height="100" rx="14" fill={NAVY_DEEP} />
        <rect x="34" y="336" width="50" height="20" rx="8" fill={GOLD_DARK} />
        <rect x="82" y="336" width="50" height="20" rx="8" fill={GOLD_DARK} />
        {/* body */}
        <rect x="24" y="130" width="116" height="140" rx="30" fill={NAVY} />
        <rect x="24" y="222" width="116" height="20" rx="8" fill={GOLD} />
        <rect x="52" y="218" width="18" height="28" rx="5" fill={GOLD_DARK} />
        <rect x="96" y="218" width="18" height="28" rx="5" fill={GOLD_DARK} />
        {/* hammer in belt */}
        <rect x="128" y="196" width="8" height="54" rx="4" fill="#c88a3b" />
        <rect x="118" y="188" width="28" height="14" rx="4" fill="#6b7280" />
        {/* left arm — resting */}
        <rect x="4" y="150" width="30" height="96" rx="15" fill={NAVY} />
        <circle cx="19" cy="248" r="15" fill={SKIN} />
        {/* right arm — thumbs up */}
        <rect x="128" y="120" width="30" height="80" rx="15" fill={NAVY} transform="rotate(-38 143 160)" />
        <g transform="translate(176 92)">
          <rect x="-14" y="0" width="30" height="30" rx="10" fill={SKIN} />
          <rect x="-4" y="-18" width="12" height="26" rx="6" fill={SKIN} />
        </g>
        {/* neck + head */}
        <rect x="68" y="108" width="28" height="30" rx="8" fill={SKIN} />
        <circle cx="82" cy="78" r="40" fill={SKIN} />
        {/* hard hat */}
        <path d="M38 76 a44 44 0 0 1 88 0 z" fill={GOLD} />
        <rect x="30" y="70" width="104" height="14" rx="7" fill={GOLD_DARK} />
        <rect x="76" y="34" width="12" height="26" rx="6" fill={GOLD_DARK} opacity="0.5" />
        {/* face */}
        <circle cx="68" cy="84" r="4" fill={NAVY_DEEP} />
        <circle cx="96" cy="84" r="4" fill={NAVY_DEEP} />
        <path d="M68 100 q14 12 28 0" fill="none" stroke={NAVY_DEEP} strokeWidth="4" strokeLinecap="round" />
        <circle cx="58" cy="96" r="5" fill="#f19a8a" opacity="0.6" />
        <circle cx="106" cy="96" r="5" fill="#f19a8a" opacity="0.6" />
      </g>

      {/* sparkles */}
      {[[92, 210, 1.2], [330, 60, 0.9], [560, 250, 1.1], [70, 330, 0.7]].map(([x, y, s], index) => (
        <path key={index} d={STAR} transform={`translate(${x} ${y}) scale(${s})`} fill={WHITE} opacity="0.9" className="earn-art-spark" style={{ animationDelay: `${index * 0.5}s` }} />
      ))}
    </svg>
  )
}

export default EarnArt
