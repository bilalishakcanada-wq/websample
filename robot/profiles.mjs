import { devices } from '@playwright/test'

const { defaultBrowserType: _ignored, ...iphone } = devices['iPhone 13']

/** The screens the robot uses. `phone` turns on the touch-size checks. */
export const PROFILES = {
  desktop: { phone: false, context: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 } } },
  phone: { phone: true, context: iphone },
  // cheap Android phones are still 360px wide; the narrowest screen the site must handle
  small: { phone: true, context: { viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 11; SM-A125F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36' } },
  // the Android app: same site inside a WebView, with the Capacitor bridge present
  app: { phone: true, context: { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7 Build/UQ1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36' } },
}

/**
 * Runs before the site in the "app" profile: pretends to be the Capacitor bridge of the Android app,
 * so the site takes its in-app paths (status bar, back button, camera sheet, offline screen).
 * Every plugin method resolves to a harmless value.
 */
export function appShellStub() {
  const handle = { remove: () => {} }
  const method = (plugin, name) => {
    if (name === 'addListener') return async () => handle
    if (plugin === 'Network' && name === 'getStatus') return async () => ({ connected: true, connectionType: 'wifi' })
    if (plugin === 'App' && name === 'getInfo') return async () => ({ name: 'Poso.ba', id: 'ba.poso.app', build: '1', version: '1.0.0' })
    if (plugin === 'Device' && name === 'getInfo') return async () => ({ platform: 'android', operatingSystem: 'android' })
    return async () => ({ ...handle, value: null })
  }
  const plugins = new Proxy({}, {
    get: (_t, plugin) => (typeof plugin !== 'string' ? undefined : new Proxy({}, { get: (_p, name) => (name === 'then' || typeof name !== 'string' ? undefined : method(plugin, name)) })),
  })
  window.Capacitor = {
    isNativePlatform: () => true,
    getPlatform: () => 'android',
    isPluginAvailable: () => true,
    Plugins: plugins,
    convertFileSrc: (s) => s,
  }
}
