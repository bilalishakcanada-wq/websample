import { useEffect, useRef } from 'react'

/**
 * Lets the phone's back button (or swipe-back) close an overlay instead of leaving the page.
 * While `open` is true a history entry is pushed; popping it calls onClose. Closing by other
 * means pops that entry again so history stays clean.
 */
export function useBackToClose(open, onClose) {
  const pushedRef = useRef(false)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    if (!open) {
      if (pushedRef.current) {
        pushedRef.current = false
        // only pop our own entry; if a navigation already replaced it (link tapped inside
        // the overlay, filter written to the URL) leave history alone
        if (window.history.state?.posoOverlay) window.history.back()
      }
      return undefined
    }
    window.history.pushState({ ...(window.history.state || {}), posoOverlay: true }, '')
    pushedRef.current = true
    const onPop = () => { pushedRef.current = false; closeRef.current?.() }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [open])
}
