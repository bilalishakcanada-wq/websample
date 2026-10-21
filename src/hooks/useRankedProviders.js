import { useAuth } from '../context/AuthContext'
import { useProviderFeed } from './useFeed'

/** Suggested providers, ranked for the viewer's interests and city (see useFeed). Only real people. */
export function useRankedProviders(limit = 6) {
  const { user } = useAuth()
  const { providers, loading } = useProviderFeed({ userId: user?.id ?? null, limit })

  return { providers, hasLive: providers.length > 0, loading }
}
