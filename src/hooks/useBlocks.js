import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { blockService } from '../services/blockService'
import { keys } from './queryKeys'
import { confirmDialog } from '../utils/dialog'

const EMPTY = []

/** My blocked users plus block/unblock with a confirmation. One cache for chat, profiles and settings. */
export function useBlocks() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: keys.blocks(user?.id),
    queryFn: () => blockService.list(user.id),
    enabled: Boolean(user?.id),
    staleTime: 60 * 1000,
  })
  const blocked = query.data || EMPTY
  const isBlocked = (otherId) => blocked.some((row) => row.user_id === otherId)

  /** Returns true when the state changed; throws the service error for the screen to show. */
  const toggle = async (otherId, name = 'ovog korisnika') => {
    if (!user?.id || !otherId) return false
    const next = !isBlocked(otherId)
    const ok = await confirmDialog(next
      ? { title: `Blokirati ${name}?`, text: 'Neće ti moći slati poruke, ponude ni pitanja na tvojim poslovima, a ni ti njemu/njoj. Ne javljamo mu/joj da je blokiran/a. Odblokirati možeš kad hoćeš u Postavkama.', confirmLabel: 'Blokiraj', danger: true }
      : { title: `Odblokirati ${name}?`, text: 'Opet ćete moći razmjenjivati poruke i ponude.', confirmLabel: 'Odblokiraj' })
    if (!ok) return false
    await blockService.set(user.id, otherId, next)
    await queryClient.invalidateQueries({ queryKey: keys.blocks(user.id) })
    return true
  }

  return { blocked, isBlocked, toggle, loading: query.isLoading }
}
