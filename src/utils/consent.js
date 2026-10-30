// The visitor's cookie / storage choice. Necessary storage (sign-in, drafts, settings) is always on;
// the only optional part is error reporting to Sentry, which starts only after "Prihvati sve" or
// after it is switched on in the settings.
const KEY = 'zadatak-consent'
const VERSION = 1
const listeners = new Set()

export function readConsent() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null')
    return saved && saved.v === VERSION ? saved : null
  } catch { return null }
}

export function saveConsent({ errors }) {
  const choice = { v: VERSION, errors: Boolean(errors), at: new Date().toISOString() }
  try { localStorage.setItem(KEY, JSON.stringify(choice)) } catch { /* private mode: asks again next visit */ }
  listeners.forEach((listener) => listener(choice))
  return choice
}

/** Re-opens the banner's settings (footer link, cookie policy page). */
export function openConsentSettings() {
  listeners.forEach((listener) => listener(readConsent(), true))
}

export function onConsentChange(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
