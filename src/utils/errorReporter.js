import { supabase } from '../lib/supabase'

const seen = new Set()
const IGNORE = /ResizeObserver loop|Script error\.?$|Failed to fetch dynamically imported module|Load failed|NetworkError|AbortError/i

/** Sends one copy of each distinct client error to `client_errors` so the team sees beta crashes. */
export function reportClientError(error, context = '') {
  try {
    const message = `${context ? `[${context}] ` : ''}${error?.message || String(error)}`.slice(0, 500)
    if (IGNORE.test(message) || seen.has(message) || seen.size > 20) return
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
}
