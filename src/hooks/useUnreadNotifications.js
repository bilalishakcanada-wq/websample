import { useEffect, useState } from 'react'
import { notificationService } from '../services/notificationService'

/** Number of unread notifications for the signed-in user — live (new one in, or some marked read). */
export function useUnreadNotifications(userId) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!userId) { setCount(0); return undefined }
    let alive = true
    const load = () => notificationService.unreadCount().then((n) => alive && setCount(n))
    load()
    const stop = notificationService.subscribe(userId, () => load())
    window.addEventListener('poso:notifications-read', load)
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { alive = false; stop(); window.removeEventListener('poso:notifications-read', load); document.removeEventListener('visibilitychange', onVisible) }
  }, [userId])

  return count
}
