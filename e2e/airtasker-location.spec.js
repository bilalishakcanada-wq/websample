// Lokacija kao na Airtaskeru (supabase/airtasker-lokacija): a phone that never allowed location can still
// post a job, and a moving job carries two places, "Odakle" and "Dokle", that everyone sees as place names.
import { test, expect, devices } from '@playwright/test'
import { accountsConfigured, acceptDialogs, login } from './helpers.js'

const { defaultBrowserType: _browser, ...iphone } = devices['iPhone 13']

test.describe.serial('Lokacija: bez obavezne dozvole, Odakle i Dokle', () => {
  test.skip(!accountsConfigured(), 'E2E accounts are not configured (E2E_CLIENT_* / E2E_PROVIDER_* env)')

  /** @type {import('@playwright/test').BrowserContext} */ let context
  /** @type {import('@playwright/test').Page} */ let client
  const title = `[E2E] Selidba ${Date.now()}`

  test.beforeAll(async ({ browser }) => {
    // no geolocation permission at all: nothing may wait for it
    context = await browser.newContext({ ...iphone, locale: 'bs-BA', permissions: [] })
    client = await context.newPage()
    acceptDialogs(client)
    await login(client, 'client')
  })
  test.afterAll(async () => { await context.close() })

  const pickPlace = async (opener, typed, option) => {
    await opener.click()
    await client.getByRole('textbox', { name: /mjesto ili ulica/i }).fill(typed)
    await client.getByRole('option', { name: option }).first().click()
  }

  test('selidba sa dva mjesta, bez dozvole za lokaciju', async () => {
    await client.goto('/objavi')
    await client.getByPlaceholder('npr. Selidba kauča').fill(title)
    await client.getByRole('button', { name: 'Nastavi' }).click()
    await client.getByRole('button', { name: 'Fleksibilan sam' }).click()
    await client.getByRole('button', { name: 'Nastavi' }).click()

    await expect(client.getByRole('heading', { name: 'Gdje?' })).toBeVisible()
    await client.getByRole('button', { name: /Uživo/ }).click()
    await client.getByText('Treba nešto prevesti').click()
    await expect(client.getByText('Odakle', { exact: true })).toBeVisible()
    // Dokle is required once the job moves something
    await pickPlace(client.getByRole('button', { name: /Mjesto ili ulica i broj/ }).first(), 'Sarajevo', /^Sarajevo/)
    await expect(client.getByRole('button', { name: 'Nastavi' })).toBeDisabled()
    await pickPlace(client.getByTestId('post-dropoff'), 'Mostar', /^Mostar/)
    await client.getByRole('button', { name: 'Nastavi' }).click()

    await client.getByPlaceholder(/Napiši šta tačno treba uraditi/).fill('Automatski test: prevesti kauč, oglas je samo za provjeru lokacije.')
    await client.getByRole('button', { name: 'Nastavi' }).click()
    await client.getByRole('button', { name: /Nastavi|Preskoči/ }).first().click()
    // a budget is required: it is held from the balance when the job is published
    await expect(client.getByRole('button', { name: 'Nastavi' })).toBeDisabled()
    await client.getByRole('group', { name: 'Iznos' }).getByRole('button', { name: '5', exact: true }).click()
    await client.getByRole('button', { name: 'Nastavi' }).click()
    await expect(client.getByText(/Odakle: Sarajevo.*Dokle: Mostar/)).toBeVisible()
    await client.getByRole('button', { name: 'Objavi posao' }).click()

    // notifications are only offered: skipping them still publishes
    const skip = client.getByTestId('permissions-skip')
    if (await skip.isVisible({ timeout: 3000 }).catch(() => false)) await skip.click()
    await expect(client).toHaveURL(/\/listings\/[0-9a-f-]{36}/, { timeout: 30_000 })
    await expect(client.getByText('Dokle: Mostar')).toBeVisible()
    await expect(client.getByText('Doseg ponuda')).toHaveCount(0)
  })

  test('veliki grad nudi dio grada, posao ide na taj dio', async () => {
    await client.goto('/objavi')
    await client.getByPlaceholder('npr. Selidba kauča').fill(`${title} naselje`)
    await client.getByRole('button', { name: 'Nastavi' }).click()
    await client.getByRole('button', { name: 'Fleksibilan sam' }).click()
    await client.getByRole('button', { name: 'Nastavi' }).click()
    await client.getByRole('button', { name: /Uživo/ }).click()
    const field = client.getByRole('button', { name: /Mjesto ili ulica i broj/ }).first()
    await pickPlace(field, 'Sarajevo', /^Sarajevo/)
    await expect(client.getByText('Koji dio grada?')).toBeVisible()
    await client.getByRole('button', { name: 'Grbavica', exact: true }).click()
    await expect(client.getByRole('button', { name: 'Grbavica, Novo Sarajevo' })).toBeVisible()
    // tapping the chosen part again goes back to the whole town
    await client.getByRole('button', { name: 'Grbavica', exact: true }).click()
    await expect(client.getByRole('button', { name: 'Sarajevo', exact: true })).toBeVisible()
    await client.getByRole('button', { name: 'Odustani' }).click()
  })

  test('ulica i broj ne smiju u opis', async () => {
    await client.goto('/objavi')
    await client.getByPlaceholder('npr. Selidba kauča').fill(`${title} adresa`)
    await client.getByRole('button', { name: 'Nastavi' }).click()
    await client.getByRole('button', { name: 'Fleksibilan sam' }).click()
    await client.getByRole('button', { name: 'Nastavi' }).click()
    await client.getByRole('button', { name: /Online/ }).click()
    await client.getByRole('button', { name: 'Nastavi' }).click()
    await client.getByPlaceholder(/Napiši šta tačno treba uraditi/).fill('Dođite na Ilirska 67, treći sprat, treba montirati ormar.')
    await client.getByRole('button', { name: 'Nastavi' }).click()
    await client.getByRole('button', { name: /Nastavi|Preskoči/ }).first().click()
    await client.getByRole('group', { name: 'Iznos' }).getByRole('button', { name: '5', exact: true }).click()
    await client.getByRole('button', { name: 'Nastavi' }).click()
    await client.getByRole('button', { name: 'Objavi posao' }).click()
    const skip = client.getByTestId('permissions-skip')
    if (await skip.isVisible({ timeout: 3000 }).catch(() => false)) await skip.click()
    await expect(client.getByText(/Tačnu adresu \(„Ilirska 67“\) ne piši/)).toBeVisible()
    await expect(client).toHaveURL(/\/objavi/)
  })

})
