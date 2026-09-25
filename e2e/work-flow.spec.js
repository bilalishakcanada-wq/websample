import { expect, test } from '@playwright/test'
import { accountsConfigured, acceptDialogs, login } from './helpers.js'

/**
 * Tok posla od osiguranog novca do isplate, kroz sučelje:
 *   izvođač predaje rad (sa dokazom) → klijent traži ispravku → izvođač predaje
 *   ponovo → klijent odobri → novac ide izvođaču.
 *
 * Provjerava i da dokaz zaista JESTE obavezan i da klijent ne može odobriti
 * posao koji nije predat.
 */
test.describe.configure({ mode: 'serial' })

const title = `[E2E] Tok posla ${Date.now()}`

test.describe('Tok posla: predaja, ispravka, odobrenje', () => {
  test.skip(!accountsConfigured(), 'E2E nalozi nisu podešeni')

  let clientCtx; let providerCtx; let client; let provider; let listingUrl = ''

  test.beforeAll(async ({ browser }) => {
    clientCtx = await browser.newContext()
    providerCtx = await browser.newContext()
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

  test('posao se objavi, prihvati i plati', async () => {
    await client.goto('/objavi')
    await client.getByPlaceholder('npr. Montaža kuhinjskih elemenata').fill(title)
    await client.getByRole('button', { name: 'Fleksibilan sam' }).click()
    await client.getByRole('button', { name: 'Nastavi' }).click()
    await client.getByRole('button', { name: 'Online / na daljinu' }).click()
    await client.getByRole('button', { name: 'Nastavi' }).click()
    await client.getByRole('combobox').first().selectOption({ label: 'Ostalo' })
    await client.getByPlaceholder(/Opišite šta tačno treba uraditi/).fill('Automatski test toka posla. Ovaj oglas se briše na kraju testa.')
    await client.getByRole('button', { name: 'Nastavi' }).click()
    await client.getByRole('button', { name: 'Nastavi' }).click()   // slike su neobavezne
    await client.getByPlaceholder(/Ostavite prazno/).fill('1')
    await client.getByRole('button', { name: 'Objavi posao' }).click()
    await expect(client).toHaveURL(/\/listings\/[0-9a-f-]{36}/, { timeout: 30_000 })
    listingUrl = new URL(client.url()).pathname

    await provider.goto(listingUrl)
    await provider.getByRole('button', { name: 'Pošalji ponudu' }).first().click()
    const sheet = provider.getByRole('dialog')
    await sheet.getByLabel('Tvoja ponuda (KM)').fill('1')
    await sheet.getByPlaceholder(/Napiši zašto si prava osoba/).fill('Automatski test: ponuda za tok posla.')
    await sheet.getByRole('button', { name: 'Pošalji ponudu' }).click()
    await expect(provider.getByText(/Tvoja ponuda:/)).toBeVisible()

    await client.goto(listingUrl)
    await client.getByRole('button', { name: 'Prihvati i plati' }).click()
    await client.getByRole('button', { name: /Prihvati i osiguraj/ }).click()
    await expect(client.getByText(/osigurano na Poso\.ba/).first()).toBeVisible({ timeout: 20_000 })
  })

  test('klijent ne može odobriti rad koji nije predat', async () => {
    await client.goto(listingUrl)
    await expect(client.locator('.wf-card')).toBeVisible()
    await expect(client.locator('.wf-head .pill')).toHaveText('Izvođač radi posao')
    await expect(client.getByRole('button', { name: /Odobri i isplati/ })).toHaveCount(0)
  })

  test('izvođač ne može predati rad bez dokaza', async () => {
    await provider.goto(listingUrl)
    await provider.getByRole('button', { name: /^Predaj rad$/ }).click()
    await provider.getByLabel('Šta si uradio/la?').fill('kratko')       // ispod 20 znakova
    await expect(provider.getByRole('button', { name: /Predaj rad/ }).last()).toBeDisabled()
  })

  test('izvođač predaje rad, klijentu teče rok od 72 sata', async () => {
    await provider.getByLabel('Šta si uradio/la?').fill('Montirani svi elementi, police poravnate i provjerene nivelirom.')
    await provider.getByRole('button', { name: /Predaj rad/ }).last().click()
    await expect(provider.locator('.wf-head .pill')).toHaveText('Čeka se da klijent pregleda', { timeout: 20_000 })

    await client.goto(listingUrl)
    await expect(client.locator('.wf-head .pill')).toHaveText('Rad je predat — pregledaj ga')
    await expect(client.locator('.wf-clock')).toContainText('Automatsko odobrenje')
    await expect(client.locator('.wf-submission')).toContainText('police poravnate')
  })

  test('klijent traži ispravku, izvođač predaje ponovo', async () => {
    await client.getByRole('button', { name: /Traži ispravku/ }).click()
    const dialog = client.getByRole('dialog')
    await dialog.getByRole('textbox').fill('Dvije police nisu poravnate, molim ispravi.')
    await dialog.getByRole('button', { name: 'Pošalji' }).click()
    await expect(client.locator('.wf-head .pill')).toHaveText('Tražio/la si ispravku', { timeout: 20_000 })

    await provider.goto(listingUrl)
    await expect(provider.locator('.wf-head .pill')).toHaveText('Klijent traži ispravku')
    await provider.getByRole('button', { name: /Predaj ispravljen rad/ }).click()
    await provider.getByLabel('Šta si uradio/la?').fill('Police su poravnate i ponovo provjerene, sve je po dogovoru.')
    await provider.getByRole('button', { name: /Predaj rad/ }).last().click()
    await expect(provider.locator('.wf-head .pill')).toHaveText('Čeka se da klijent pregleda', { timeout: 20_000 })
  })

  test('klijent odobrava i izvođač dobija novac', async () => {
    await client.goto(listingUrl)
    await expect(client.locator('.wf-submission')).toContainText('ponovo provjerene')
    await client.getByRole('button', { name: /Odobri i isplati/ }).click()
    await client.getByRole('dialog').getByRole('button', { name: /Odobri i isplati/ }).click()
    await expect(client.locator('.wf-head .pill')).toHaveText('Posao je završen', { timeout: 25_000 })
    await expect(client.getByText(/Uplata oslobođena/).first()).toBeVisible()
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
