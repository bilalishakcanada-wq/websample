import { expect, test } from '@playwright/test'
import { accountsConfigured, acceptDialogs, login } from './helpers.js'

/**
 * Provjera kvaliteta slike prije slanja i hvatanje iste slike dokumenta na
 * dva naloga. Slike su generisane uzorci (oštar šahovski uzorak vs blagi
 * gradijent), ne stvarni dokumenti.
 */
test.describe.configure({ mode: 'serial' })

const JMBG = '0101990170003'

test.describe('Kvalitet slike i otisak dokumenta', () => {
  test.skip(!accountsConfigured(), 'E2E nalozi nisu podešeni')

  let ctx; let page

  test.beforeAll(async ({ browser }) => {
    ctx = await browser.newContext()
    page = await ctx.newPage()
    acceptDialogs(page)
    await login(page, 'client')
    await page.goto('/account/verifikacija')
    // ako je raniji zahtjev još na čekanju, forma je zaključana i test nema šta provjeriti
    test.skip(await page.locator('.verif-state').count() > 0 && await page.locator('.verif-form').count() === 0,
      'verifikacija je već poslana — forma je zaključana')
  })
  test.afterAll(async () => { await ctx?.close() })

  test('mutna slika se odbija prije slanja, sa objašnjenjem', async () => {
    await page.getByLabel(/Ime i prezime/).fill('Test Klijent')
    await page.getByLabel(/^JMBG/).fill(JMBG)
    await page.locator('.verif-uploads input[type="file"]').first().setInputFiles('e2e/fixtures/mutna.png')

    await expect(page.locator('.verif-nalaz li.lose').filter({ hasText: /mutna/i })).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('.verif-nalaz li.lose').filter({ hasText: /premala/i })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Pošalji na provjeru/ })).toBeDisabled()
  })

  test('tamna slika dobija svoju poruku', async () => {
    await page.locator('.verif-uploads input[type="file"]').first().setInputFiles('e2e/fixtures/tamna.png')
    await expect(page.locator('.verif-nalaz li.lose').filter({ hasText: /pretamna|svjetl/i })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('button', { name: /Pošalji na provjeru/ })).toBeDisabled()
  })

  test('oštra slika prolazi i otključava slanje', async () => {
    await page.locator('.verif-uploads input[type="file"]').first().setInputFiles('e2e/fixtures/ostra.png')
    await expect(page.locator('.verif-upload').first()).toHaveClass(/ima/, { timeout: 20_000 })
    await expect(page.getByRole('button', { name: /Pošalji na provjeru/ })).toBeEnabled()
  })
})
