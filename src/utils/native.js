// Native niceties when the site runs inside the Capacitor shell (iOS / Android app).
// Everything here is optional: in a normal browser these calls simply do nothing.
import { withBase } from './paths'

const cap = () => window.Capacitor
export const isNativeApp = () => Boolean(cap()?.isNativePlatform?.())
const isAndroidApp = () => isNativeApp() && cap()?.getPlatform?.() === 'android'

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
  if (isAndroidApp()) setupPhotoSource()
  // the shell shows the live site: after a long time in the background, come back with the newest build,
  // but only when there is one (a blind reload used to redraw everything and, on Android, reload the old build)
  try {
    let hiddenAt = 0
    plugin('App')?.addListener?.('appStateChange', ({ isActive }) => {
      if (!isActive) { hiddenAt = Date.now(); return }
      const typing = () => ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)
      if (!hiddenAt || Date.now() - hiddenAt <= 30 * 60 * 1000 || typing() || navigator.onLine === false) return
      if (navigator.serviceWorker?.controller) {
        // Android: the service worker serves index.html, so ask it for an update; appUpdates.js reloads if one exists
        navigator.serviceWorker.getRegistration().then((reg) => reg?.update()).catch(() => {})
        return
      }
      // iOS (no service worker in the app): reload only if the deployed entry file changed
      const current = document.querySelector('script[type="module"][src*="/assets/index-"]')?.getAttribute('src')
      fetch(withBase('/'), { cache: 'no-store' }).then((res) => res.text()).then((html) => {
        if (current && !html.includes(current) && !typing()) window.location.reload()
      }).catch(() => {})
    })
  } catch { /* ignore */ }
  // Android's back button is handled inside the router (components/NativeBack.jsx)
  // OAuth round trip: the system browser hands us ba.poso.app://auth/callback?code=… → session
  try {
    plugin('App')?.addListener?.('appUrlOpen', async ({ url }) => {
      if (!url?.startsWith(NATIVE_AUTH_CALLBACK)) return
      try { await plugin('Browser')?.close?.() } catch { /* already closed */ }
      const parsed = new URL(url.replace(NATIVE_AUTH_CALLBACK, 'https://localhost/auth/callback'))
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

/**
 * Android's WebView file chooser only ever opens the gallery. Every photo button in the app gets a small
 * "Kamera / Galerija" sheet first; Kamera re-opens the same input with capture set, which Capacitor turns into
 * the camera app (AndroidManifest declares the IMAGE_CAPTURE query so it can find one). Inputs that also take
 * video (portfolio) keep the plain picker.
 */
function setupPhotoSource() {
  let passThrough = false
  document.addEventListener('click', (event) => {
    const input = event.target
    if (passThrough || !(input instanceof HTMLInputElement) || input.type !== 'file') return
    const accept = input.getAttribute('accept') || ''
    if (!/image/.test(accept) || /video/.test(accept)) return
    event.preventDefault()
    choosePhotoSource((source) => {
      const accepted = input.getAttribute('accept')
      const capture = input.getAttribute('capture')
      if (source === 'camera') { input.setAttribute('accept', 'image/*'); input.setAttribute('capture', 'environment') } else input.removeAttribute('capture')
      passThrough = true
      try { input.click() } finally { passThrough = false }
      // the chooser has read the attributes by now; put the page's own back
      window.setTimeout(() => {
        input.setAttribute('accept', accepted)
        if (capture === null) input.removeAttribute('capture'); else input.setAttribute('capture', capture)
      }, 1500)
    })
  }, true)
}

function choosePhotoSource(onPick) {
  document.getElementById('zadatak-photo-source')?.remove()
  const sheet = document.createElement('div')
  sheet.id = 'zadatak-photo-source'
  sheet.setAttribute('role', 'dialog')
  sheet.setAttribute('aria-label', 'Dodaj sliku')
  sheet.style.cssText = 'position:fixed;inset:0;z-index:2147483646;display:flex;align-items:flex-end;background:rgba(6,21,48,.45);font-family:Manrope,system-ui,sans-serif'
  const button = (label, primary) => `<button type="button" data-pick="${label}" style="display:block;width:100%;min-height:52px;margin-top:8px;border:0;border-radius:16px;font:800 1rem Manrope,system-ui,sans-serif;background:${primary ? '#0d2a52' : '#eef2f8'};color:${primary ? '#fff' : '#0d2a52'}">${label}</button>`
  sheet.innerHTML = `<div style="width:100%;padding:18px 16px calc(18px + env(safe-area-inset-bottom));background:#fff;border-radius:22px 22px 0 0;box-shadow:0 -12px 32px rgba(13,42,82,.18)"><strong style="display:block;color:#0d2a52;font-size:1.05rem;margin:2px 4px 6px">Dodaj sliku</strong>${button('Kamera', true)}${button('Galerija', false)}${button('Odustani', false)}</div>`
  const close = () => sheet.remove()
  sheet.addEventListener('click', (event) => {
    const pick = event.target?.closest?.('[data-pick]')?.dataset.pick
    if (event.target === sheet || pick === 'Odustani') { close(); return }
    if (!pick) return
    close()
    // still inside the tap, so the WebView lets the input open its chooser
    onPick(pick === 'Kamera' ? 'camera' : 'gallery')
  })
  document.body.appendChild(sheet)
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
