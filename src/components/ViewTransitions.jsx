import { useEffect } from 'react'
import { flushSync } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { withBase } from '../utils/paths'

/**
 * Native-feeling page changes on phones: every in-app link click runs through the View
 * Transitions API (the old screen slides/fades out, the new one in — compositor-only, see the
 * ::view-transition rules in App.css). Browsers without the API, desktops and people who asked
 * for reduced motion get the plain navigation.
 */
function ViewTransitions() {
  const navigate = useNavigate()
  useEffect(() => {
    if (typeof document.startViewTransition !== 'function') return undefined
    const onClick = (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      if (!window.matchMedia('(max-width: 768px)').matches || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download') || anchor.origin !== window.location.origin) return
      const base = withBase('/').replace(/\/$/, '')
      if (base && !anchor.pathname.startsWith(base)) return
      const to = anchor.pathname.slice(base.length) + anchor.search + anchor.hash
      if (to === window.location.pathname.slice(base.length) + window.location.search + window.location.hash) return
      event.preventDefault()
      document.startViewTransition(() => { flushSync(() => navigate(to || '/')) })
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [navigate])
  return null
}

export default ViewTransitions
