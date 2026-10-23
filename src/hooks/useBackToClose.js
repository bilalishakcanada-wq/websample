import { useCallback, useEffect, useRef } from 'react'

// overlays holding a history entry right now; an overlay entry nobody holds is left over
let openOverlays = 0

/*
 * An overlay closed by a link inside it (the new page was pushed on top) or by a reload leaves
 * its entry behind. Landing on such an entry would make one back press do nothing visible, so
 * step straight past it: every press of back always shows the previous screen.
 */
if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    window.setTimeout(() => {
      if (window.history.state?.zadatakOverlay && openOverlays === 0) window.history.back()
    }, 0)
  })
}

/**
 * Pops the entry this hook pushed, after this commit's other effects (the page may have just
 * replaced the URL), and keeps whatever URL the page wrote meanwhile, since the pop would drop it.
 */
function popOwnEntry(lengthAtPush) {
  window.setTimeout(() => {
    // a link tapped inside the overlay already pushed a new page: leave history alone
    if (window.history.length > lengthAtPush) return
    const wanted = window.location.href
    const restore = () => {
      window.removeEventListener('popstate', restore)
      if (window.location.href === wanted) return
      window.history.replaceState(window.history.state, '', wanted)
      window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }))
    }
    window.addEventListener('popstate', restore)
    window.history.back()
  }, 0)
}

/**
 * Lets the phone's back button (or swipe-back) close an overlay instead of leaving the page.
 * While `open` is true a history entry is pushed; popping it calls onClose. Closing by other
 * means pops that entry again so history stays clean.
 */
export function useBackToClose(open, onClose) {
  const pushedRef = useRef(false)
  const lengthRef = useRef(0)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  const release = () => {
    if (!pushedRef.current) return false
    pushedRef.current = false
    openOverlays = Math.max(0, openOverlays - 1)
    return true
  }

  useEffect(() => {
    if (!open) {
      if (release()) popOwnEntry(lengthRef.current)
      return undefined
    }
    window.history.pushState({ ...(window.history.state || {}), zadatakOverlay: true }, '')
    pushedRef.current = true
    openOverlays += 1
    lengthRef.current = window.history.length
    const onPop = () => { if (release()) closeRef.current?.() }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [open])

  // an overlay that only exists while open (unmounted to close it) gives its entry back too
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (release()) popOwnEntry(lengthRef.current) }, [])
}

/**
 * Multi-step flows (post a job, intro slides): the phone's back button goes one step back, the
 * same as the on-screen arrow, instead of throwing away the whole flow. One history entry stands
 * in for "not on the first step"; each pop steps back and, while steps remain, puts it back.
 * Returns leave(then): drops that entry first, then runs `then` (e.g. go back out of the flow).
 */
export function useBackSteps(step, first, onStepBack) {
  const pushedRef = useRef(false)
  const lengthRef = useRef(0)
  const backRef = useRef(onStepBack)
  backRef.current = onStepBack
  const idRef = useRef('')
  const active = step > first

  // back on a flow page that already has its entry (a reload, or back from signing in): reuse it
  useEffect(() => {
    const mark = window.history.state?.zadatakStep
    if (!mark) return
    idRef.current = mark
    pushedRef.current = true
    lengthRef.current = window.history.length
  }, [])

  useEffect(() => {
    if (active && !pushedRef.current) {
      if (!idRef.current) idRef.current = Math.random().toString(36).slice(2)
      window.history.pushState({ ...(window.history.state || {}), zadatakStep: idRef.current }, '')
      pushedRef.current = true
      lengthRef.current = window.history.length
    } else if (!active && pushedRef.current) {
      pushedRef.current = false
      popOwnEntry(lengthRef.current)
    }
  }, [active, step])

  useEffect(() => {
    const onPop = () => {
      // an overlay above our entry closing lands back on it (it carries our mark): not a step back
      if (!pushedRef.current || window.history.state?.zadatakStep === idRef.current) return
      pushedRef.current = false
      backRef.current?.()
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  return useCallback((then) => {
    if (!pushedRef.current) { then(); return }
    pushedRef.current = false
    const after = () => { window.removeEventListener('popstate', after); then() }
    window.addEventListener('popstate', after)
    window.history.back()
  }, [])
}
