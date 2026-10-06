// The money path on phones, the way most people use Zadatak: the client posts a job through the
// one-question-per-screen flow, the worker sends an offer from the phone job page, the client
// accepts and secures the payment, and both write in the chat. Runs on an iPhone and on a small 360 px Android screen.
import { test, expect, devices } from '@playwright/test'
import { accountsConfigured, acceptDialogs, login } from './helpers.js'

const { defaultBrowserType: _browser, ...iphone } = devices['iPhone 13']
const SCREENS = {
  iPhone: iphone,
  // cheap Android phones are still 360 × 640; buttons must stay reachable there too
  'mali Android': { viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 11; SM-A125F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36' },
}

for (const [screen, phone] of Object.entries(SCREENS)) test.describe.serial(`Telefon (${screen}): objava, ponuda, plaćanje i poruke`, () => {
  test.skip(!accountsConfigured(), 'E2E accounts are not configured (E2E_CLIENT_* / E2E_PROVIDER_* env)')

  /** @type {import('@playwright/test').Page} */ let client
  /** @type {import('@playwright/test').Page} */ let provider
  let contexts = []
  const title = `[E2E] Telefon ${screen} ${Date.now()}`
  let listingUrl = ''

  test.beforeAll(async ({ browser }) => {
    contexts = [await browser.newContext({ ...phone, locale: 'bs-BA' }), await browser.newContext({ ...phone, locale: 'bs-BA' })]
    client = await contexts[0].newPage()
    provider = await contexts[1].newPage()
    acceptDialogs(client)
    acceptDialogs(provider)
    await login(client, 'client')
    await login(provider, 'provider')
  })

  test.afterAll(async () => {
    for (const context of contexts) await context.close()
  })

  test('klijent objavljuje posao kroz korake na telefonu', async () => {
    await client.goto('/objavi')
    await expect(client.getByRole('heading', { name: 'Počni s naslovom' })).toBeVisible()
    await client.getByPlaceholder('npr. Selidba kauča').fill(title)
    await client.getByRole('button', { name: 'Nastavi' }).click()

    await expect(client.getByRole('heading', { name: 'Odaberi vrijeme' })).toBeVisible()
    await client.getByRole('button', { name: 'Fleksibilan sam' }).click()
    await client.getByRole('button', { name: 'Nastavi' }).click()

    await expect(client.getByRole('heading', { name: 'Gdje?' })).toBeVisible()
    await client.getByRole('button', { name: /Online/ }).click()
    await client.getByRole('button', { name: 'Nastavi' }).click()

    await expect(client.getByRole('heading', { name: 'Opiši posao' })).toBeVisible()
    await client.getByPlaceholder(/Napiši šta tačno treba uraditi/).fill('Automatski test na telefonu: ništa ne treba raditi, oglas je samo za provjeru.')
    await client.getByRole('button', { name: 'Nastavi' }).click()

    await expect(client.getByRole('heading', { name: 'Dodaj sliku' })).toBeVisible()
    await client.getByRole('button', { name: /Nastavi|Preskoči/ }).first().click()

    await expect(client.getByRole('heading', { name: 'Unesi budžet' })).toBeVisible()
    const keypad = client.getByRole('group', { name: 'Iznos' })
    await keypad.getByRole('button', { name: '2', exact: true }).click()
    await keypad.getByRole('button', { name: '0', exact: true }).click()
    await expect(client.locator('.ap-amount')).toContainText('20')
    await client.getByRole('button', { name: 'Nastavi' }).click()

    await client.getByRole('button', { name: 'Objavi posao' }).click()
    await expect(client).toHaveURL(/\/listings\/[0-9a-f-]{36}/, { timeout: 30_000 })
    listingUrl = new URL(client.url()).pathname
    await expect(client.getByText('Posao je objavljen!')).toBeVisible()
  })

  test('izvođač šalje ponudu sa telefona', async () => {
    await provider.goto(listingUrl)
    await expect(provider.getByRole('heading', { name: title })).toBeVisible()
    await provider.getByRole('button', { name: 'Pošalji ponudu' }).first().click()
    const sheet = provider.getByRole('dialog')
    await sheet.getByLabel('Tvoja ponuda (KM)').fill('20')
    await sheet.getByTestId('offer-message').fill('Automatski test sa telefona: ponuda robota, sve uključeno.')
    const send = sheet.getByRole('button', { name: 'Pošalji ponudu' })
    await expect(send).toBeInViewport() // must be reachable on a phone screen
    await send.click()
    await expect(provider.getByText('Ponuda je uspješno poslana.')).toBeVisible()
    await expect(provider.getByRole('heading', { name: /Tvoja ponuda/ })).toBeVisible()
  })

  test('klijent prihvata ponudu i osigurava uplatu na telefonu', async () => {
    await client.goto(listingUrl)
    await client.getByRole('tab', { name: /Ponude/ }).click()
    await client.getByRole('button', { name: 'Prihvati', exact: true }).first().click()
    const pay = client.getByTestId('payment-confirm')
    await expect(pay).toBeInViewport()
    await pay.click()
    await expect(client.getByText(/osigurano na Zadatku|Uplata je osigurana/).first()).toBeVisible({ timeout: 20_000 })
  })

  test('poruke na telefonu stižu odmah', async () => {
    const listingId = listingUrl.split('/').pop()
    await client.goto(`/messages?listing=${listingId}`)
    await provider.goto(`/messages?listing=${listingId}`)
    const box = (page) => page.getByTestId('chat-input')
    await expect(box(client)).toBeVisible()
    await expect(box(provider)).toBeVisible()
    await expect(box(client)).toBeInViewport()

    const text = `Pozdrav sa telefona ${Date.now()}`
    await box(client).fill(text)
    await client.getByRole('button', { name: 'Pošalji', exact: true }).click()
    await expect(provider.locator('p', { hasText: text })).toBeVisible({ timeout: 15_000 })
  })
})
