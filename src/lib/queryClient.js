import { QueryClient } from '@tanstack/react-query'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'

/**
 * One cache for every server read (TanStack Query, stale-while-revalidate):
 *  - a screen someone already saw paints instantly from cache, then refreshes in the background;
 *  - the cache survives reloads (localStorage) for a day, so even the first paint after a
 *    restart shows real data instead of spinners;
 *  - a new build invalidates the persisted cache (buster = build id) so shapes never mismatch.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 24 * 60 * 60 * 1000,
      retry: (failureCount, error) => failureCount < 1 && !/JWT|401|403/.test(String(error?.message || '')),
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  },
})

// 'device' = private data (own profile, inbox) that is persisted only inside the iOS/Android app, whose storage
// is the app's own sandbox on the owner's phone; in a browser it may be a shared computer, so it stays in memory.
// Either way queryClient.clear() on sign-out wipes it.
const inApp = () => typeof window !== 'undefined' && Boolean(window.Capacitor?.isNativePlatform?.())
const persistable = (meta) => meta?.persist !== false && (meta?.persist !== 'device' || inApp())

const storage = (() => {
  try { localStorage.setItem('zadatak-q-test', '1'); localStorage.removeItem('zadatak-q-test'); return localStorage } catch { return null }
})()

export const persister = storage ? createSyncStoragePersister({
  storage,
  key: 'zadatak-query-cache',
  throttleTime: 1000,
  // only small, public-ish lists are worth persisting; per-user private data stays in memory
  serialize: (client) => JSON.stringify({
    ...client,
    clientState: {
      ...client.clientState,
      queries: client.clientState.queries.filter((q) => persistable(q.meta) && JSON.stringify(q.state.data || '').length < 200_000),
    },
  }),
}) : null

export const persistOptions = {
  persister,
  maxAge: 24 * 60 * 60 * 1000,
  // the build id lives in index.html, not in the JS: baked into the entry it renamed ~70 unchanged chunks every deploy
  buster: (typeof document !== 'undefined' && document.querySelector('meta[name="zadatak-build"]')?.content) || 'dev',
  dehydrateOptions: { shouldDehydrateQuery: (query) => query.state.status === 'success' && persistable(query.meta) },
}
