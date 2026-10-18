// Lokacija i obavijesti: obje su obavezne prije pravljenja računa i prije objave posla
// (components/RequiredPermissions.jsx). Lokacija uređaja ide u bazu (report_device_location), i po
// njoj se mjeri doseg ponuda (supabase/reach/01). Obavijesti: Web Push u pregledniku, FCM u Android aplikaciji.
// Gdje uređaj obavijesti ne može (iPhone preglednik bez instalacije, Android build bez Firebasea),
// stanje je 'unsupported' i ne blokira: obavijesti tada stižu u aplikaciju i na email.
import { supabase } from '../lib/supabase'
import { isNativeApp } from './native'
import { currentLocation, locationSupported } from './location'
import { enablePush, pushPermission, pushSupported } from './push'
import { nativePushChecked } from './nativePush'

const GEO_OK = 'zadatak-geo-ok' // Safari without the Permissions API: remember that a position came through
const LAST_REPORT = 'zadatak-geo-reported'
const REPORT_EVERY_MS = 6 * 60 * 60 * 1000

const read = (key) => { try { return localStorage.getItem(key) } catch { return null } }
const write = (key, value) => { try { localStorage.setItem(key, value) } catch { /* ignore */ } }

const nativeGeo = () => {
  const cap = window.Capacitor
  return isNativeApp() && cap?.isPluginAvailable?.('Geolocation') ? cap.Plugins.Geolocation : null
}

const mapState = (state) => (state === 'granted' ? 'granted' : state === 'denied' ? 'denied' : 'prompt')

/** 'granted' | 'denied' | 'prompt' | 'unsupported' — never shows a system dialog. */
export async function locationPermission() {
  if (!locationSupported()) return 'unsupported'
  const geo = nativeGeo()
  if (geo) {
    try { return mapState((await geo.checkPermissions())?.location) } catch { return 'prompt' }
  }
  try {
    const status = await navigator.permissions?.query({ name: 'geolocation' })
    if (status) return mapState(status.state)
  } catch { /* Safari before 16: no geolocation in the Permissions API */ }
  return read(GEO_OK) ? 'granted' : 'prompt'
}

/** 'granted' | 'denied' | 'prompt' | 'unsupported' — never shows a system dialog. */
export async function notificationPermission() {
  await nativePushChecked()
  if (!pushSupported()) return 'unsupported'
  const state = pushPermission()
  return state === 'unsupported' ? 'unsupported' : mapState(state)
}

export async function permissionStatus() {
  const [location, notifications] = await Promise.all([locationPermission(), notificationPermission()])
  return { location, notifications }
}

const passes = (state) => state === 'granted' || state === 'unsupported'
export const permissionsOk = (status) => Boolean(status) && passes(status.location) && passes(status.notifications)

/** Sends the device's position to the database (doseg ponuda). Signed out or offline: nothing happens. */
export async function reportDeviceLocation(point) {
  if (!point) return
  const { data } = await supabase.auth.getSession()
  if (!data?.session) return
  const { error } = await supabase.rpc('report_device_location', { p_lat: point.lat, p_lng: point.lng, p_accuracy_m: point.accuracy ?? null })
  if (!error) write(LAST_REPORT, String(Date.now()))
}

/**
 * Ask for location (call from a tap). Returns the new state; when a position came through
 * it is also reported to the database.
 */
export async function requestLocation() {
  try {
    const point = await currentLocation({ goodEnoughMeters: 500, waitMs: 10000 })
    write(GEO_OK, '1')
    reportDeviceLocation(point).catch(() => {})
    return 'granted'
  } catch {
    // no position (GPS off, timeout) is not a refusal: the permission itself decides
    return locationPermission()
  }
}

const within = (promise, ms) => Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve(null), ms))])

/** Ask for notifications (call from a tap). Returns the new state. */
export async function requestNotifications() {
  try {
    await within(enablePush(), 15000)
  } catch { /* allowed, but registering the device failed: syncPush retries on the next sign-in */ }
  return notificationPermission()
}

/** After sign-in (and on app start): refresh the device position when location is already allowed. Never prompts. */
export async function syncDeviceLocation() {
  if (Date.now() - Number(read(LAST_REPORT) || 0) < REPORT_EVERY_MS) return
  if ((await locationPermission()) !== 'granted') return
  try {
    const point = await currentLocation({ goodEnoughMeters: 500, waitMs: 8000 })
    await reportDeviceLocation(point)
  } catch { /* no fix right now: next time */ }
}

/** Android app: opens Zadatak's page in the phone settings (older app builds without it: false). */
export async function openAppSettings() {
  const plugin = window.Capacitor?.Plugins?.ZadatakNative
  if (!isNativeApp() || !plugin?.openAppSettings) return false
  try { await plugin.openAppSettings(); return true } catch { return false }
}
