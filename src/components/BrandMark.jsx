/** The Poso.ba mark: a "p" whose bowl is a gold badge with a navy check. Same drawing as the app icon
 *  (scripts/brand-assets.mjs). `tile` draws it on the navy rounded square; without it the mark sits on
 *  whatever is behind it (e.g. the navy welcome screen). */
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
        <rect x="248" y="190" width="150" height="598" rx="75" fill={`url(#${id}-gold)`} />
        <circle cx="560" cy="418" r="228" fill={`url(#${id}-gold)`} />
        <circle cx="560" cy="418" r="150" fill="#0d2a52" />
        <path d="M478 424 L540 486 L650 358" fill="none" stroke="#f5b400" strokeWidth="58" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  )
}

export default BrandMark
