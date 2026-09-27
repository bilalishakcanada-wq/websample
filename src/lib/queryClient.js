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

/*
 * Only data that is either public or this person's own is written to the device. The job page
 * ('listing') carries other people's offers, and inbox, threads and notifications are private,
 * so anything not on this list stays in memory and is gone when the app closes.
 */
const PERSISTED = { search: true, feed: true, profile: true, me: new Set(['listings', 'bids', 'recommended', 'taste']) }
const canPersist = (query) => {
  if (query.meta?.persist === false) return false
  const [root, , part] = query.queryKey
  const rule = PERSISTED[root]
  return rule === true || (rule instanceof Set && rule.has(part))
}

export const persister = storage ? createSyncStoragePersister({
  storage,
  key: 'poso-query-cache',
  throttleTime: 1000,
  serialize: (client) => JSON.stringify({
    ...client,
    clientState: {
      ...client.clientState,
      queries: client.clientState.queries.filter((q) => canPersist(q) && JSON.stringify(q.state.data || '').length < 200_000),
    },
  }),
}) : null

export const persistOptions = {
  persister,
  maxAge: 24 * 60 * 60 * 1000,
  buster: import.meta.env.VITE_BUILD_ID || 'dev',
  dehydrateOptions: { shouldDehydrateQuery: (query) => query.state.status === 'success' && canPersist(query) },
}
