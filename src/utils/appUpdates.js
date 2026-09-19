/**
 * Keeps an installed app coherent across releases:
 *  - when a new service worker takes over an already-controlled page, reload once so
 *    the page never mixes old and new hashed chunks;
 *  - if a lazy route chunk fails to load (old build gone from the CDN), reload once.
 */
const RELOAD_FLAG = 'poso-chunk-reload'

export function watchServiceWorkerUpdates() {
  if (!('serviceWorker' in navigator)) return
  let hadController = Boolean(navigator.serviceWorker.controller)
  let reloading = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) { hadController = true; return } // first install: nothing to swap
    if (reloading) return
    reloading = true
    window.location.reload()
  })
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
      window.location.reload()
      return new Promise(() => {}) // keep Suspense pending while the page reloads
    }
    throw error
  })
}
