import { useEffect, useRef } from 'react'

/**
 * Lets the phone's back button (or swipe-back) close an overlay instead of leaving the page.
 * While `open` is true a history entry is pushed; popping it calls onClose. Closing by other
 * means pops that entry again so history stays clean — and keeps whatever URL the page wrote
 * meanwhile (e.g. a filter chosen inside the popover), since the pop would otherwise drop it.
 */
export function useBackToClose(open, onClose) {
  const pushedRef = useRef(false)
  const lengthRef = useRef(0)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    if (!open) {
      if (pushedRef.current) {
        pushedRef.current = false
        // after this commit's other effects (the page may have just replaced the URL)
        window.setTimeout(() => {
          // a link tapped inside the overlay already pushed a new page: leave history alone
          if (window.history.length > lengthRef.current) return
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
      return undefined
    }
    window.history.pushState({ ...(window.history.state || {}), posoOverlay: true }, '')
    pushedRef.current = true
    lengthRef.current = window.history.length
    const onPop = () => { pushedRef.current = false; closeRef.current?.() }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [open])
}
