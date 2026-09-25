import { expect, test } from '@playwright/test'
import { accountsConfigured, acceptDialogs, login } from './helpers.js'

/**
 * Poziv unutar aplikacije, obje strane. Chromium dobija lažni mikrofon i kameru
 * (--use-fake-device-for-media-stream, vidi playwright.config.js), pa poziv može
 * proći bez pravog hardvera.
 *
 * Test sam pravi posao i plaća ga — ne oslanja se na zatečene podatke u bazi.
 * (Prva verzija jeste, pa je pala čim su testni oglasi obrisani.)
 */
test.describe.configure({ mode: 'serial' })

const title = `[E2E] Poziv ${Date.now()}`

test.describe('Pozivi u aplikaciji', () => {
  test.skip(!accountsConfigured(), 'E2E nalozi nisu podešeni')

  let clientCtx; let providerCtx; let client; let provider; let listingUrl = ''

  test.beforeAll(async ({ browser }) => {
    const media = { permissions: ['microphone', 'camera'] }
    clientCtx = await browser.newContext(media)
    providerCtx = await browser.newContext(media)
    client = await clientCtx.newPage()
    provider = await providerCtx.newPage()
    acceptDialogs(client); acceptDialogs(provider)
    await login(client, 'client')
    await login(provider, 'provider')
  })

  test.afterAll(async () => {
    await clientCtx?.close()
    await providerCtx?.close()
  })

  test('posao se objavi, prihvati i plati (chat se otvara)', async () => {
    await client.goto('/objavi')
    await client.getByPlaceholder('npr. Montaža kuhinjskih elemenata').fill(title)
    await client.getByRole('button', { name: 'Fleksibilan sam' }).click()
    await client.getByRole('button', { name: 'Nastavi' }).click()
    await client.getByRole('button', { name: 'Online / na daljinu' }).click()
    await client.getByRole('button', { name: 'Nastavi' }).click()
    await client.getByRole('combobox').first().selectOption({ label: 'Ostalo' })
    await client.getByPlaceholder(/Opišite šta tačno treba uraditi/).fill('Automatski test poziva. Ovaj oglas se briše na kraju testa.')
    await client.getByRole('button', { name: 'Nastavi' }).click()
    await client.getByRole('button', { name: 'Nastavi' }).click()
    await client.getByPlaceholder(/Ostavite prazno/).fill('1')
    await client.getByRole('button', { name: 'Objavi posao' }).click()
    await expect(client).toHaveURL(/\/listings\/[0-9a-f-]{36}/, { timeout: 30_000 })
    listingUrl = new URL(client.url()).pathname

    await provider.goto(listingUrl)
    await provider.getByRole('button', { name: 'Pošalji ponudu' }).first().click()
    const sheet = provider.getByRole('dialog')
    await sheet.getByLabel('Tvoja ponuda (KM)').fill('1')
    await sheet.getByPlaceholder(/Napiši zašto si prava osoba/).fill('Automatski test: ponuda za provjeru poziva.')
    await sheet.getByRole('button', { name: 'Pošalji ponudu' }).click()
    await expect(provider.getByText(/Tvoja ponuda:/)).toBeVisible()

    await client.goto(listingUrl)
    await client.getByRole('button', { name: 'Prihvati i plati' }).click()
    await client.getByRole('button', { name: /Prihvati i osiguraj/ }).click()
    await expect(client.getByText(/osigurano na Poso\.ba/).first()).toBeVisible({ timeout: 20_000 })
  })

  test('dugmad za poziv postoje dok je posao u toku', async () => {
    const listingId = listingUrl.split('/').pop()
    await client.goto(`/messages?listing=${listingId}`)
    await expect(client.locator('.chat-call')).toHaveCount(2, { timeout: 20_000 })
    await expect(client.locator('.chat-composer')).toBeVisible()
    await expect(client.locator('.ch-state-notice')).toHaveCount(0)
  })

  test('klijent zove, izvođaču zazvoni i javi se', async () => {
    const listingId = listingUrl.split('/').pop()
    await provider.goto(`/messages?listing=${listingId}`)
    await expect(provider.locator('.chat-composer')).toBeVisible({ timeout: 20_000 })

    await client.locator('.chat-call').first().click()          // audio poziv
    await expect(client.locator('.call-panel')).toBeVisible({ timeout: 15_000 })

    // izvođaču stiže dolazni poziv kroz Realtime
    await expect(provider.locator('.call-panel')).toBeVisible({ timeout: 20_000 })
    await provider.locator('.call-answer').click()
    await expect(provider.locator('.call-decline')).toBeVisible()

    await client.locator('.call-decline').click()               // prekid
    await expect(client.locator('.call-panel')).toHaveCount(0, { timeout: 10_000 })
  })

  test('poziv se ne može pokrenuti kad je posao završen', async () => {
    await client.goto(listingUrl)
    await client.getByRole('button', { name: /Oslobodi uplatu odmah/ }).click()
    await client.getByRole('dialog').getByRole('button', { name: /Oslobodi uplatu/ }).click()
    await expect(client.locator('.wf-head .pill')).toHaveText('Posao je završen', { timeout: 25_000 })

    const listingId = listingUrl.split('/').pop()
    await client.goto(`/messages?listing=${listingId}`)
    await expect(client.locator('.ch-state-notice')).toBeVisible({ timeout: 20_000 })
    await expect(client.locator('.chat-call')).toHaveCount(0)
    await expect(client.locator('.chat-composer')).toHaveCount(0)
  })

  test('test oglas se briše', async () => {
    await client.goto('/account')
    const row = client.locator('article.dashboard-listing', { hasText: title })
    await expect(row).toBeVisible()
    await row.getByRole('button', { name: /Obriši/ }).click()
    await client.getByRole('dialog').getByRole('button', { name: 'Obriši', exact: true }).click()
    await expect(row).toHaveCount(0, { timeout: 15_000 })
  })
})
