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
    await plugin('StatusBar')?.setBackgroundColor?.({ color: '#0d2a52' })
  } catch { /* plugin not installed */ }
  try { await plugin('SplashScreen')?.hide() } catch { /* ignore */ }
  // Android hardware back button follows the browser history
  try { plugin('App')?.addListener?.('backButton', ({ canGoBack }) => (canGoBack ? window.history.back() : plugin('App')?.exitApp?.())) } catch { /* ignore */ }
  // OAuth round trip: the system browser hands us ba.poso.app://auth/callback?code=… → session
  try {
    plugin('App')?.addListener?.('appUrlOpen', async ({ url }) => {
      if (!url?.startsWith(NATIVE_AUTH_CALLBACK)) return
      try { await plugin('Browser')?.close?.() } catch { /* already closed */ }
      const params = new URL(url.replace(NATIVE_AUTH_CALLBACK, 'https://poso.ba/auth/callback')).searchParams
      const code = params.get('code')
      if (!code) return
      const { supabase } = await import('../lib/supabase')
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (!error) window.location.assign(withBase('/'))
    })
  } catch { /* ignore */ }
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
