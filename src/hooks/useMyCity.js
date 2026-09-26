import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { profileService } from '../services/profileService'

/** The signed-in person's profile city (what the reach rule measures from), or null. */
export function useMyCity() {
  const { user } = useAuth()
  const query = useQuery({
    queryKey: ['me', user?.id, 'city'],
    queryFn: () => profileService.getProfile(user.id).then((profile) => profile?.city || null),
    enabled: Boolean(user?.id),
    staleTime: 5 * 60_000,
    meta: { persist: false },
  })
  return user ? (query.data ?? null) : null
}
