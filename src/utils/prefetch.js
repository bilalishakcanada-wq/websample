/**
 * Warms the code for the screens people open next, so tab switches feel instant
 * (the chunks are the same ones React.lazy loads — the browser just has them cached).
 */
const ROUTES = {
  '/search': () => import('../pages/SearchPage'),
  '/messages': () => import('../pages/MessagesPage'),
  '/account': () => import('../pages/account/AccountLayout').then(() => import('../pages/DashboardPage')),
  '/objavi': () => import('../pages/PostTaskPage'),
  '/listings': () => import('../pages/ListingDetailPage'),
  '/pomoc': () => import('../pages/HelpPage'),
}

const done = new Set()

export function prefetchRoute(path) {
  const key = Object.keys(ROUTES).find((prefix) => path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`))
  if (!key || done.has(key)) return
  done.add(key)
  ROUTES[key]().catch(() => done.delete(key))
}

/** After the first screen is idle, fetch the main tabs in the background (skipped on slow/metered connections). */
export function warmMainRoutes() {
  const connection = navigator.connection
  if (connection && (connection.saveData || /2g/.test(connection.effectiveType || ''))) return
  const run = () => ['/search', '/listings', '/messages', '/account', '/objavi'].forEach(prefetchRoute)
  if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 4000 })
  else window.setTimeout(run, 2500)
}
