import { useEffect } from 'react'
import { flushSync } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { withBase } from '../utils/paths'
import { directionOf } from '../utils/viewTransition'

/**
 * Native-feeling page changes: every in-app link click runs through the View Transitions API
 * (compositor-only, see the ::view-transition rules in App.css). Phones slide the screens in the
 * direction of travel, wider screens crossfade. Browsers without the API and people who asked
 * for reduced motion get the plain navigation.
 */
function ViewTransitions() {
  const navigate = useNavigate()
  useEffect(() => {
    if (typeof document.startViewTransition !== 'function') return undefined
    const onClick = (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null
      // links that manage their own history (the tab bar) animate themselves
      if (!anchor || anchor.dataset.ownNav != null || anchor.target === '_blank' || anchor.hasAttribute('download') || anchor.origin !== window.location.origin) return
      const base = withBase('/').replace(/\/$/, '')
      if (base && !anchor.pathname.startsWith(base)) return
      const toPath = anchor.pathname.slice(base.length) || '/'
      const fromPath = window.location.pathname.slice(base.length) || '/'
      const to = toPath + anchor.search + anchor.hash
      if (to === fromPath + window.location.search + window.location.hash) return
      // same page, new query/hash (filters, tabs in the URL): no screen change to animate
      if (toPath === fromPath) return
      event.preventDefault()
      const root = document.documentElement
      root.dataset.navDir = directionOf(fromPath, toPath)
      const transition = document.startViewTransition(() => { flushSync(() => navigate(to)) })
      transition.finished.finally(() => { delete root.dataset.navDir })
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [navigate])
  return null
}

export default ViewTransitions
