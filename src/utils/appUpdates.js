/**
 * Keeps an installed app coherent across releases:
 *  - when a new service worker takes over an already-controlled page, reload once so
 *    the page never mixes old and new hashed chunks;
 *  - if a lazy route chunk fails to load (old build gone from the CDN), reload once.
 */
const RELOAD_FLAG = 'zadatak-chunk-reload'

export const UPDATE_EVENT = 'zadatak:update-ready'
let updateReady = false
export const isUpdateReady = () => updateReady

const typing = () => {
  const el = document.activeElement
  return Boolean(el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable))
}

const runningBuild = () => document.querySelector('meta[name="zadatak-build"]')?.content || ''
const BUILD_PARAM = 'v'

/**
 * Loads the newest index.html: the version query skips a stale HTTP-cached copy (GitHub Pages caches it
 * 10 min). The query goes on the current history entry and the page reloads, so the back stack stays as it was.
 */
function reloadFresh(build) {
  const url = new URL(window.location.href)
  url.searchParams.set(BUILD_PARAM, build)
  window.history.replaceState(window.history.state, '', url.toString())
  window.location.reload()
}

/**
 * Pages with no service worker in charge (the iOS app's WebView has none, and iOS keeps the app alive
 * in the background for days) never hear about a deploy. They read version.json on start, every hour
 * and on coming back to the foreground, and load the new build when it differs.
 */
function watchVersion(interacted) {
  const url = new URL(window.location.href)
  if (url.searchParams.has(BUILD_PARAM)) {
    url.searchParams.delete(BUILD_PARAM)
    window.history.replaceState(window.history.state, '', url.toString())
  }
  const current = runningBuild()
  if (!current) return // dev server
  const check = () => {
    if (updateReady || navigator.serviceWorker?.controller) return
    fetch(`${import.meta.env.BASE_URL}version.json`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const build = data?.build
        if (!build || build === current || updateReady) return
        // tried this build once already and still got the old page: leave it to the next start
        let tried = false
        try { tried = sessionStorage.getItem(RELOAD_FLAG + '-build') === build } catch { /* ignore */ }
        if (tried) return
        try { sessionStorage.setItem(RELOAD_FLAG + '-build', build) } catch { /* ignore */ }
        updateReady = true
        applyUpdate = () => reloadFresh(build)
        if (interacted() || typing()) window.dispatchEvent(new CustomEvent(UPDATE_EVENT))
        else reloadFresh(build)
      })
      .catch(() => {})
  }
  check()
  window.setInterval(check, 60 * 60 * 1000)
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check() })
}

let applyUpdate = () => window.location.reload()
/** Loads the version that is waiting (SwBridge calls it on the next screen change). */
export const reloadForUpdate = () => applyUpdate()

export function watchServiceWorkerUpdates() {
  // once someone has tapped or typed, the page may hold work that lives only in memory (picked photos,
  // the ID form): an update then waits for the next navigation (SwBridge) instead of reloading under them
  let interacted = false
  const mark = () => { interacted = true }
  window.addEventListener('pointerdown', mark, { once: true, capture: true })
  window.addEventListener('keydown', mark, { once: true, capture: true })
  watchVersion(() => interacted)
  if (!('serviceWorker' in navigator)) return
  let hadController = Boolean(navigator.serviceWorker.controller)
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) { hadController = true; return } // first install: nothing to swap
    if (updateReady) return
    updateReady = true
    if (interacted || typing()) window.dispatchEvent(new CustomEvent(UPDATE_EVENT))
    else window.location.reload()
  })
  // installed apps stay open for days: look for a new build every hour and when coming back to the foreground
  const check = () => navigator.serviceWorker.getRegistration().then((reg) => reg?.update()).catch(() => {})
  window.setInterval(check, 60 * 60 * 1000)
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check() })
}

/** import() wrapper for React.lazy: one automatic reload when a chunk is missing. */
export function lazyImport(factory) {
  return () => factory().then((module) => {
    try { sessionStorage.removeItem(RELOAD_FLAG) } catch { /* ignore */ }
    return module
  }).catch((error) => {
    const chunkGone = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(String(error?.message || error))
    let alreadyTried = false
    try { alreadyTried = sessionStorage.getItem(RELOAD_FLAG) === '1' } catch { /* ignore */ }
    if (chunkGone && !alreadyTried) {
      try { sessionStorage.setItem(RELOAD_FLAG, '1') } catch { /* ignore */ }
      // a plain reload can get the old index.html again from the HTTP cache (GitHub Pages keeps it
      // 10 min), which points at the same missing chunks: ask for the new build by its id instead
      fetch(`${import.meta.env.BASE_URL}version.json`, { cache: 'no-store' })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => (data?.build ? reloadFresh(data.build) : window.location.reload()))
        .catch(() => window.location.reload())
      return new Promise(() => {}) // keep Suspense pending while the page reloads
    }
    throw error
  })
}
