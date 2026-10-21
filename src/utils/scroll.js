/**
 * On phones the document is fixed and #root is the scroller (see "Phone app shell" in App.css);
 * on wider screens the window scrolls. These helpers address whichever one is active.
 */
export const scrollRoot = () => document.getElementById('root')

// the Lenis instance while smooth scrolling runs (computers only, see SmoothScroll.jsx)
let smooth = null
export const setSmoothScroller = (instance) => { smooth = instance }

export function scrollToTop() {
  smooth?.scrollTo(0, { immediate: true, force: true })
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  const root = scrollRoot()
  if (root) root.scrollTo({ top: 0, left: 0, behavior: 'instant' })
}

/** Jump (no animation) to a vertical position on whichever element scrolls. */
export function scrollToY(top) {
  smooth?.scrollTo(top, { immediate: true, force: true })
  const root = scrollRoot()
  if (root && root.scrollHeight > root.clientHeight) root.scrollTo({ top, left: 0, behavior: 'instant' })
  else window.scrollTo({ top, left: 0, behavior: 'instant' })
}

/** How far the active scroller can go down right now. */
export const scrollMax = () => {
  const root = scrollRoot()
  const rootMax = root ? root.scrollHeight - root.clientHeight : 0
  return Math.max(rootMax, document.documentElement.scrollHeight - window.innerHeight)
}

export const scrollOffset = () => Math.max(window.scrollY || 0, scrollRoot()?.scrollTop || 0)

/** Subscribe to scrolling of both the window and #root; returns the unsubscribe. */
export function onScroll(handler) {
  const root = scrollRoot()
  window.addEventListener('scroll', handler, { passive: true })
  root?.addEventListener('scroll', handler, { passive: true })
  return () => { window.removeEventListener('scroll', handler); root?.removeEventListener('scroll', handler) }
}
