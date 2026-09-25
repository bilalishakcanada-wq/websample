import { expect, test } from '@playwright/test'
import { accountsConfigured, acceptDialogs, login } from './helpers.js'

/**
 * Verifikacija identiteta kroz sučelje.
 *
 * Testira ono što korisnik stvarno radi: unos, provjeru broja i slanje na
 * provjeru. Odluku tima ne testira ovdje jer E2E nalozi nisu moderatori —
 * to je pokriveno SQL testom (vidi supabase/identity/README.md).
 *
 * JMBG u testu je SINTETIČKI: ispravna kontrolna cifra, ali nije ničiji pravi broj.
 */
test.describe.configure({ mode: 'serial' })

// 0101990 17 000 + kontrolna cifra 3
const JMBG_ISPRAVAN = '0101990170003'
const JMBG_LOSA_CIFRA = '0101990170004'

test.describe('Potvrda identiteta', () => {
  test.skip(!accountsConfigured(), 'E2E nalozi nisu podešeni')

  let ctx; let page

  test.beforeAll(async ({ browser }) => {
    ctx = await browser.newContext()
    page = await ctx.newPage()
    acceptDialogs(page)
    await login(page, 'provider')
  })
  test.afterAll(async () => { await ctx?.close() })

  test('forma traži ime, 13 cifara i sliku dokumenta', async () => {
    await page.goto('/account/verifikacija')
    await expect(page.getByRole('heading', { name: 'Potvrda identiteta' })).toBeVisible()

    const posalji = page.getByRole('button', { name: /Pošalji na provjeru/ })
    await expect(posalji).toBeDisabled()

    await page.getByLabel(/Ime i prezime/).fill('Test Izvođač')
    await page.getByLabel(/^JMBG/).fill(JMBG_ISPRAVAN)
    await expect(posalji).toBeDisabled()           // još nema slike

    await page.locator('.verif-uploads input[type="file"]').first().setInputFiles('e2e/fixtures/dokument.png')
    await expect(posalji).toBeEnabled()
  })

  test('pogrešna kontrolna cifra se odbija sa jasnom porukom', async () => {
    await page.getByLabel(/^JMBG/).fill(JMBG_LOSA_CIFRA)
    await page.getByRole('button', { name: /Pošalji na provjeru/ }).click()
    await expect(page.locator('.form-error')).toContainText(/[Kk]ontroln/, { timeout: 20_000 })
  })

  test('ispravan unos ide na provjeru i forma se zaključa', async () => {
    await page.getByLabel(/^JMBG/).fill(JMBG_ISPRAVAN)
    await page.getByRole('button', { name: /Pošalji na provjeru/ }).click()
    await expect(page.locator('.verif-state.wait')).toContainText('Provjera je u toku', { timeout: 25_000 })
    await expect(page.getByRole('button', { name: /Pošalji na provjeru/ })).toHaveCount(0)
  })
})
