import { useCallback, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { savedService } from '../services/savedService'
import { keys } from './queryKeys'
import { toast } from '../components/Toaster'
import { haptic } from '../utils/native'

/**
 * Saved jobs for the signed-in person: `isSaved(id)` and `toggle(id)` (optimistic).
 * Guests who tap "Sačuvaj" are sent to sign in and come back to the same page.
 */
export function useSaved() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const userId = user?.id
  const query = useQuery({
    queryKey: keys.savedIds(userId),
    queryFn: () => savedService.ids(userId),
    enabled: Boolean(userId),
    staleTime: 60_000,
  })
  const set = useMemo(() => new Set(query.data || []), [query.data])
  const isSaved = useCallback((id) => set.has(id), [set])

  const toggle = useCallback(async (id) => {
    if (!userId) {
      navigate(`/login?next=${encodeURIComponent(location.pathname + location.search)}`)
      return
    }
    const next = !set.has(id)
    haptic('light')
    queryClient.setQueryData(keys.savedIds(userId), (current = []) => (next ? [...current, id] : current.filter((item) => item !== id)))
    try {
      await savedService.set(userId, id, next)
      toast(next ? 'Posao je sačuvan. Nađeš ga u „Moji poslovi“.' : 'Uklonjeno iz sačuvanih.', { kind: 'success' })
    } catch (error) {
      queryClient.setQueryData(keys.savedIds(userId), (current = []) => (next ? current.filter((item) => item !== id) : [...current, id]))
      toast(error.message, { kind: 'error' })
    } finally {
      queryClient.invalidateQueries({ queryKey: keys.savedListings(userId) })
    }
  }, [userId, set, navigate, location, queryClient])

  return { isSaved, toggle, signedIn: Boolean(userId) }
}
