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

/* ---- Shape-matched skeletons: they render inside the real card classes, so paddings, gaps and
   line heights are the ones the content will have — the page does not move when data lands. ---- */

/** Search / browse card (title + price, three fact lines, status foot). */
export function SkeletonTaskCard() {
  return (
    <article className="task-card sk-task" aria-hidden="true">
      <div className="task-card-link">
        <div className="task-card-head"><Skeleton h={20} w="62%" /><Skeleton h={20} w={64} /></div>
        <ul className="task-card-facts">
          <li><Skeleton h={13} w="45%" /></li>
          <li><Skeleton h={13} w="58%" /></li>
          <li><Skeleton h={13} w="40%" /></li>
        </ul>
        <div className="task-card-foot"><Skeleton h={14} w={56} /><Skeleton h={14} w={72} /><span className="task-card-avatar sk-avatar"><Skeleton h={32} w={32} r="50%" /></span></div>
      </div>
    </article>
  )
}

/** "Moji poslovi" card on phones. */
export function SkeletonMtCard() {
  return (
    <div className="mt-card" aria-hidden="true">
      <div className="mt-card-head"><Skeleton h={19} w="60%" /><Skeleton h={19} w={60} /></div>
      <span><Skeleton h={14} w="38%" /></span>
      <span><Skeleton h={14} w="52%" /></span>
      <div className="mt-card-foot"><Skeleton h={14} w={70} /><Skeleton h={12} w={90} /></div>
    </div>
  )
}

/** Inbox row (52 px avatar, name + job + preview). */
export function SkeletonChatRow() {
  return (
    <div className="ch-row sk-chrow" aria-hidden="true">
      <Skeleton h={52} w={52} r="50%" />
      <span className="ch-row-body">
        <span className="ch-row-top"><Skeleton h={15} w="45%" /><Skeleton h={11} w={34} /></span>
        <span className="ch-row-job"><Skeleton h={12} w="70%" /></span>
        <span className="ch-row-preview"><Skeleton h={12} w="85%" /></span>
      </span>
    </div>
  )
}

/** Notification row (icon, title, two lines, date). */
export function SkeletonNotifRow() {
  return (
    <li className="sk-notif" aria-hidden="true">
      <span className="notif-list-icon"><Skeleton h={16} w={16} r={4} /></span>
      <span className="sk-lines" style={{ flex: 1 }}>
        <Skeleton h={15} w="55%" />
        <Skeleton h={13} w="92%" />
        <Skeleton h={13} w="70%" />
        <Skeleton h={11} w={110} />
      </span>
      <span className="notif-list-open sk-avatar"><Skeleton h={18} w={18} r={4} /></span>
    </li>
  )
}

/** Job row on the tasker home ("Poslovi za tebe"). */
export function SkeletonApJob() {
  return (
    <div className="ap-job" aria-hidden="true">
      <div className="ap-job-main"><Skeleton h={17} w="64%" /><Skeleton h={13} w="38%" /><Skeleton h={13} w="52%" /></div>
      <Skeleton h={18} w={62} />
    </div>
  )
}

/** Phone job page while the job loads: toolbar, status band, white sheet with title and facts. */
export function SkeletonJobPhone() {
  return (
    <div className="ap jd" aria-busy="true">
      <header className="jd-top"><Skeleton h={48} w={48} r={12} /><Skeleton h={48} w={48} r={12} /></header>
      <section className="jd-band"><Skeleton h={22} w="48%" /><span style={{ display: 'block', height: 8 }} /><Skeleton h={14} w="70%" /></section>
      <section className="jd-sheet">
        <Skeleton h={34} w="86%" r={8} /><span style={{ display: 'block', height: 10 }} /><Skeleton h={34} w="55%" r={8} />
        <div className="sk-lines" style={{ marginTop: 22, gap: 18 }}>
          <Skeleton h={16} w="42%" /><Skeleton h={16} w="50%" /><Skeleton h={16} w="36%" />
        </div>
        <div className="sk-lines" style={{ marginTop: 22 }}><Skeleton h={13} w="96%" /><Skeleton h={13} w="88%" /><Skeleton h={13} w="60%" /></div>
      </section>
    </div>
  )
}
