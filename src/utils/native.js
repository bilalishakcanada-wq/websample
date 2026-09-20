// Native niceties when the site runs inside the Capacitor shell (iOS / Android app).
// Everything here is optional: in a normal browser these calls simply do nothing.
const cap = () => window.Capacitor
export const isNativeApp = () => Boolean(cap()?.isNativePlatform?.())

const plugin = (name) => cap()?.Plugins?.[name]

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
