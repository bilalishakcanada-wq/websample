// Walks the Android app on an emulator, signed in, and saves a screenshot of each main screen
// (.github/workflows/android-demo.yml). Uses Playwright's Android support to drive the app's WebView.
import { _android as android } from 'playwright'
import { mkdirSync } from 'node:fs'

const OUT = 'demo'
const { DEMO_EMAIL, DEMO_PASSWORD } = process.env
mkdirSync(OUT, { recursive: true })

const [device] = await android.devices()
await device.shell('am start -n ba.poso.app/.MainActivity')
const webview = await device.webView({ pkg: 'ba.poso.app' }, { timeout: 120000 })
const page = await webview.page()
await page.waitForLoadState('load')
await page.waitForTimeout(8000)
const origin = new URL(page.url()).origin
const base = '/websample'
let n = 0
const shot = async (name, wait = 4000) => {
  await page.waitForTimeout(wait)
  n += 1
  await device.screenshot({ path: `${OUT}/${String(n).padStart(2, '0')}-${name}.png` })
  console.log('shot', n, name, page.url())
}
// in-app navigation (no reload), like tapping a link
const go = async (path) => {
  await page.evaluate((target) => {
    const idx = (window.history.state?.idx ?? 0) + 1
    window.history.pushState({ usr: null, key: Math.random().toString(36).slice(2, 10), idx }, '', target)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, base + path)
}

await shot('dobrodoslica', 0)
if (!DEMO_EMAIL || !DEMO_PASSWORD) throw new Error('DEMO_EMAIL / DEMO_PASSWORD missing')
await page.goto(`${origin}${base}/login`)
await page.waitForSelector('[data-testid="login-email"]', { timeout: 60000 })
await shot('prijava', 1500)
await page.fill('[data-testid="login-email"]', DEMO_EMAIL)
await page.fill('input[name="password"]', DEMO_PASSWORD)
await page.click('[data-testid="login-submit"]')
await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 60000 })
await shot('pocetna', 8000)
await page.mouse.wheel(0, 900).catch(() => {})
await shot('pocetna-dalje', 2500)

const screens = [
  ['/search', 'poslovi'],
  ['/objavi', 'objavi-posao'],
  ['/messages', 'poruke'],
  ['/moji-poslovi', 'moji-poslovi'],
  ['/account', 'nalog'],
  ['/account/novcanik', 'novcanik'],
  ['/account/obavijesti', 'obavijesti'],
  ['/account/postavke', 'postavke'],
]
for (const [path, name] of screens) {
  try { await go(path); await shot(name, 6000) } catch (error) { console.log('skip', path, error.message) }
}
// one job from the list
try {
  await go('/search')
  await page.waitForTimeout(6000)
  const href = await page.$eval('a[href*="/listings/"]', (a) => a.getAttribute('href'))
  await go(href.replace(base, ''))
  await shot('posao-detalji', 6000)
} catch (error) { console.log('skip listing', error.message) }

await device.close()
