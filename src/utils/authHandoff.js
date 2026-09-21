import { supabase } from '../lib/supabase'

/**
 * Google/Facebook sign-in from the installed web app (home-screen PWA on iOS) finishes in an
 * in-app Safari view with its own storage. The PWA generates a nonce before leaving; the callback
 * page (index.html) parks the session under that nonce; the PWA claims it when it is back.
 */
const KEY = 'poso-oauth-nonce'

export const isStandaloneWebApp = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true

export function startHandoff() {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  const nonce = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  try { localStorage.setItem(KEY, `${nonce}:${Date.now()}`) } catch { /* private mode */ }
  return nonce
}

/** Called on load and whenever the app regains focus. Resolves true when a parked session was applied. */
export async function claimHandoffIfAny() {
  let raw = ''
  try { raw = localStorage.getItem(KEY) || '' } catch { return false }
  if (!raw) return false
  const [nonce, at] = raw.split(':')
  if (!nonce || Date.now() - Number(at || 0) > 10 * 60 * 1000) { try { localStorage.removeItem(KEY) } catch { /* ignore */ } return false }
  const { data: current } = await supabase.auth.getSession()
  if (current?.session) { try { localStorage.removeItem(KEY) } catch { /* ignore */ } return false }
  const { data, error } = await supabase.rpc('claim_auth_handoff', { p_nonce: nonce })
  if (error || !data?.access_token) return false
  try { localStorage.removeItem(KEY) } catch { /* ignore */ }
  const { error: setError } = await supabase.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token })
  return !setError
}

export function watchHandoff() {
  const tick = () => { if (document.visibilityState === 'visible') claimHandoffIfAny().catch(() => {}) }
  document.addEventListener('visibilitychange', tick)
  window.addEventListener('focus', tick)
  claimHandoffIfAny().catch(() => {}) // on load, whatever the visibility
  return () => { document.removeEventListener('visibilitychange', tick); window.removeEventListener('focus', tick) }
}
