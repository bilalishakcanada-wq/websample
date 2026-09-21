import { isNativeApp } from './native'
import { supabase } from '../lib/supabase'

// Public VAPID key (safe to ship); the private half lives in Supabase Vault.
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || 'BBHM1vtFJ3QAM8sIEsyHT2Zse7E5tFGMiLTsKMC_GgnskUgUY2V7RCqsK_mRhY2aBUOip20FOFNwNVQ-b9zYztk'

/** Browser can do Web Push at all (on iOS only once the app is installed to the home screen). */
export const pushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

/** iOS Safari needs the PWA installed before push works. */
export const pushNeedsInstall = () => {
  if (isNativeApp()) return false // inside the app there is nothing to "install"
  const ua = navigator.userAgent
  const ios = /iPhone|iPad|iPod/.test(ua)
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true
  return ios && !standalone
}

export const pushPermission = () => (pushSupported() ? Notification.permission : 'unsupported')

const urlBase64ToUint8Array = (base64) => {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = window.atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)))
}

const registration = async () => {
  const reg = await navigator.serviceWorker.getRegistration()
  return reg || navigator.serviceWorker.ready
}

/** Current subscription of this device, if any. */
export async function currentSubscription() {
  if (!pushSupported()) return null
  try {
    const reg = await registration()
    return (await reg?.pushManager.getSubscription()) || null
  } catch {
    return null
  }
}

const save = async (subscription) => {
  const json = subscription.toJSON()
  const { error } = await supabase.rpc('save_push_subscription', {
    p_endpoint: json.endpoint,
    p_p256dh: json.keys.p256dh,
    p_auth: json.keys.auth,
    p_user_agent: navigator.userAgent,
  })
  if (error) throw error
}

/**
 * Ask for permission (must be called from a user gesture) and register this device.
 * Returns 'granted' | 'denied' | 'unsupported'.
 */
export async function enablePush() {
  if (!pushSupported()) return 'unsupported'
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission
  const reg = await registration()
  if (!reg) return 'unsupported'
  let subscription = await reg.pushManager.getSubscription()
  if (!subscription) {
    subscription = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) })
  }
  await save(subscription)
  try { localStorage.setItem('poso-push', 'on') } catch { /* ignore */ }
  return 'granted'
}

/** Re-save the existing subscription (after login on a device that already allowed push). */
export async function syncPush() {
  const subscription = await currentSubscription()
  if (subscription && Notification.permission === 'granted') {
    try { await save(subscription) } catch { /* offline or signed out — try next time */ }
  }
}

/** Remove this device (used by the settings toggle and on sign-out). */
export async function disablePush({ keepDevice = false } = {}) {
  const subscription = await currentSubscription()
  if (!subscription) return
  try { await supabase.rpc('delete_push_subscription', { p_endpoint: subscription.endpoint }) } catch { /* ignore */ }
  if (!keepDevice) { try { await subscription.unsubscribe() } catch { /* ignore */ } }
  try { localStorage.removeItem('poso-push') } catch { /* ignore */ }
}
