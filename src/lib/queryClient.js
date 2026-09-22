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

const storage = (() => {
  try { localStorage.setItem('poso-q-test', '1'); localStorage.removeItem('poso-q-test'); return localStorage } catch { return null }
})()

export const persister = storage ? createSyncStoragePersister({
  storage,
  key: 'poso-query-cache',
  throttleTime: 1000,
  // only small, public-ish lists are worth persisting; per-user private data stays in memory
  serialize: (client) => JSON.stringify({
    ...client,
    clientState: {
      ...client.clientState,
      queries: client.clientState.queries.filter((q) => q.meta?.persist !== false && JSON.stringify(q.state.data || '').length < 200_000),
    },
  }),
}) : null

export const persistOptions = {
  persister,
  maxAge: 24 * 60 * 60 * 1000,
  buster: import.meta.env.VITE_BUILD_ID || 'dev',
  dehydrateOptions: { shouldDehydrateQuery: (query) => query.state.status === 'success' && query.meta?.persist !== false },
}
