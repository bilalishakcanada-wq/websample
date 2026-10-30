import { isNativeApp } from './native'
import { supabase } from '../lib/supabase'
import { queryClient } from '../lib/queryClient'
import { clearNativeDelivered, disableNativePush, enableNativePush, isNativePushApp, nativePushChecked, nativePushPermission, nativePushReady, nativeSubscription, syncNativePush } from './nativePush'

/** Fired whenever the account's "Push obavijesti" switch may have changed (the bell re-reads it). */
export const PUSH_PREF_CHANGED = 'zadatak:push-pref'

/**
 * "Uključi" anywhere (settings, the soft prompt, the permission screen) means push is on for the account too:
 * a device that is allowed but whose account switch is off would otherwise stay silent.
 */
async function switchAccountPushOn() {
  try {
    const { data } = await supabase.auth.getSession()
    const userId = data?.session?.user?.id
    if (!userId) return
    await supabase.from('profiles').update({ notify_push: true }).eq('user_id', userId).eq('notify_push', false)
    queryClient.invalidateQueries({ queryKey: ['me', userId, 'bundle'] })
  } catch { /* offline: the settings switch still shows the stored value */ }
  window.dispatchEvent(new Event(PUSH_PREF_CHANGED))
}

// Public VAPID key (safe to ship); the private half lives in Supabase Vault.
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || 'BBHM1vtFJ3QAM8sIEsyHT2Zse7E5tFGMiLTsKMC_GgnskUgUY2V7RCqsK_mRhY2aBUOip20FOFNwNVQ-b9zYztk'

const webPushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

/** Browser can do Web Push at all (on iOS only once the app is installed to the home screen); in the Android app: phone notifications. */
export const pushSupported = () => (isNativePushApp() ? nativePushReady() : webPushSupported())

/** iOS Safari needs the PWA installed before push works. */
export const pushNeedsInstall = () => {
  if (isNativeApp()) return false // inside the app there is nothing to "install"
  const ua = navigator.userAgent
  const ios = /iPhone|iPad|iPod/.test(ua)
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true
  return ios && !standalone
}

export const pushPermission = () => (isNativePushApp() ? (nativePushReady() ? nativePushPermission() : 'unsupported') : webPushSupported() ? Notification.permission : 'unsupported')

const urlBase64ToUint8Array = (base64) => {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = window.atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)))
}

// serviceWorker.ready never settles when no worker is registered (blocked, failed install): give up after a while,
// otherwise the "Na ovom telefonu" row stays on "Provjeravam…" for good
const registration = async () => {
  const reg = await navigator.serviceWorker.getRegistration()
  return reg || Promise.race([navigator.serviceWorker.ready, new Promise((resolve) => setTimeout(() => resolve(null), 5000))])
}

/** Current subscription of this device, if any. */
export async function currentSubscription() {
  if (isNativePushApp()) return nativeSubscription()
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
  const result = await enableDevicePush()
  if (result === 'granted') await switchAccountPushOn()
  return result
}

async function enableDevicePush() {
  if (isNativePushApp()) return enableNativePush()
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
  try { localStorage.setItem('zadatak-push', 'on') } catch { /* ignore */ }
  return 'granted'
}

/** Re-save the existing subscription (after login on a device that already allowed push). */
export async function syncPush() {
  if (isNativePushApp()) return syncNativePush()
  const subscription = await currentSubscription()
  if (subscription && Notification.permission === 'granted') {
    try { await save(subscription) } catch { /* offline or signed out, try next time */ }
  }
}

/** Remove this device (used by the settings toggle and on sign-out). */
export async function disablePush({ keepDevice = false } = {}) {
  if (isNativePushApp()) return disableNativePush({ keepDevice })
  const subscription = await currentSubscription()
  if (!subscription) return
  try { await supabase.rpc('delete_push_subscription', { p_endpoint: subscription.endpoint }) } catch { /* ignore */ }
  if (!keepDevice) { try { await subscription.unsubscribe() } catch { /* ignore */ } }
  try { localStorage.removeItem('zadatak-push') } catch { /* ignore */ }
}

/**
 * Takes the already shown Zadatak notifications off the phone / computer (and with them the dot on the app icon).
 * Called once everything is read, and when push is switched off.
 */
export async function clearDeliveredNotifications() {
  if (isNativePushApp()) return clearNativeDelivered()
  if (!webPushSupported()) return
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    const shown = (await reg?.getNotifications?.()) || []
    shown.forEach((note) => note.close())
  } catch { /* nothing shown */ }
  try { await navigator.clearAppBadge?.() } catch { /* not an installed app */ }
}

/**
 * What the "obavijesti na ovom uređaju" switch shows: 'on' | 'off' | 'blocked' | 'install' | 'unsupported'
 * | 'native' (an app build that cannot deliver notifications yet).
 */
export async function pushDeviceState() {
  if (isNativePushApp()) {
    await nativePushChecked()
    if (!nativePushReady()) return 'native'
  } else if (isNativeApp()) return 'native'
  if (!pushSupported()) return pushNeedsInstall() ? 'install' : 'unsupported'
  if (pushPermission() === 'denied') return 'blocked'
  return (await currentSubscription()) ? 'on' : 'off'
}
