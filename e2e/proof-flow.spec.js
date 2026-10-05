import { expect, test } from '@playwright/test'
import { accountsConfigured, acceptDialogs, login } from './helpers.js'

/**
 * Foto dokaz na licu mjesta (supabase/booking/04): posao na terenu se ne može predati
 * bez slike PRIJE i POSLIJE, napravljene kamerom u aplikaciji, sa GPS-om i UTC vremenom.
 * Chromium dobija lažnu kameru (testni video) i fiksnu lokaciju u Sarajevu.
 * Na kraju klijent prijavi problem: uplata se zamrzava kao spor.
 */
test.describe.configure({ mode: 'serial' })
test.use({
  launchOptions: {
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
    ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}),
  },
})

const title = `[E2E] Foto dokaz ${Date.now()}`
const SARAJEVO = { latitude: 43.8563, longitude: 18.4131, accuracy: 15 }

test.describe('Foto dokaz: prije i poslije, sa lokacijom', () => {
  test.skip(!accountsConfigured(), 'E2E nalozi nisu podešeni')

  let clientCtx; let providerCtx; let client; let provider; let listingUrl = ''

  test.beforeAll(async ({ browser }) => {
    clientCtx = await browser.newContext()
    providerCtx = await browser.newContext({ permissions: ['geolocation', 'camera'], geolocation: SARAJEVO })
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

  test('posao na lokaciji se objavi, prihvati i plati', async () => {
    await client.goto('/objavi')
    await client.getByTestId('post-title').fill(title)
    await client.getByRole('button', { name: 'Fleksibilan sam' }).click()
    await client.getByRole('button', { name: 'Nastavi' }).click()
    await client.getByRole('button', { name: 'Na lokaciji' }).click()
    await client.locator('#task-city').fill('Sarajevo')
    await client.getByRole('option', { name: 'Sarajevo', exact: true }).first().click()
    await client.getByRole('button', { name: 'Nastavi' }).click()
    await client.getByRole('combobox').first().selectOption({ label: 'Ostalo' })
    await client.getByTestId('post-description').fill('Automatski test foto dokaza na licu mjesta. Oglas ostaje kao spor.')
    await client.getByRole('button', { name: 'Nastavi' }).click()
    await client.getByRole('button', { name: 'Nastavi' }).click()   // slike su neobavezne
    await client.getByTestId('post-price').fill('1')
    await client.getByRole('button', { name: 'Objavi posao' }).click()
    await expect(client).toHaveURL(/\/listings\/[0-9a-f-]{36}/, { timeout: 30_000 })
    listingUrl = new URL(client.url()).pathname

    await provider.goto(listingUrl)
    await provider.getByRole('button', { name: 'Pošalji ponudu' }).first().click()
    const sheet = provider.getByRole('dialog')
    await sheet.getByLabel('Tvoja ponuda (KM)').fill('1')
    await sheet.getByTestId('offer-message').fill('Automatski test: ponuda za posao na lokaciji.')
    await sheet.getByRole('button', { name: 'Pošalji ponudu' }).click()
    await expect(provider.getByText(/Tvoja ponuda:/)).toBeVisible()

    await client.goto(listingUrl)
    await client.getByTestId('offer-accept').click()
    await client.getByTestId('payment-confirm').click()
    await expect(client.getByText(/osigurano na Zadatku/).first()).toBeVisible({ timeout: 20_000 })
  })

  test('bez slika prije i poslije rad se ne može predati', async () => {
    await provider.goto(listingUrl)
    await expect(provider.getByTestId('workflow-proof')).toBeVisible()
    await expect(provider.getByTestId('proof-after')).toBeDisabled()   // prvo slika prije
    await provider.getByTestId('workflow-submit').click()
    await provider.getByTestId('workflow-report').fill('Sve urađeno po dogovoru, provjereno sa klijentom.')
    await expect(provider.getByTestId('workflow-submit-confirm')).toBeDisabled()
    await provider.getByRole('button', { name: 'Odustani' }).click()
  })

  test('izvođač slika kamerom prije i poslije, sa lokacijom', async () => {
    for (const kind of ['before', 'after']) {
      await provider.getByTestId(`proof-${kind}`).click()
      await expect(provider.getByTestId('proof-gps')).toContainText('43.85630, 18.41310', { timeout: 15_000 })
      await provider.getByTestId('proof-shutter').click()
      await expect(provider.getByText(kind === 'before' ? 'Slika prije početka je sačuvana.' : 'Slika urađenog posla je sačuvana.')).toBeVisible({ timeout: 20_000 })
    }
    const gallery = provider.getByTestId('workflow-proofs')
    await expect(gallery.locator('img')).toHaveCount(2)
    await expect(gallery).toContainText('UTC')
    await expect(gallery).toContainText('±15 m')
  })

  test('rad se predaje, klijent vidi slike sa pečatom', async () => {
    await provider.getByTestId('workflow-submit').click()
    await provider.getByTestId('workflow-report').fill('Sve urađeno po dogovoru, provjereno sa klijentom.')
    await provider.getByTestId('workflow-submit-confirm').click()
    await expect(provider.getByTestId('workflow-state')).toHaveText('Čeka se da klijent pregleda', { timeout: 20_000 })

    await client.goto(listingUrl)
    await expect(client.getByTestId('workflow-proofs').locator('img')).toHaveCount(2)
  })

  test('klijent prijavi problem: uplata se zamrzava', async () => {
    await client.getByTestId('workflow-dispute').click()
    await client.locator('#wf-claim').fill('Automatski test: posao nije urađen kako je dogovoreno.')
    await client.getByRole('button', { name: 'Prijavi problem' }).last().click()
    await expect(client.getByTestId('workflow-state')).toHaveText('Spor — tim pregleda', { timeout: 20_000 })
    await expect(client.getByRole('button', { name: /Odobri i isplati/ })).toHaveCount(0)
  })
})
