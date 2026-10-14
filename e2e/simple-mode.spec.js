// Jednostavan način za majstore (supabase/providers/01_simple_mode.sql):
//   worker turns it on in Postavke → the job page shows one big "Želim ovaj posao" button
//   → the sheet has the client's budget already chosen and no text to type → one tap sends the offer.
//   The "Želim ovaj posao" link on the phone home cards opens the job with ?prijava=1, which opens the sheet at once.
import { test, expect } from '@playwright/test'
import { accountsConfigured, acceptDialogs, login } from './helpers.js'

test.describe.serial('Jednostavan način za majstore', () => {
  test.skip(!accountsConfigured(), 'E2E accounts are not configured (E2E_CLIENT_* / E2E_PROVIDER_* env)')

  let clientCtx, providerCtx, client, provider
  const title = `[E2E] Jednostavna prijava ${Date.now()}`
  let listingUrl = ''

  const setSimple = async (on) => {
    await provider.goto('/account/postavke')
    const toggle = provider.getByTestId('simple-mode-toggle')
    await expect(toggle).toBeVisible()
    if ((await toggle.innerText()).trim() === (on ? 'Uključi' : 'Isključi')) {
      await toggle.click()
      await expect(toggle).toHaveText(on ? 'Isključi' : 'Uključi')
    }
  }

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
    // the other specs send offers the usual way: leave the worker's account in the normal mode
    if (provider) await setSimple(false).catch(() => {})
    await clientCtx?.close()
    await providerCtx?.close()
  })

  test('klijent objavljuje posao sa budžetom', async () => {
    await client.goto('/objavi')
    await client.getByTestId('post-title').fill(title)
    await client.getByRole('button', { name: 'Fleksibilan sam' }).click()
    await client.getByRole('button', { name: 'Nastavi' }).click()
    await client.getByRole('button', { name: 'Online / na daljinu' }).click()
    await client.getByRole('button', { name: 'Nastavi' }).click()
    await client.getByRole('combobox').first().selectOption({ label: 'Ostalo' })
    await client.getByTestId('post-description').fill('Automatski test jednostavne prijave. Ništa ne treba raditi — ovaj oglas se briše na kraju testa.')
    await client.getByRole('button', { name: 'Nastavi' }).click()
    await client.getByRole('button', { name: 'Nastavi' }).click() // photos are optional
    await client.getByTestId('post-price').fill('1')
    await client.getByRole('button', { name: 'Objavi posao' }).click()
    await expect(client).toHaveURL(/\/listings\/[0-9a-f-]{36}/, { timeout: 30_000 })
    listingUrl = new URL(client.url()).pathname
  })

  test('majstor uključuje jednostavan način i vidi veliko dugme', async () => {
    await setSimple(true)
    await provider.goto(listingUrl)
    await expect(provider.getByRole('heading', { name: title })).toBeVisible()
    await provider.getByRole('button', { name: 'Želim ovaj posao' }).first().click()
    const sheet = provider.getByTestId('simple-offer')
    await expect(sheet).toBeVisible()
    // the client's budget is already chosen and there is nothing to type
    await expect(sheet.getByRole('radio', { name: /1 KM/ })).toHaveAttribute('aria-checked', 'true')
    await expect(sheet.getByRole('textbox')).toHaveCount(0)
    await sheet.getByRole('button', { name: 'Ne, vrati me nazad' }).click()
    await expect(sheet).toHaveCount(0)
  })

  test('prijava s kartice: jedan dodir šalje ponudu', async () => {
    await provider.goto(`${listingUrl}?prijava=1`)
    const sheet = provider.getByTestId('simple-offer')
    await expect(sheet).toBeVisible()
    await sheet.getByTestId('simple-offer-submit').click()
    await expect(provider.getByText('Ponuda je uspješno poslana.')).toBeVisible()
    await expect(provider.getByText(/Tvoja ponuda:/)).toBeVisible()
  })

  test('test oglas se briše', async () => {
    await client.goto('/account')
    const row = client.getByTestId(/^dashboard-(listing|bid)$/).filter({ hasText: title })
    await expect(row).toBeVisible()
    await row.getByRole('button', { name: /Obriši/ }).click()
    await client.getByRole('dialog').getByRole('button', { name: 'Obriši', exact: true }).click()
    await expect(row).toHaveCount(0, { timeout: 15_000 })
  })
})
