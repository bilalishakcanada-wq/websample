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

/** A text line's box (its real line height) with a thinner bar centred in it: heights match, bars stay light. */
function Line({ h, bar = 13, w = '100%', r = 6, style }) {
  // the width sits on the line box (percentages then resolve against the parent even inside a flex row)
  return <span className="sk-line" style={{ height: h, width: w, ...style }} aria-hidden="true"><Skeleton h={bar} w="100%" r={r} /></span>
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
        <div className="task-card-head"><Line h={22} bar={15} w="62%" /><Line h={28} bar={18} w={64} /></div>
        <ul className="task-card-facts">
          <li><Line h={19} bar={12} w="45%" /></li>
          <li><Line h={19} bar={12} w="58%" /></li>
          <li><Line h={19} bar={12} w="40%" /></li>
        </ul>
        <div className="task-card-foot"><Line h={21} bar={14} w={77} /><Line h={20} bar={13} w={76} /><span className="task-card-avatar sk-avatar"><Skeleton h={32} w={32} r="50%" /></span></div>
      </div>
    </article>
  )
}

/** "Moji poslovi" card on phones. */
export function SkeletonMtCard() {
  return (
    <div className="mt-card sk-mt" aria-hidden="true">
      <div className="mt-card-head">
        <span className="sk-lines" style={{ flex: 1, gap: 0 }}><Line h={21} bar={15} w="88%" /><Line h={21} bar={15} w="46%" /></span>
        <Line h={24} bar={16} w={44} />
      </div>
      <span><Line h={20} bar={13} w="38%" /></span>
      <span><Line h={20} bar={13} w="52%" /></span>
      <div className="mt-card-foot"><Line h={21} bar={14} w={70} r={999} /><Line h={19} bar={12} w={90} /></div>
    </div>
  )
}

/** Inbox row (52 px avatar, name + job + preview). */
export function SkeletonChatRow() {
  return (
    <div className="ch-row sk-chrow" aria-hidden="true">
      <Skeleton h={52} w={52} r="50%" />
      <span className="ch-row-body">
        <span className="ch-row-top"><Line h={24} bar={15} w="45%" /><Line h={19} bar={11} w={34} /></span>
        <Line h={20} bar={12} w="70%" />
        <Line h={22} bar={12} w="85%" />
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

/* ---- Phone route shells: the static chrome each tab screen always has (title bar, tabs, search, filter
   chips) drawn for real, with only the data rows shimmering. RouteFallback shows these while a screen's
   code loads, and the screen then shows the very same rows while its data loads — one skeleton, no swap. ---- */

const IconBtnSkeleton = () => <span className="ap-icon-btn" aria-hidden="true" />

/** Browse / search: pinned title bar, filter chips, task cards. */
export function SkeletonBrowsePhone() {
  return (
    <div className="app-shell page-with-mobile-nav browse-page" aria-busy="true">
      <div className="ap-browse-top"><IconBtnSkeleton /><h1>Pretraži poslove</h1><IconBtnSkeleton /></div>
      <div className="filter-bar sk-filter-bar">{[96, 88, 132, 118, 104].map((w, i) => <Skeleton key={i} h={44} w={w} r={999} />)}</div>
      <main className="browse-layout"><section className="browse-list">{[1, 2, 3, 4].map((i) => <SkeletonTaskCard key={i} />)}</section></main>
    </div>
  )
}

/** My tasks: title bar with bell, the two tabs, filter label, cards. */
export function SkeletonMyTasksPhone() {
  return (
    <div className="ap ap-page mt" aria-busy="true">
      <div className="ap-sticky">
        <header className="ap-page-head"><h1>Moji poslovi</h1><IconBtnSkeleton /></header>
        <div className="ap-tabs"><button type="button" className="active" tabIndex={-1}>Objavio/la sam</button><button type="button" tabIndex={-1}>Moje ponude</button></div>
      </div>
      <span className="mt-filter"><Skeleton h={16} w={92} r={6} /></span>
      <section className="ap-section"><div className="mt-list"><SkeletonMtCard /><SkeletonMtCard /></div></section>
    </div>
  )
}

/** Inbox: title bar with bell, search box, filter chips, conversation rows. */
export function SkeletonChatPhone() {
  return (
    <div className="ap ap-page ch" aria-busy="true">
      <div className="ap-sticky">
        <header className="ap-page-head"><h1>Poruke</h1><IconBtnSkeleton /></header>
        <div className="ch-search"><Skeleton h={18} w={18} r={5} /><Skeleton h={14} w={80} r={5} /></div>
        <div className="ch-filters">{['Sve', 'Nepročitane', 'Spašene', 'Arhiva'].map((label, i) => <button key={label} type="button" className={i === 0 ? 'active' : ''} tabIndex={-1}>{label}</button>)}</div>
      </div>
      <div className="ch-list">{[1, 2, 3, 4, 5].map((i) => <SkeletonChatRow key={i} />)}</div>
    </div>
  )
}

/** The phone profile screen (ProfileView): toolbar, name block + avatar, facts, rating, review cards. */
export function SkeletonProfilePhone() {
  return (
    <div className="ap pv" aria-busy="true">
      <header className="jd-top"><Skeleton h={48} w={48} r={12} /><Skeleton h={48} w={48} r={12} /></header>
      <section className="pv-head">
        <div style={{ flex: 1 }}>
          <Line h={17} bar={10} w={64} r={4} style={{ marginBottom: 4 }} />
          <Line h={38} bar={30} w="78%" r={8} style={{ marginBottom: 8 }} />
          <Line h={25} bar={13} w="40%" />
        </div>
        <SkeletonCircle size={76} />
      </section>
      <ul className="pv-facts">
        <li><SkeletonCircle size={18} /><Line h={22} bar={15} w="40%" /></li>
        <li><SkeletonCircle size={18} /><Line h={22} bar={15} w="78%" /></li>
      </ul>
      <section className="pv-rating">
        <Line h={28} bar={19} w="52%" />
        <Line h={24} bar={14} w="30%" style={{ marginTop: 2 }} />
      </section>
      <div className="pv-reviews">
        {[1, 2].map((i) => (
          <article key={i} className="pv-review">
            <div className="pv-review-head"><SkeletonCircle size={40} /><span className="sk-lines" style={{ flex: 1, gap: 4 }}><Skeleton h={13} w="50%" /><Skeleton h={11} w="35%" /></span></div>
            <span className="sk-lines" style={{ gap: 6 }}><Skeleton h={12} w="92%" /><Skeleton h={12} w="78%" /><Skeleton h={12} w="64%" /></span>
          </article>
        ))}
      </div>
    </div>
  )
}

/** Phone job page while the job loads: toolbar, status band, white sheet with title and facts. */
export function SkeletonJobPhone() {
  return (
    <div className="ap jd" aria-busy="true">
      <header className="jd-top"><Skeleton h={48} w={48} r={12} /><Skeleton h={48} w={48} r={12} /></header>
      <section className="jd-band">
        <Line h={32} bar={22} w="58%" r={8} style={{ marginBottom: 4 }} />
        <Line h={24} bar={14} w="70%" />
        <Skeleton h={52} r={999} style={{ marginTop: 16 }} />
      </section>
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
