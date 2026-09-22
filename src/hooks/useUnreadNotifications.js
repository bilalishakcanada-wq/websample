import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { notificationService } from '../services/notificationService'
import { keys } from './queries'

/** Number of unread notifications for the signed-in user — cached, live (new one in, or some marked read). */
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
    window.addEventListener('poso:notifications-read', bump)
    return () => { stop(); window.removeEventListener('poso:notifications-read', bump) }
  }, [userId, queryClient])
  return data || 0
}
