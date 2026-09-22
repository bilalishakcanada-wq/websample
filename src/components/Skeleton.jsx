/**
 * Skeleton placeholders: nobody ever looks at a blank white screen while data loads.
 * Every block shares one GPU-composited shimmer (a translated gradient overlay — no
 * background-position repaints), so a page full of them still runs at 60 fps.
 */
export function Skeleton({ h = 16, w = '100%', r = 8, className = '', style }) {
  return <span className={`sk ${className}`} style={{ height: h, width: w, borderRadius: r, ...style }} aria-hidden="true" />
}

export function SkeletonCircle({ size = 44 }) {
  return <Skeleton h={size} w={size} r="50%" />
}

/** A few text lines of decreasing width. */
export function SkeletonLines({ n = 3, gap = 8 }) {
  const widths = ['92%', '78%', '64%', '84%', '58%']
  return (
    <span className="sk-lines" style={{ gap }} aria-hidden="true">
      {Array.from({ length: n }, (_, i) => <Skeleton key={i} h={12} w={widths[i % widths.length]} />)}
    </span>
  )
}

/** A card-sized block (list cards, panels). */
export function SkeletonCard({ h = 130 }) {
  return <Skeleton h={h} r={18} />
}

/** Avatar + two lines: inbox rows, notification rows, people. */
export function SkeletonRow({ avatar = 44 }) {
  return (
    <div className="sk-row" aria-hidden="true">
      <SkeletonCircle size={avatar} />
      <span className="sk-lines" style={{ flex: 1 }}>
        <Skeleton h={13} w="55%" />
        <Skeleton h={11} w="85%" />
      </span>
    </div>
  )
}

export function SkeletonList({ n = 3, h = 130 }) {
  return <div className="skeleton-list" aria-busy="true">{Array.from({ length: n }, (_, i) => <SkeletonCard key={i} h={h} />)}</div>
}

export function SkeletonRows({ n = 4 }) {
  return <div className="sk-rows" aria-busy="true">{Array.from({ length: n }, (_, i) => <SkeletonRow key={i} />)}</div>
}

/** Whole-page placeholder for guarded routes: title, meta line, three cards. */
export function SkeletonPage() {
  return (
    <div className="app-shell page-with-mobile-nav" aria-busy="true">
      <main className="content-container sk-page">
        <Skeleton h={28} w="40%" r={10} />
        <Skeleton h={14} w="60%" />
        <SkeletonList n={3} />
      </main>
    </div>
  )
}
