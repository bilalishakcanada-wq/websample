import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { profileService } from '../services/profileService'
import { locationService } from '../services/locationService'

/** The signed-in person's profile city (what the reach rule measures from), or null. */
export function useMyCity() {
  const { user } = useAuth()
  const query = useQuery({
    queryKey: ['me', user?.id, 'city'],
    // a settlement ("Otes, Ilidža") gets its own point on this device before anything measures from it
    queryFn: () => profileService.getProfile(user.id).then(async (profile) => {
      const city = profile?.city || null
      if (city) await locationService.ensure(city).catch(() => false)
      return city
    }),
    enabled: Boolean(user?.id),
    staleTime: 60_000,
    meta: { persist: false },
  })
  return user ? (query.data ?? null) : null
}
