import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { syncPush } from '../utils/push'
import { NATIVE_PUSH_OPEN, takePendingLink } from '../utils/nativePush'
import { UPDATE_EVENT, isUpdateReady, reloadForUpdate } from '../utils/appUpdates'
import { toast } from './Toaster'

const BASE = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')

/** Listens to the service worker (and, in the Android app, to phone notifications): taps navigate in-app, endpoint rotations re-save the subscription. */
function SwBridge() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  // a new version installed while the user was typing: apply it on the next screen change
  useEffect(() => {
    if (isUpdateReady()) reloadForUpdate()
  }, [pathname])
  useEffect(() => {
    const onReady = () => toast('Nova verzija Zadatka je spremna — primijenit će se na sljedećem ekranu.', { duration: 5000 })
    window.addEventListener(UPDATE_EVENT, onReady)
    return () => window.removeEventListener(UPDATE_EVENT, onReady)
  }, [])

  // Android app: a tapped phone notification opens its page (also the tap that started the app)
  useEffect(() => {
    const open = () => { const link = takePendingLink(); if (link) navigate(link) }
    open()
    window.addEventListener(NATIVE_PUSH_OPEN, open)
    return () => window.removeEventListener(NATIVE_PUSH_OPEN, open)
  }, [navigate])

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return undefined
    const onMessage = (event) => {
      const data = event.data || {}
      if ((data.type === 'zadatak:navigate' || data.type === 'poso:navigate') && data.url) {
        try {
          const url = new URL(data.url)
          const path = url.pathname.startsWith(BASE) ? url.pathname.slice(BASE.length) : url.pathname
          navigate(`${path || '/'}${url.search}`)
        } catch { /* ignore malformed */ }
      }
      if (data.type === 'zadatak:resubscribe' || data.type === 'poso:resubscribe') syncPush()
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [navigate])
  return null
}

export default SwBridge
