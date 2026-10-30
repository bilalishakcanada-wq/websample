import { supabase } from '../lib/supabase'
import { onConsentChange, readConsent } from './consent'

const seen = new Set()
const IGNORE = /ResizeObserver loop|Script error\.?$|Failed to fetch dynamically imported module|Load failed|NetworkError|AbortError/i

// crawlers (Google's Play Store and search bots) refuse the service worker; nothing breaks for a person
const swRefused = (error) => /serviceWorker\.register|ServiceWorkerContainer\.register/.test(error?.stack || '')

const ignored = (error, message) => IGNORE.test(message) || swRefused(error)

// Sentry loads only when the build has a DSN (VITE_SENTRY_DSN) and the visitor allowed error reports
// in the cookie banner, in its own chunk after the page is up
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN
let sentry = null
let sentryStarting = false

function startSentry() {
  if (!SENTRY_DSN || sentry || sentryStarting) return
  sentryStarting = true
  import('@sentry/react').then((Sentry) => {
    Sentry.init({
      dsn: SENTRY_DSN,
      release: document.querySelector('meta[name="zadatak-build"]')?.content || undefined,
      environment: window.Capacitor?.isNativePlatform?.() ? `app-${window.Capacitor.getPlatform()}` : 'web',
      sendDefaultPii: false,
      beforeSend(event, hint) {
        const error = hint?.originalException
        const message = error?.message || event.message || ''
        return ignored(error, message) ? null : event
      },
    })
    sentry = Sentry
    // the choice can be withdrawn while the chunk was loading
    if (!readConsent()?.errors) stopSentry()
  }).catch(() => {}).finally(() => { sentryStarting = false })
}

function stopSentry() {
  if (!sentry) return
  sentry.close().catch(() => {})
  sentry = null
}

/** Sends one copy of each distinct client error to `client_errors` (and Sentry when set up) so the team sees crashes. */
export function reportClientError(error, context = '') {
  try {
    const message = `${context ? `[${context}] ` : ''}${error?.message || String(error)}`.slice(0, 500)
    if (ignored(error, message)) return
    // the global handlers below are Sentry's own; error boundaries swallow theirs, so those are passed on here
    if (sentry && (context === 'render' || context === 'route')) sentry.captureException(error, { tags: { boundary: context } })
    if (seen.has(message) || seen.size > 20) return
    seen.add(message)
    supabase.rpc('log_client_error', {
      p_message: message,
      p_stack: (error?.stack || '').slice(0, 3000),
      p_url: window.location.href,
      p_user_agent: navigator.userAgent,
    }).then(() => {}, () => {})
  } catch { /* never throw from the reporter */ }
}

/** Global hooks for uncaught errors and rejected promises. */
export function installErrorReporter() {
  if (typeof window === 'undefined' || !import.meta.env.PROD) return
  window.addEventListener('error', (event) => reportClientError(event.error || new Error(event.message), 'window'))
  window.addEventListener('unhandledrejection', (event) => reportClientError(event.reason instanceof Error ? event.reason : new Error(String(event.reason)), 'promise'))
  if (readConsent()?.errors) startSentry()
  onConsentChange((choice) => (choice?.errors ? startSentry() : stopSentry()))
}
