import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { notificationService } from '../services/notificationService'
import { keys } from './queryKeys'
import { clearDeliveredNotifications } from '../utils/push'

/** Number of unread notifications for the signed-in user, cached, live (new one in, or some marked read). */
export function useUnreadNotifications(userId) {
  const queryClient = useQueryClient()
  const { data } = useQuery({
    queryKey: keys.unreadNotifications(userId),
    queryFn: () => notificationService.unreadCount(),
    enabled: Boolean(userId),
    staleTime: 30 * 1000,
    meta: { persist: false },
  })
  useEffect(() => {
    if (!userId) return undefined
    const bump = () => {
      queryClient.invalidateQueries({ queryKey: keys.unreadNotifications(userId) })
      queryClient.invalidateQueries({ queryKey: keys.notifications(userId) })
    }
    const stop = notificationService.subscribe(userId, bump)
    window.addEventListener('zadatak:notifications-read', bump)
    return () => { stop(); window.removeEventListener('zadatak:notifications-read', bump) }
  }, [userId, queryClient])
  // everything read: the notifications still sitting on the phone / computer (and the app-icon dot) go too
  useEffect(() => {
    if (userId && data === 0) clearDeliveredNotifications()
  }, [userId, data])
  return data || 0
}
