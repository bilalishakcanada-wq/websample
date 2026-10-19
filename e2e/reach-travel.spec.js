// Lokacija, obavijesti i doseg ponuda (supabase/reach/01, components/RequiredPermissions.jsx, TravelRequest.jsx):
//   bez dozvola novi račun ne ide dalje → klijent ima posao od 40 KM u Sarajevu (doseg 10 km)
//   → izvođač je u Mostaru: umjesto ponude vidi samo „Zamoli da plati prevoz“ i šalje molbu
//   → klijent prihvata → izvođač sada može poslati ponudu.
// Treba lokalnu bazu (robot/local-db/setup.sh): posao se upisuje direktno, a na kraju se briše
// i izvođač se vraća u Sarajevo, da ostali testovi ne vide izvođača 75 km daleko.
import { existsSync, readFileSync } from 'node:fs'
import { test, expect } from '@playwright/test'
import { accountsConfigured, acceptDialogs, login } from './helpers.js'

const SARAJEVO = { latitude: 43.8563, longitude: 18.4131 }
const MOSTAR = { latitude: 43.343, longitude: 17.808 }

function lokalnaBaza() {
  if (!existsSync('.env.local')) return null
  const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split('\n').map((l) => l.split('=')).filter((p) => p.length >= 2).map(([k, ...v]) => [k.trim(), v.join('=').trim()]))
  return env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY ? { url: env.VITE_SUPABASE_URL, key: env.VITE_SUPABASE_ANON_KEY } : null
}

const tokenOf = (page) => page.evaluate(() => {
  const k = Object.keys(localStorage).find((key) => /^sb-.*-auth-token$/.test(key))
  return k ? JSON.parse(localStorage.getItem(k)).access_token : null
})
const subOf = (token) => JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).sub

