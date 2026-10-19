// "Dijeli lokaciju tokom posla" (Postavke → Lokacija): when the client on an accepted job asks where the
// provider is, the location is shared on its own instead of waiting for a tap (components/LiveTracking.jsx).
// Off until the person turns it on; per device, like the location permission itself.
const KEY = 'zadatak-job-share-auto'

export const isJobShareAuto = () => { try { return localStorage.getItem(KEY) === 'on' } catch { return false } }

export function setJobShareAuto(on) {
  try { localStorage.setItem(KEY, on ? 'on' : 'off') } catch { /* private mode */ }
}
