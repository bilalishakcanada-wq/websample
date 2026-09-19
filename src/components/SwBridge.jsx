import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { syncPush } from '../utils/push'

const BASE = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')

/** Listens to the service worker: notification taps navigate in-app, endpoint rotations re-save the subscription. */
function SwBridge() {
  const navigate = useNavigate()
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return undefined
    const onMessage = (event) => {
      const data = event.data || {}
      if (data.type === 'poso:navigate' && data.url) {
        try {
          const url = new URL(data.url)
          const path = url.pathname.startsWith(BASE) ? url.pathname.slice(BASE.length) : url.pathname
          navigate(`${path || '/'}${url.search}`)
        } catch { /* ignore malformed */ }
      }
      if (data.type === 'poso:resubscribe') syncPush()
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [navigate])
  return null
}

export default SwBridge
