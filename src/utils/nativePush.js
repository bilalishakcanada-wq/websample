// Phone notifications inside the Android app (Firebase Cloud Messaging through @capacitor/push-notifications).
// The WebView has no Web Push, so src/utils/push.js hands every call to this file when the site runs in the app.
// The device token goes to save_native_push_device; the database queues one delivery per device for every
// notification and the send-push-notification Edge Function sends it (channel zadatak-updates, icon ic_notification).
import { supabase } from '../lib/supabase'

const FLAG = 'zadatak-push' // same flag as Web Push: "this device wants notifications"
const TOKEN = 'zadatak-native-push-token'
export const NATIVE_PUSH_READY = 'zadatak:native-push-ready'
export const NATIVE_PUSH_OPEN = 'zadatak:native-push-open'

const cap = () => (typeof window !== 'undefined' ? window.Capacitor : null)
const plugin = () => (cap()?.isNativePlatform?.() && cap()?.getPlatform?.() === 'android' ? cap()?.Plugins?.PushNotifications : null)
const read = (key) => { try { return localStorage.getItem(key) } catch { return null } }
const write = (key, value) => { try { if (value == null) localStorage.removeItem(key); else localStorage.setItem(key, value) } catch { /* ignore */ } }

let ready = false // this app build has Firebase (google-services.json); without it register() would crash the app
let permission = 'default'
let pendingLink = null
let waiting = null
let readyCheck = Promise.resolve()

/** True inside the Android app, whether or not this build can deliver notifications yet. */
export const isNativePushApp = () => Boolean(plugin())
export const nativePushReady = () => ready
export const nativePushPermission = () => permission
/** Resolves once the app said whether this build can deliver notifications. */
export const nativePushChecked = () => readyCheck

const mapPermission = (state) => (state === 'granted' ? 'granted' : state === 'denied' ? 'denied' : 'default')

async function saveToken(token) {
  write(TOKEN, token)
  try { await supabase.rpc('save_native_push_device', { p_token: token, p_platform: 'android', p_environment: 'production' }) } catch { /* signed out or offline: saved on next sign-in */ }
}

function openLink(link) {
  if (typeof link !== 'string' || !link.startsWith('/') || link.startsWith('//')) link = '/account/obavijesti'
  pendingLink = link
  window.dispatchEvent(new CustomEvent(NATIVE_PUSH_OPEN, { detail: { link } }))
}

/** A tap that opened the app before the router was up; SwBridge takes it once it mounts. */
export function takePendingLink() {
  const link = pendingLink
  pendingLink = null
  return link
}

if (plugin()) {
  const push = plugin()
  // listeners first: a tap that cold-started the app is delivered as soon as one is attached
  push.addListener('registration', ({ value }) => {
    if (value) saveToken(value)
    waiting?.resolve(value)
  })
  push.addListener('registrationError', () => waiting?.resolve(null))
  push.addListener('pushNotificationActionPerformed', ({ notification }) => openLink(notification?.data?.link))
  readyCheck = Promise.resolve(cap()?.Plugins?.ZadatakNative?.pushInfo?.())
    .then(async (info) => {
      ready = Boolean(info?.available)
      if (ready) permission = mapPermission((await push.checkPermissions())?.receive)
    })
    .catch(() => { ready = false })
    .finally(() => window.dispatchEvent(new Event(NATIVE_PUSH_READY)))
}

function register() {
  const push = plugin()
  const token = new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 15000)
    waiting = { resolve: (value) => { clearTimeout(timer); waiting = null; resolve(value) } }
  })
  push.register().catch(() => waiting?.resolve(null))
  return token
}

/** Truthy when this phone is registered for notifications. */
export async function nativeSubscription() {
  await readyCheck
  if (!ready || permission !== 'granted' || read(FLAG) !== 'on') return null
  return read(TOKEN) ? { token: read(TOKEN) } : null
}

/** Ask Android for permission (13+ shows the system dialog) and register this phone. */
export async function enableNativePush() {
  const push = plugin()
  if (!push || !ready) return 'unsupported'
  const result = await push.requestPermissions()
  permission = mapPermission(result?.receive)
  if (permission !== 'granted') return permission
  const token = await register()
  if (!token) throw new Error('Telefon trenutno ne može uključiti obavijesti. Pokušaj ponovo za koji minut.')
  write(FLAG, 'on')
  return 'granted'
}

/** After sign-in: re-save the token for the account now signed in (FCM may also have rotated it). */
export async function syncNativePush() {
  await readyCheck
  if (!ready || permission !== 'granted' || read(FLAG) !== 'on') return
  await register()
}

/** Settings toggle (forget this phone) or sign-out (keepDevice: only detach it from the account). */
export async function disableNativePush({ keepDevice = false } = {}) {
  const token = read(TOKEN)
  if (token) { try { await supabase.rpc('delete_native_push_device', { p_token: token, p_platform: 'android' }) } catch { /* ignore */ } }
  if (keepDevice) return
  write(FLAG, null)
  write(TOKEN, null)
  try { await plugin()?.unregister() } catch { /* ignore */ }
}
