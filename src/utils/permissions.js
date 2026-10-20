// Lokacija i obavijesti, pitane u trenutku kad zatrebaju (components/RequiredPermissions.jsx). Kao na
// Airtaskeru ništa nije obavezno: lokaciju telefon traži tek kad osoba dodirne „Koristi moju lokaciju“
// (pretraga, igla na mapi, Postavke), a ko je odbije upiše mjesto ručno. Obavijesti se nude jednom i, kad ih
// osoba preskoči, ne pitaju ponovo 7 dana. Lokacija uređaja ide u bazu (report_device_location) i po njoj se
// pokazuje koliko je posao daleko. Obavijesti: Web Push u pregledniku, FCM u Android aplikaciji.
// Gdje uređaj obavijesti ne može (iPhone preglednik bez instalacije, Android build bez Firebasea),
// stanje je 'unsupported' i ne blokira: obavijesti tada stižu u aplikaciju i na email.
import { rpcFromBackground, supabase } from '../lib/supabase'
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
export const locationOk = (status) => Boolean(status) && passes(status.location)

// what each moment needs: `required` blocks the action until allowed, the rest is offered (and can be skipped)
export const PERMISSION_RULES = {
  account: { required: [], ask: ['notifications'] },
  post: { required: [], ask: ['notifications'] },
  offer: { required: [], ask: ['notifications'] },
  // only from a tap on "Poveži" / "Blizu mene": the search works without it (type a place instead)
  search: { required: [], ask: ['location'] },
}
const SNOOZE = 'zadatak-perm-snooze-'
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000

/** "Ne sada" on an optional step: that question waits a week. */
export const snoozePermission = (kind) => write(`${SNOOZE}${kind}`, String(Date.now()))
const snoozed = (kind) => Date.now() - Number(read(`${SNOOZE}${kind}`) || 0) < SNOOZE_MS

/**
 * The screens to show for this moment, in order. A required one shows whenever it is missing; an optional one
 * only while the phone can still ask (not after a refusal) and the person didn't skip it this week.
 */
export function permissionSteps(status, reason = 'account') {
  const rule = PERMISSION_RULES[reason] || PERMISSION_RULES.account
  return rule.ask.filter((kind) => {
    if (passes(status?.[kind])) return false
    if (rule.required.includes(kind)) return true
    return status?.[kind] === 'prompt' && !snoozed(kind)
  })
}

export const requiredOk = (status, reason = 'account') =>
  (PERMISSION_RULES[reason] || PERMISSION_RULES.account).required.every((kind) => passes(status?.[kind]))

/** Sends the device's position to the database (distance to jobs). Signed out or offline: nothing happens. */
export async function reportDeviceLocation(point) {
  if (!point) return
  const { data } = await supabase.auth.getSession()
  if (!data?.session) return
  const { error } = await rpcFromBackground('report_device_location', { p_lat: point.lat, p_lng: point.lng, p_accuracy_m: point.accuracy ?? null })
  if (!error) write(LAST_REPORT, String(Date.now()))
}

const within = (promise, ms) => Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve(null), ms))])

/**
 * Ask for location (call from a tap). Returns the new state; when a position came through
 * it is also reported to the database.
 */
export async function requestLocation() {
  try {
    const point = await currentLocation({ goodEnoughMeters: 500, waitMs: 10000 })
    write(GEO_OK, '1')
    // awaited (briefly): the distance to each job is measured from this point right after
    await within(reportDeviceLocation(point).catch(() => {}), 4000)
    return 'granted'
  } catch {
    // no position (GPS off, timeout) is not a refusal: the permission itself decides
    return locationPermission()
  }
}

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
