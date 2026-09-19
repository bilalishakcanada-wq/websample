import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { syncPush } from '../utils/push'
import { UPDATE_EVENT, isUpdateReady } from '../utils/appUpdates'
import { toast } from './Toaster'

const BASE = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')

/** Listens to the service worker: notification taps navigate in-app, endpoint rotations re-save the subscription. */
function SwBridge() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  // a new version installed while the user was typing: apply it on the next screen change
  useEffect(() => {
    if (isUpdateReady()) window.location.reload()
  }, [pathname])
  useEffect(() => {
    const onReady = () => toast('Nova verzija Poso.ba je spremna — primijenit će se na sljedećem ekranu.', { duration: 5000 })
    window.addEventListener(UPDATE_EVENT, onReady)
    return () => window.removeEventListener(UPDATE_EVENT, onReady)
  }, [])

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
