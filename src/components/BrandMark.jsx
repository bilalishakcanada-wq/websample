import { useId } from 'react'

/** The Zadatak mark: a rounded white "Z" whose bottom stroke ends in a white badge with a blue check
 *  ("zadatak riješen"). Same drawing as the app icon (scripts/brand-assets.mjs). `tile` draws it on the
 *  blue rounded square; without it the mark sits on whatever is behind it (e.g. the navy welcome screen). */
function BrandMark({ size = 34, tile = true, className = '', ...props }) {
  // unique per mark: two marks on one page (the hidden top bar and the sidebar) must not share gradient ids,
  // or the visible one points at gradients inside the hidden one and draws empty
  const id = `${tile ? 'bm-tile' : 'bm-flat'}${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
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
          <stop offset="0" stopColor="#4d86ff" />
          <stop offset="0.55" stopColor="#1f5fff" />
          <stop offset="1" stopColor="#1149e0" />
        </linearGradient>
        <linearGradient id={`${id}-z`} gradientUnits="userSpaceOnUse" x1="0" y1="190" x2="0" y2="790">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#dbe7ff" />
        </linearGradient>
      </defs>
      {tile && <rect width="1024" height="1024" rx="230" fill={`url(#${id}-bg)`} />}
      <g transform={tile ? 'translate(46 72) scale(0.9)' : 'translate(-6 23)'}>
        <path d="M330 265 H713 L330 713 H560" fill="none" stroke={`url(#${id}-z)`} strokeWidth="150" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="706" cy="713" r="96" fill={`url(#${id}-z)`} />
        <path d="M664 716 L695 747 L748 685" fill="none" stroke="#1f5fff" strokeWidth="34" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  )
}

export default BrandMark