test.describe.serial('Doseg ponuda i molba za prevoz', () => {
  const baza = lokalnaBaza()
  test.skip(!accountsConfigured() || !baza, 'treba E2E račune i lokalnu bazu (.env.local)')

  /** @type {import('@playwright/test').BrowserContext} */ let clientCtx
  /** @type {import('@playwright/test').BrowserContext} */ let providerCtx
  /** @type {import('@playwright/test').Page} */ let client
  /** @type {import('@playwright/test').Page} */ let provider
  const title = `[E2E] Mali posao daleko ${Date.now()}`
  let listingId = ''
  let liveListingId = ''

  const rest = (page, token, method, path, data) => page.request.fetch(`${baza.url}${path}`, {
    method, data,
    headers: { apikey: baza.key, Authorization: `Bearer ${token}`, 'content-type': 'application/json', Prefer: 'return=representation' },
  })
  const placeProvider = async (point) => {
    const token = await tokenOf(provider)
    const res = await rest(provider, token, 'POST', '/rest/v1/rpc/report_device_location', { p_lat: point.latitude, p_lng: point.longitude, p_accuracy_m: 20 })
    expect(res.ok(), await res.text()).toBeTruthy()
  }

  test.beforeAll(async ({ browser }) => {
    clientCtx = await browser.newContext()
    // the provider's device says Mostar, ~75 km from a job in Sarajevo
    providerCtx = await browser.newContext({ geolocation: MOSTAR })
    client = await clientCtx.newPage()
    provider = await providerCtx.newPage()
    acceptDialogs(client)
    acceptDialogs(provider)
    await login(client, 'client')
    await login(provider, 'provider')
  })

  test.afterAll(async () => {
    if (client) {
      const token = await tokenOf(client)
      for (const id of [listingId, liveListingId].filter(Boolean)) await rest(client, token, 'DELETE', `/rest/v1/listings?id=eq.${id}`).catch(() => {})
    }
    if (provider) await placeProvider(SARAJEVO).catch(() => {})
    await clientCtx?.close()
    await providerCtx?.close()
  })

  test('novi račun nudi lokaciju i obavijesti, ali ih ne traži na silu', async ({ browser }) => {
    const ctx = await browser.newContext({ permissions: [] })
    const page = await ctx.newPage()
    // a phone that was never asked: both permissions are still "prompt"
    await page.addInitScript(() => {
      const query = navigator.permissions.query.bind(navigator.permissions)
      navigator.permissions.query = (d) => (['geolocation', 'notifications'].includes(d?.name) ? Promise.resolve({ state: 'prompt', addEventListener() {}, removeEventListener() {} }) : query(d))
    })
    await page.goto('/register')
    // one word: the sign-up stops at the name check, after the permission screens (no account is made)
    await page.locator('#fullName').fill('Dozvole')
    await page.locator('#email').fill(`dozvole-${Date.now()}@test.zadatak`)
    await page.getByTestId('password-input').fill('Test12345!')
    await page.locator('.auth-accept input').check()
    await page.getByTestId('register-submit').click()
    const sheet = page.getByTestId('required-permissions')
    await expect(sheet.getByRole('heading', { name: 'Poveži svoju lokaciju' })).toBeVisible()
    await sheet.getByTestId('permissions-skip').click()
    // skipped once: the sign-up carries on instead of being blocked
    if (await sheet.getByRole('heading', { name: 'Uključi obavijesti' }).isVisible().catch(() => false)) await sheet.getByTestId('permissions-skip').click()
    await expect(sheet).toHaveCount(0)
    await expect(page.locator('.form-error')).toContainText('ime i prezime')
    // the next attempt doesn't ask again this week
    await page.locator('#fullName').fill('Jedno')
    await page.getByTestId('register-submit').click()
    await expect(page.locator('.form-error')).toContainText('ime i prezime')
    await expect(sheet).toHaveCount(0)
    await ctx.close()
  })

  test('klijent ima mali posao u Sarajevu', async () => {
    const token = await tokenOf(client)
    const res = await rest(client, token, 'POST', '/rest/v1/listings', {
      user_id: subOf(token), title, description: 'Automatski test dosega. Ovaj oglas se briše na kraju testa.',
      category: 'Vodoinstalater', location: 'Sarajevo', price: 40, status: 'published', lat: SARAJEVO.latitude, lng: SARAJEVO.longitude,
    })
    expect(res.ok(), await res.text()).toBeTruthy()
    listingId = (await res.json())[0].id
    await placeProvider(MOSTAR)
  })

  test('izvođač iz Mostara može samo zamoliti da mu se plati prevoz', async () => {
    await provider.goto(`/listings/${listingId}`)
    await expect(provider.getByRole('heading', { name: title })).toBeVisible()
    await expect(provider.getByRole('button', { name: 'Pošalji ponudu' })).toHaveCount(0)
    await provider.getByRole('button', { name: 'Zamoli da plati prevoz' }).first().click()
    const sheet = provider.getByTestId('travel-sheet')
    await sheet.getByRole('radio', { name: 'Taksi' }).click()
    await sheet.getByRole('button', { name: '30 KM' }).click()
    await sheet.getByTestId('travel-send').click()
    await expect(provider.getByTestId('travel-status')).toContainText('Molba za prevoz je poslana')
  })

  test('klijent prihvata da plati prevoz', async () => {
    await client.goto(`/listings/${listingId}`)
    const box = client.getByTestId('travel-requests')
    await expect(box).toContainText('Taksi')
    await expect(box).toContainText('30 KM')
    await box.getByRole('button', { name: 'Prihvati' }).click()
    await expect(box).toContainText('Prihvaćeno, plaćaš prevoz')
  })

  test('izvođač sada može poslati ponudu', async () => {
    await provider.reload()
    await expect(provider.getByTestId('travel-status')).toContainText('Klijent plaća prevoz')
    await expect(provider.getByRole('button', { name: 'Pošalji ponudu' }).first()).toBeVisible()
  })

  test('lokacija uživo: doseg prati gdje je izvođač sada', async () => {
    const token = await tokenOf(client)
    const res = await rest(client, token, 'POST', '/rest/v1/listings', {
      user_id: subOf(token), title: `${title} uživo`, description: 'Automatski test lokacije uživo. Ovaj oglas se briše na kraju testa.',
      category: 'Vodoinstalater', location: 'Sarajevo', price: 40, status: 'published', lat: SARAJEVO.latitude, lng: SARAJEVO.longitude,
    })
    expect(res.ok(), await res.text()).toBeTruthy()
    liveListingId = (await res.json())[0].id
    // Postavke → Lokacija uživo, while the phone is in Mostar
    await provider.goto('/account/postavke')
    const toggle = provider.getByTestId('live-reach-toggle')
    if ((await toggle.getAttribute('aria-checked')) !== 'true') await toggle.click()
    await expect(toggle).toHaveAttribute('aria-checked', 'true')
    await provider.goto(`/listings/${liveListingId}`)
    await expect(provider.getByRole('button', { name: 'Zamoli da plati prevoz' }).first()).toBeVisible()
    // the provider drives to Sarajevo: the page follows without a reload
    await providerCtx.setGeolocation(SARAJEVO)
    await expect(provider.getByRole('button', { name: 'Pošalji ponudu' }).first()).toBeVisible({ timeout: 30_000 })
  })
})
