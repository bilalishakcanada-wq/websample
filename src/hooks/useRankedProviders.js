import { useEffect, useState } from 'react'
import { providerService } from '../services/providerService'
import { mockProfessionals } from '../data/mockData'

export function useRankedProviders(limit = 6) {
  const [providers, setProviders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    providerService.listRanked({ limit })
      .then((rows) => active && setProviders(rows))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [limit])

  const hasLive = providers.length > 0
  const combined = hasLive
    ? providers
    : mockProfessionals.map((p) => ({ ...p, isDemo: true }))

  return { combined, hasLive, loading }
}
