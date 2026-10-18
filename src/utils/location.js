// One way to follow the phone's position on every platform:
//  - iOS / Android app → Capacitor's native Geolocation plugin (system permission dialog, GPS, no browser limits);
//  - browser (laptop, mobile web, installed web app) or an older app build without the plugin → HTML5 Geolocation.
//  - { background: true } in the app → @capacitor-community/background-geolocation: the position keeps coming
//    while the person uses other apps or locks the phone, with a notification on the phone as long as it runs
//    (Android foreground service "location"). A browser can't do this: there it stops when the page is hidden.
// Callers get the same { lat, lng, accuracy, heading, speed, at } shape and the same Bosnian error texts.
import { isNativeApp } from './native'

const nativeGeo = () => {
  const cap = window.Capacitor
  return isNativeApp() && cap?.isPluginAvailable?.('Geolocation') ? cap.Plugins.Geolocation : null
}

const backgroundGeo = () => {
  const cap = window.Capacitor
  return isNativeApp() && cap?.isPluginAvailable?.('BackgroundGeolocation') ? cap.Plugins.BackgroundGeolocation : null
}

/** True in an app build that can keep following the position with Zadatak in the background. */
export const backgroundLocationSupported = () => Boolean(backgroundGeo())

const OPTIONS = { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 }

const shape = (pos) => ({
  lat: pos.coords.latitude,
  lng: pos.coords.longitude,
  accuracy: pos.coords.accuracy,
  heading: Number.isFinite(pos.coords.heading) ? pos.coords.heading : null,
  speed: Number.isFinite(pos.coords.speed) ? pos.coords.speed : null,
  at: pos.timestamp || Date.now(),
})

export function locationErrorText(error) {
  const text = String(error?.message || error || '')
  if (error?.code === 1 || /denied|permission/i.test(text)) return 'Lokacija nije dozvoljena. Uključi je u postavkama telefona za Zadatak (ili za preglednik).'
  if (error?.code === 3 || /timeout/i.test(text)) return 'GPS ne javlja lokaciju. Izađi na otvoreno ili uključi lokaciju na telefonu.'
  if (/disabled|not enabled|location services/i.test(text)) return 'Lokacija na telefonu je isključena. Uključi je pa pokušaj ponovo.'
  return 'Lokacija trenutno nije dostupna.'
}

export const locationSupported = () => Boolean(nativeGeo() || (typeof navigator !== 'undefined' && navigator.geolocation))

const fromBackground = (loc) => ({
  lat: loc.latitude,
  lng: loc.longitude,
  accuracy: loc.accuracy,
  heading: Number.isFinite(loc.bearing) ? loc.bearing : null,
  speed: Number.isFinite(loc.speed) ? loc.speed : null,
  at: loc.time || Date.now(),
})

/**
 * Starts following the position. Returns stop(). onError gets a ready-to-show Bosnian sentence.
 * Without options it works while the app/page is open. background: { title, message } keeps it going
 * in the app with Zadatak in the background, and shows that notification on the phone meanwhile.
 */
export function watchLocation(onPosition, onError, { background } = {}) {
  let stopped = false
  const bg = background ? backgroundGeo() : null
  if (bg) {
    let watcherId = null
    Promise.resolve(bg.addWatcher({
      backgroundTitle: background.title,
      backgroundMessage: background.message,
      requestPermissions: true,
      stale: false,
      distanceFilter: background.distanceFilter ?? 20,
    }, (loc, error) => {
      if (stopped) return
      if (error) onError?.(locationErrorText(error.code === 'NOT_AUTHORIZED' ? Object.assign(error, { code: 1 }) : error))
      else if (loc) onPosition(fromBackground(loc))
    })).then((id) => {
      watcherId = id
      if (stopped) Promise.resolve(bg.removeWatcher({ id })).catch(() => {})
    }).catch((error) => { if (!stopped) onError?.(locationErrorText(error)) })
    return () => { stopped = true; if (watcherId) Promise.resolve(bg.removeWatcher({ id: watcherId })).catch(() => {}) }
  }

  const geo = nativeGeo()
  if (geo) {
    let watchId = null
    ;(async () => {
      try {
        const status = await geo.checkPermissions()
        if (status?.location !== 'granted') {
          const asked = await geo.requestPermissions({ permissions: ['location'] })
          if (asked?.location !== 'granted') throw Object.assign(new Error('permission denied'), { code: 1 })
        }
        if (stopped) return
        watchId = await geo.watchPosition(OPTIONS, (pos, error) => {
          if (stopped) return
          if (error) onError?.(locationErrorText(error))
          else if (pos) onPosition(shape(pos))
        })
        if (stopped && watchId) Promise.resolve(geo.clearWatch({ id: watchId })).catch(() => {})
      } catch (error) {
        if (!stopped) onError?.(locationErrorText(error))
      }
    })()
    return () => { stopped = true; if (watchId) Promise.resolve(geo.clearWatch({ id: watchId })).catch(() => {}) }
  }

  if (!navigator.geolocation) {
    onError?.('Ovaj preglednik ne zna lokaciju. Otvori Zadatak na telefonu.')
    return () => {}
  }
  const id = navigator.geolocation.watchPosition(
    (pos) => { if (!stopped) onPosition(shape(pos)) },
    (error) => { if (!stopped) onError?.(locationErrorText(error)) },
    OPTIONS,
  )
  return () => { stopped = true; navigator.geolocation.clearWatch(id) }
}

/** Keeps the screen on while the provider is on the way (the position only flows while Zadatak is open). */
export async function keepScreenOn() {
  try {
    const lock = await navigator.wakeLock?.request('screen')
    if (!lock) return () => {}
    let current = lock
    const again = async () => { if (document.visibilityState === 'visible' && current?.released) current = await navigator.wakeLock.request('screen').catch(() => null) }
    document.addEventListener('visibilitychange', again)
    return () => { document.removeEventListener('visibilitychange', again); current?.release?.().catch(() => {}) }
  } catch {
    return () => {}
  }
}

/** Metres between two points (haversine). */
export function distanceMeters(a, b) {
  const rad = (deg) => deg * Math.PI / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * 6371000 * Math.asin(Math.sqrt(h))
}

/**
 * One position for "Koristi moju lokaciju": the first fix good to about 100 m, or the best one after
 * a few seconds. Resolves { lat, lng, accuracy }; rejects with a ready-to-show Bosnian sentence.
 */
export function currentLocation({ goodEnoughMeters = 100, waitMs = 8000 } = {}) {
  return new Promise((resolve, reject) => {
    let best = null
    let done = false
    let stop = () => {}
    const finish = (error) => {
      if (done) return
      done = true
      clearTimeout(timer)
      stop()
      if (best) resolve({ lat: best.lat, lng: best.lng, accuracy: best.accuracy })
      else reject(error || 'Lokacija trenutno nije dostupna.')
    }
    const timer = setTimeout(() => finish(), waitMs)
    stop = watchLocation((position) => {
      if (!best || (position.accuracy ?? Infinity) < (best.accuracy ?? Infinity)) best = position
      if ((position.accuracy ?? Infinity) <= goodEnoughMeters) finish()
    }, (message) => { if (!best) finish(message) })
  })
}
