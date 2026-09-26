import { flushSync } from 'react-dom'
import { withBase } from './paths'

// the tab bar's order: moving to a tab on the left slides the screen in from the left
const TABS = ['/', '/search', '/moji-poslovi', '/messages', '/account']
const tabIndex = (path) => (path === '/' ? 0 : TABS.findIndex((tab, index) => index > 0 && (path === tab || path.startsWith(`${tab}/`))))

/** 'back' when the link leads up the hierarchy (/account/profil → /account) or to a tab on the left. */
export function directionOf(from, to) {
  const a = tabIndex(from)
  const b = tabIndex(to)
  if (a >= 0 && b >= 0 && a !== b) return b < a ? 'back' : 'forward'
  if (to !== '/' && from.startsWith(`${to}/`)) return 'back'
  return 'forward'
}

/** Runs a navigation inside a view transition (same slide as link clicks), or plainly where unsupported. */
export function navigateWithTransition(navigate, to, options) {
  const toPath = to.split(/[?#]/)[0] || '/'
  const base = withBase('/').replace(/\/$/, '')
  const fromPath = window.location.pathname.slice(base.length) || '/'
  if (typeof document.startViewTransition !== 'function' || toPath === fromPath || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    navigate(to, options)
    return
  }
  const root = document.documentElement
  root.dataset.navDir = options?.dir || directionOf(fromPath, toPath)
  const transition = document.startViewTransition(() => { flushSync(() => navigate(to, options)) })
  transition.finished.finally(() => { delete root.dataset.navDir })
}
