// One rule for "back" everywhere (on-screen arrow, browser back, Android back, iOS swipe):
// go exactly one step up, and never drop someone off the site by surprise.
import { withBase } from './paths'

const BASE = withBase('/').replace(/\/$/, '')

/** The app path of the current page, without the GitHub Pages sub-path. */
export const appPath = () => window.location.pathname.slice(BASE.length) || '/'

/** Where "up" leads from a page when there is no earlier in-app screen to return to. */
export function parentOf(path, search = '') {
  if (path === '/') return null
  if (path === '/messages' && new URLSearchParams(search).get('c')) return '/messages'
  if (path.startsWith('/account/')) return '/account'
  if (path.startsWith('/listings/')) return '/search'
  return '/'
}

/**
 * True when the screen before this one was ours. React Router numbers every entry it makes
 * (history.state.idx, 0 = the first page of the visit), so idx > 0 means back stays in the app.
 */
export const canGoBackInApp = () => (window.history.state?.idx ?? 0) > 0

/**
 * Someone who opens a deep link (a job, a profile, an account page) straight from outside
 * has no screen of ours behind it, so back would close the site. Before the router starts,
 * slip the page's parents in underneath: back then walks up to the home screen first.
 * Reloads keep their history (state is already set) and are left alone.
 */
export function seedHistory() {
  try {
    if (window.history.state != null) return
    const q = new URLSearchParams(window.location.search)
    if (window.location.hash.includes('access_token=') || q.get('code')) return // OAuth return, handled elsewhere
    const here = window.location.pathname + window.location.search + window.location.hash
    const chain = []
    for (let up = parentOf(appPath(), window.location.search); up; up = parentOf(up)) chain.unshift(up)
    if (chain.length === 0) return
    const key = () => Math.random().toString(36).slice(2, 10)
    window.history.replaceState({ usr: null, key: key(), idx: 0 }, '', withBase(chain[0]))
    chain.slice(1).forEach((path, index) => window.history.pushState({ usr: null, key: key(), idx: index + 1 }, '', withBase(path)))
    window.history.pushState({ usr: null, key: key(), idx: chain.length }, '', here)
  } catch { /* history API unavailable: plain behaviour */ }
}
