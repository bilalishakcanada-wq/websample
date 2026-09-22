// The money path, end to end, with two real accounts in two browsers:
//   client posts a job → provider sends an offer → client accepts and funds it (Balans escrow)
//   → both chat in real time → client releases the payment → client leaves a review → job is deleted.
import { test, expect } from '@playwright/test'
import { accountsConfigured, acceptDialogs, login } from './helpers.js'

test.describe.serial('Posao od objave do recenzije', () => {
  test.skip(!accountsConfigured(), 'E2E accounts are not configured (E2E_CLIENT_* / E2E_PROVIDER_* env)')

  /** @type {import('@playwright/test').BrowserContext} */ let clientCtx
  /** @type {import('@playwright/test').BrowserContext} */ let providerCtx
  /** @type {import('@playwright/test').Page} */ let client
  /** @type {import('@playwright/test').Page} */ let provider
  const title = `[E2E] Test posao ${Date.now()}`
  let listingUrl = ''

  test.beforeAll(async ({ browser }) => {
    clientCtx = await browser.newContext()
    providerCtx = await browser.newContext()
    client = await clientCtx.newPage()
    provider = await providerCtx.newPage()
    acceptDialogs(client)
    acceptDialogs(provider)
    await login(client, 'client')
    await login(provider, 'provider')
  })

  test.afterAll(async () => {
    await clientCtx?.close()
    await providerCtx?.close()
  })

  test('klijent objavljuje posao', async () => {
    await client.goto('/objavi')
    await client.getByPlaceholder('npr. Montaža kuhinjskih elemenata').fill(title)
    await client.getByRole('button', { name: 'Fleksibilan sam' }).click()
    await client.getByRole('button', { name: 'Nastavi' }).click()

    await client.getByRole('button', { name: 'Online / na daljinu' }).click()
    await client.getByRole('button', { name: 'Nastavi' }).click()

    await client.getByRole('combobox').first().selectOption({ label: 'Ostalo' })
    await client.getByPlaceholder(/Opišite šta tačno treba uraditi/).fill('Automatski test toka posla. Ništa ne treba raditi — ovaj oglas se briše na kraju testa.')
    await client.getByRole('button', { name: 'Nastavi' }).click()

    await client.getByRole('button', { name: 'Nastavi' }).click() // photos are optional

    await client.getByPlaceholder(/Ostavite prazno/).fill('1')
    await client.getByRole('button', { name: 'Objavi posao' }).click()

    await expect(client).toHaveURL(/\/listings\/[0-9a-f-]{36}/, { timeout: 30_000 })
    listingUrl = new URL(client.url()).pathname
    await expect(client.getByRole('heading', { name: title })).toBeVisible()
  })

  test('izvođač šalje ponudu', async () => {
    await provider.goto(listingUrl)
    await expect(provider.getByRole('heading', { name: title })).toBeVisible()
    await provider.getByRole('button', { name: 'Pošalji ponudu' }).first().click()
    const sheet = provider.getByRole('dialog')
    await sheet.getByLabel('Tvoja ponuda (KM)').fill('1')
    await sheet.getByPlaceholder(/Napiši zašto si prava osoba/).fill('Automatski test: ponuda robota, uključeno sve.')
    await sheet.getByRole('button', { name: 'Pošalji ponudu' }).click()
    await expect(provider.getByText(/Tvoja ponuda:/)).toBeVisible()
    await expect(provider.getByText('Ponuda je uspješno poslana.')).toBeVisible()
  })

  test('klijent prihvata ponudu i osigurava uplatu', async () => {
    await client.goto(listingUrl)
    await client.getByRole('button', { name: 'Prihvati i plati' }).click()
    await client.getByRole('button', { name: /Prihvati i osiguraj/ }).click()
    await expect(client.getByText(/osigurano na Poso\.ba/)).toBeVisible({ timeout: 20_000 })
    await expect(client.getByText('Prihvaćena').first()).toBeVisible()
  })

  test('poruke stižu u realnom vremenu', async () => {
    const listingId = listingUrl.split('/').pop()
    await client.goto(`/messages?listing=${listingId}`)
    await provider.goto(`/messages?listing=${listingId}`)
    await expect(client.getByPlaceholder('Napiši poruku…')).toBeVisible()
    await expect(provider.getByPlaceholder('Napiši poruku…')).toBeVisible()

    const fromClient = `Zdravo! Automatski test ${Date.now()}`
    await client.getByPlaceholder('Napiši poruku…').fill(fromClient)
    await client.getByRole('button', { name: 'Pošalji', exact: true }).click()
    const bubble = (page, text) => page.locator('p', { hasText: text }) // the thread bubble, not the inbox preview
    await expect(bubble(client, fromClient)).toBeVisible()
    // the provider's page is not reloaded: the message must arrive over Realtime
    await expect(bubble(provider, fromClient)).toBeVisible({ timeout: 15_000 })

    const fromProvider = `Može, javljam se. ${Date.now()}`
    await provider.getByPlaceholder('Napiši poruku…').fill(fromProvider)
    await provider.getByRole('button', { name: 'Pošalji', exact: true }).click()
    await expect(bubble(client, fromProvider)).toBeVisible({ timeout: 15_000 })
  })

  test('klijent oslobađa uplatu i ostavlja recenziju', async () => {
    await client.goto(listingUrl)
    await client.getByRole('button', { name: /Oslobodi/ }).click()
    await client.getByRole('dialog').getByRole('button', { name: /Oslobodi/ }).click() // in-app confirm sheet
    await expect(client.getByText('Posao završen').first()).toBeVisible({ timeout: 20_000 })

    await client.getByRole('button', { name: '5 zvjezdica' }).click()
    await client.getByPlaceholder('Kakvo je bilo iskustvo?').fill('Automatski test: sve uredno.')
    await client.getByRole('button', { name: 'Pošalji recenziju' }).click()
    await expect(client.locator('.review-done')).toBeVisible({ timeout: 20_000 })

    // the provider sees the job as finished on their dashboard
    await provider.goto('/account')
    await expect(provider.locator('article.dashboard-listing', { hasText: title })).toContainText('Završen')
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
