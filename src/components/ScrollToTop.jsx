import { useEffect, useLayoutEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'
import { onScroll, scrollMax, scrollOffset, scrollToTop, scrollToY } from '../utils/scroll'
import { dropBootScreen } from '../utils/boot'
import { descriptionFor, titleFor } from '../utils/pageTitle'

// where each history entry was scrolled to (by location.key), kept for the tab's life
const POSITIONS = 'zadatak-scroll-positions'
const readPositions = () => { try { return JSON.parse(sessionStorage.getItem(POSITIONS) || '{}') } catch { return {} } }
const savePositions = (positions) => { try { sessionStorage.setItem(POSITIONS, JSON.stringify(positions)) } catch { /* private mode */ } }

/**
 * A new page starts at the top; Back / Forward return to where the person was on that page
 * (browsers can't do it themselves here: on phones #root scrolls, not the window). The saved
 * position is restored as the page's content arrives, and a touch or wheel by the person stops it.
 * Also tags <body data-page="…"> with the first path segment so CSS can adapt
 * chrome per screen (e.g. hide the site header inside the post wizard on phones).
 */
function ScrollToTop() {
  const location = useLocation()
  const { pathname, key } = location
  const navigationType = useNavigationType()
  const positions = useRef(null)
  if (positions.current === null) positions.current = readPositions()
  const currentKey = useRef(key)

  useEffect(() => {
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual'
    let timer = 0
    const remember = () => {
      positions.current[currentKey.current] = scrollOffset()
      window.clearTimeout(timer)
      timer = window.setTimeout(() => savePositions(positions.current), 300)
    }
    const stop = onScroll(remember)
    return () => { stop(); window.clearTimeout(timer) }
  }, [])

  // the position of the page being left was saved while scrolling; from the new screen's first paint on,
  // scrolls belong to the new entry (a shorter new page clamping the scroll must not overwrite the old one)
  useLayoutEffect(() => { currentKey.current = key }, [key])

  // before paint: screens that hide the site header (search, inbox, wizard…) must never show it for one frame
  useLayoutEffect(() => {
    document.body.dataset.page = pathname.split('/')[1] || 'home'
    document.title = titleFor(pathname)
    document.querySelector('meta[name="description"]')?.setAttribute('content', descriptionFor(pathname))
  }, [pathname])

  const lastPath = useRef(null)
  useEffect(() => {
    const samePage = lastPath.current === pathname
    lastPath.current = pathname
    // the pre-rendered welcome overlay only belongs to the visitor home; any other screen drops it
    if (pathname !== '/') dropBootScreen()
    const target = navigationType === 'POP' ? positions.current[key] : 0
    // same screen, new filter or tab in the URL: the person stays where they are
    if (samePage && !target) return undefined
    if (!target) { scrollToTop(); return undefined }

    // Back: the list or page may still be loading — keep trying until it is tall enough (max ~2 s)
    let frame = 0
    let cancelled = false
    const started = performance.now()
    const cancel = () => { cancelled = true }
    const step = () => {
      if (cancelled) return
      const reachable = scrollMax() >= target - 4
      scrollToY(Math.min(target, scrollMax()))
      if (reachable || performance.now() - started > 2000) return
      frame = requestAnimationFrame(step)
    }
    step()
    const userInput = ['wheel', 'touchstart', 'keydown', 'pointerdown']
    userInput.forEach((name) => window.addEventListener(name, cancel, { passive: true, once: true }))
    return () => {
      cancel()
      cancelAnimationFrame(frame)
      userInput.forEach((name) => window.removeEventListener(name, cancel))
    }
    // a new history entry (key) is a new screen, even on the same path
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

export default ScrollToTop
