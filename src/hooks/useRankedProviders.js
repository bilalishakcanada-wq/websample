import { useAuth } from '../context/AuthContext'
import { useProviderFeed } from './useFeed'
import { mockProfessionals } from '../data/mockData'

/** Suggested providers, ranked for the viewer's interests and city (see useFeed). */
export function useRankedProviders(limit = 6) {
  const { user } = useAuth()
  const { providers, loading } = useProviderFeed({ userId: user?.id ?? null, limit })

  const hasLive = providers.length > 0
  const combined = hasLive
    ? providers
    : mockProfessionals.map((p) => ({ ...p, isDemo: true }))

  return { combined, hasLive, loading }
}
