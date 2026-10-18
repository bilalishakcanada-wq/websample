// "Lokacija uživo" (Postavke → Lokacija): while Zadatak is open, the device's position follows the person
// and goes to the database (report_device_location), so doseg ponuda is always measured from where they are
// right now, not from the profile city. In the app it keeps going with Zadatak in the background (other apps
// open, phone locked) and the phone shows a notification meanwhile; in a browser only while the page is open.
// The switch is per device (the permission is too), kept in localStorage.
import { watchLocation, distanceMeters } from './location'

// the notification the phone shows while the position is followed in the background (Android)
export const LIVE_REACH_NOTICE = {
  title: 'Lokacija uživo je uključena',
  message: 'Zadatak prati gdje si da vidiš poslove u svom dosegu. Isključi u Postavke → Lokacija.',
}
import { reportDeviceLocation } from './permissions'

const KEY = 'zadatak-live-reach'
export const LIVE_REACH_EVENT = 'zadatak:live-reach'
export const LIVE_REACH_REPORTED = 'zadatak:live-reach-reported'

// a new point goes out when the person moved this far, or after this long with some movement
const MOVE_METERS = 250
const EVERY_MS = 60 * 1000
const SMALL_MOVE_METERS = 40

export const isLiveReachOn = () => { try { return localStorage.getItem(KEY) === 'on' } catch { return false } }

export function setLiveReach(on) {
  try { if (on) localStorage.setItem(KEY, 'on'); else localStorage.setItem(KEY, 'off') } catch { /* private mode */ }
  window.dispatchEvent(new CustomEvent(LIVE_REACH_EVENT, { detail: { on } }))
}

/** True when the person never chose: the first allowed location turns it on. */
export const liveReachUndecided = () => { try { return localStorage.getItem(KEY) == null } catch { return false } }

/**
 * Follows the position and reports it when it changed enough. onReport({ lat, lng, accuracy, at }) after
 * each saved point; onError(text) when the position can't be read. Returns stop().
 */
export function startLiveReach({ onReport, onError } = {}) {
  let last = null
  let sending = false
  return watchLocation(async (position) => {
    if (sending) return
    const moved = last ? distanceMeters(last, position) : Infinity
    const waited = last ? Date.now() - last.at : Infinity
    if (moved < MOVE_METERS && !(waited >= EVERY_MS && moved >= SMALL_MOVE_METERS)) return
    sending = true
    try {
      await reportDeviceLocation(position)
      last = { lat: position.lat, lng: position.lng, at: Date.now() }
      onReport?.({ ...last, accuracy: position.accuracy })
      window.dispatchEvent(new CustomEvent(LIVE_REACH_REPORTED, { detail: last }))
    } catch { /* offline: the next position tries again */ } finally {
      sending = false
    }
  }, onError, { background: LIVE_REACH_NOTICE })
}
