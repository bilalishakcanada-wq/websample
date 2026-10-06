/** The Zadatak mark: a rounded gold "Z" whose bottom stroke ends in a gold badge with a navy check
 *  ("zadatak riješen"). Same drawing as the app icon (scripts/brand-assets.mjs). `tile` draws it on the
 *  navy rounded square; without it the mark sits on whatever is behind it (e.g. the navy welcome screen). */
function BrandMark({ size = 34, tile = true, className = '', ...props }) {
  const id = tile ? 'bm-tile' : 'bm-flat'
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 1024 1024"
      aria-hidden="true"
      className={`brand-mark-svg ${className}`.trim()}
      {...props}
    >
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#17407a" />
          <stop offset="0.55" stopColor="#0d2a52" />
          <stop offset="1" stopColor="#071b3a" />
        </linearGradient>
        <linearGradient id={`${id}-gold`} gradientUnits="userSpaceOnUse" x1="0" y1="190" x2="0" y2="790">
          <stop offset="0" stopColor="#ffc83d" />
          <stop offset="1" stopColor="#d99a00" />
        </linearGradient>
      </defs>
      {tile && <rect width="1024" height="1024" rx="230" fill={`url(#${id}-bg)`} />}
      <g transform={tile ? 'translate(46 72) scale(0.9)' : 'translate(-6 23)'}>
        <path d="M330 265 H713 L330 713 H560" fill="none" stroke={`url(#${id}-gold)`} strokeWidth="150" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="706" cy="713" r="96" fill={`url(#${id}-gold)`} />
        <path d="M664 716 L695 747 L748 685" fill="none" stroke="#0d2a52" strokeWidth="34" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  )
}

export default BrandMark
