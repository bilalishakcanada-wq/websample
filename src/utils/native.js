// Native niceties when the site runs inside the Capacitor shell (iOS / Android app).
// Everything here is optional: in a normal browser these calls simply do nothing.
import { withBase } from './paths'

const cap = () => window.Capacitor
export const isNativeApp = () => Boolean(cap()?.isNativePlatform?.())

const plugin = (name) => cap()?.Plugins?.[name]

/** Where OAuth providers send the user back when the site runs inside the app (custom URL scheme). */
export const NATIVE_AUTH_CALLBACK = 'ba.poso.app://auth/callback'

/** Opens a URL in the system browser sheet (SFSafariViewController / Custom Tab). */
export async function openInSystemBrowser(url) {
  const browser = plugin('Browser')
  if (browser) await browser.open({ url, presentationStyle: 'popover' })
  else window.location.assign(url) // older app build without the Browser plugin: plain redirect
}

export async function setupNative() {
  if (!isNativeApp()) return
  try {
    document.documentElement.classList.add('is-native')
    await plugin('StatusBar')?.setStyle({ style: 'DARK' })
    await plugin('StatusBar')?.setBackgroundColor?.({ color: '#081b38' }) // same navy as the home hero and account head
  } catch { /* plugin not installed */ }
  try { await plugin('SplashScreen')?.hide() } catch { /* ignore */ }
  // links to our own pages that ask for a new tab (admin console) stay inside the app
  document.addEventListener('click', (event) => {
    const anchor = event.target?.closest?.('a[target="_blank"]')
    if (!anchor || !anchor.href) return
    let target
    try { target = new URL(anchor.href) } catch { return }
    if (target.origin !== window.location.origin) return
    event.preventDefault()
    // numbered like the router's own entries, so back from that page returns here
    const idx = (window.history.state?.idx ?? 0) + 1
    window.history.pushState({ usr: null, key: Math.random().toString(36).slice(2, 10), idx }, '', target.pathname + target.search + target.hash)
    window.dispatchEvent(new PopStateEvent('popstate'))
  })
  // the shell shows the live site: after a long time in the background, come back with a fresh copy
  try {
    let hiddenAt = 0
    plugin('App')?.addListener?.('appStateChange', ({ isActive }) => {
      if (!isActive) { hiddenAt = Date.now(); return }
      const typing = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)
      if (hiddenAt && Date.now() - hiddenAt > 30 * 60 * 1000 && !typing) window.location.reload()
    })
  } catch { /* ignore */ }
  // Android's back button is handled inside the router (components/NativeBack.jsx)
  // OAuth round trip: the system browser hands us ba.poso.app://auth/callback?code=… → session
  try {
    plugin('App')?.addListener?.('appUrlOpen', async ({ url }) => {
      if (!url?.startsWith(NATIVE_AUTH_CALLBACK)) return
      try { await plugin('Browser')?.close?.() } catch { /* already closed */ }
      const parsed = new URL(url.replace(NATIVE_AUTH_CALLBACK, 'https://poso.ba/auth/callback'))
      const hash = new URLSearchParams(parsed.hash.replace(/^#/, ''))
      const { supabase } = await import('../lib/supabase')
      let error = null
      if (hash.get('access_token') && hash.get('refresh_token')) {
        ({ error } = await supabase.auth.setSession({ access_token: hash.get('access_token'), refresh_token: hash.get('refresh_token') }))
      } else if (parsed.searchParams.get('code')) {
        ({ error } = await supabase.auth.exchangeCodeForSession(parsed.searchParams.get('code')))
      } else {
        error = new Error(hash.get('error_description') || parsed.searchParams.get('error_description') || 'no session in callback')
      }
      if (error) { console.error('native sign-in failed', error.message); window.location.assign(withBase('/login?oauth=failed')); return }
      window.location.assign(withBase('/'))
    })
  } catch { /* ignore */ }
}

/** System share sheet: Capacitor Share in the app (WKWebView has no navigator.share), Web Share elsewhere. Returns false when neither exists. */
export async function shareLink({ title, text, url }) {
  const share = plugin('Share')
  if (share) { await share.share({ title, text, url, dialogTitle: title }); return true }
  if (navigator.share) { await navigator.share({ title, text, url }); return true }
  return false
}

/** Short tap feedback on important actions (accept offer, release payment). */
export function haptic(kind = 'light') {
  if (!isNativeApp()) {
    // installed web app on Android: the Vibration API gives the same tap feedback
    try { navigator.vibrate?.(kind === 'heavy' ? 30 : kind === 'medium' ? 18 : 8) } catch { /* ignore */ }
    return
  }
  try { plugin('Haptics')?.impact({ style: kind === 'heavy' ? 'HEAVY' : kind === 'medium' ? 'MEDIUM' : 'LIGHT' }) } catch { /* ignore */ }
}
