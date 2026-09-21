/**
 * On phones the document is fixed and #root is the scroller (see "Phone app shell" in App.css);
 * on wider screens the window scrolls. These helpers address whichever one is active.
 */
export const scrollRoot = () => document.getElementById('root')

export function scrollToTop() {
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  const root = scrollRoot()
  if (root) root.scrollTo({ top: 0, left: 0, behavior: 'instant' })
}

export const scrollOffset = () => Math.max(window.scrollY || 0, scrollRoot()?.scrollTop || 0)

/** Subscribe to scrolling of both the window and #root; returns the unsubscribe. */
export function onScroll(handler) {
  const root = scrollRoot()
  window.addEventListener('scroll', handler, { passive: true })
  root?.addEventListener('scroll', handler, { passive: true })
  return () => { window.removeEventListener('scroll', handler); root?.removeEventListener('scroll', handler) }
}
