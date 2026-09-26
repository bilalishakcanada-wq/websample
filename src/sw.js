/* eslint-env serviceworker */
// Poso.ba service worker: offline shell (workbox precache) + Web Push.
// Built by vite-plugin-pwa (injectManifest) — self.__WB_MANIFEST is filled at build time.
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { clientsClaim } from 'workbox-core'

self.skipWaiting()
clientsClaim()

const manifest = self.__WB_MANIFEST
precacheAndRoute(manifest)
cleanupOutdatedCaches()

// SPA navigation fallback (base-aware: index.html lives next to the SW).
// On the dev server the manifest is empty, so there is nothing to bind to.
const BASE = new URL('./', self.location.href).pathname
if (manifest.length > 0) {
  registerRoute(new NavigationRoute(createHandlerBoundToURL(`${BASE}index.html`), {
    denylist: [/^\/api\//, /\/storage\/v1\//, /\/functions\/v1\//, /\/auth\/v1\//],
  }))
}

// hashed build assets that are not precached (the map chunk): immutable, cache first
registerRoute(
  ({ url, request }) => (request.destination === 'script' || request.destination === 'worker') && url.origin === self.location.origin && /\/assets\/.*-[A-Za-z0-9_-]{8}\.js$/.test(url.pathname),
  new CacheFirst({ cacheName: 'poso-assets', plugins: [new ExpirationPlugin({ maxEntries: 40, maxAgeSeconds: 30 * 24 * 3600 })] }),
)

// the app's own photos (categories, cities): not precached, so a repeat visit would re-download them
registerRoute(
  ({ url, request }) => request.destination === 'image' && url.origin === self.location.origin && url.pathname.startsWith(`${BASE}images/`),
  new StaleWhileRevalidate({ cacheName: 'poso-images', plugins: [new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 30 * 24 * 3600 })] }),
)

// user media from Supabase Storage: cache first, a week
registerRoute(
  ({ url }) => url.hostname.endsWith('supabase.co') && url.pathname.startsWith('/storage/'),
  new CacheFirst({ cacheName: 'poso-media', plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 7 * 24 * 3600 })] }),
)
registerRoute(({ url }) => url.hostname.includes('fonts.g'), new StaleWhileRevalidate({ cacheName: 'poso-fonts' }))

// ---------- Web Push ----------
self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = { title: 'Poso.ba', body: event.data?.text() || '' } }
  const title = data.title || 'Poso.ba'
  const options = {
    body: data.body || '',
    icon: `${BASE}icons/icon-192.png`,
    badge: `${BASE}icons/badge-72.png`,
    tag: data.tag || 'poso',
    renotify: true,
    data: { url: data.url || `${self.location.origin}${BASE}`, id: data.id || null },
    vibrate: [80, 40, 80],
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = event.notification.data?.url || `${self.location.origin}${BASE}`
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    // reuse an open Poso.ba tab/app window when there is one
    for (const client of all) {
      if ('focus' in client) {
        await client.focus()
        if ('navigate' in client) { try { await client.navigate(target); return } catch { /* fall through */ } }
        client.postMessage({ type: 'poso:navigate', url: target })
        return
      }
    }
    await self.clients.openWindow(target)
  })())
})

// the app can ask a subscription change to be re-saved (e.g. push service rotated the endpoint)
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    all.forEach((client) => client.postMessage({ type: 'poso:resubscribe' }))
  })())
})
