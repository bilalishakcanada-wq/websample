// Izdvojeni oglas, uživo osvježavanje, nova cijena nakon odbijanja i ploča izvođača
// (supabase/marketplace/01_promoted_and_rebids.sql), with two signed-in browsers side by side:
//   client posts a VIP job (paid from the wallet) → it is pinned first in search with the VIP badge
//   → provider offers 200 KM; the client's open job page shows it without a reload
//   → client rejects; the provider's page flips to "Pošalji novu cijenu" without a reload
//   → the same price is refused, 150 KM goes through and reaches the client live
//   → the provider finds the job under "Aktivne ponude" on the provider board.
// Needs supabase/marketplace/01 on the database: skipped where the package picker is missing.
import { test, expect } from '@playwright/test'
import { accountsConfigured, acceptDialogs, login } from './helpers.js'

test.describe.serial('Izdvojeni oglas, uživo ponude i nova cijena', () => {
  test.skip(!accountsConfigured(), 'needs E2E_CLIENT_* and E2E_PROVIDER_*')

  let clientCtx, providerCtx
  let client, provider
  const title = `[E2E] VIP sklapanje ormara ${Date.now()}`
  let listingUrl = ''

  test.beforeAll(async ({ browser }) => {
    clientCtx = await browser.newContext()
    providerCtx = await browser.newContext()
    client = await clientCtx.newPage()
    provider = await providerCtx.newPage()
    for (const page of [client, provider]) acceptDialogs(page)
    await login(client, 'client')
    await login(provider, 'provider')
  })

  test.afterAll(async () => {
    await clientCtx?.close()
    await providerCtx?.close()
  })

  test('klijent objavljuje VIP oglas', async () => {
    await client.goto('/objavi')
    await client.getByTestId('post-title').fill(title)
    await client.getByRole('button', { name: 'Fleksibilan sam' }).click()
    await client.getByRole('button', { name: 'Nastavi' }).click()
    await client.getByRole('button', { name: 'Online / na daljinu' }).click()
    await client.getByRole('button', { name: 'Nastavi' }).click()
    await client.getByRole('combobox').first().selectOption({ label: 'Ostalo' })
    await client.getByTestId('post-description').fill('Automatski test izdvojenog oglasa. Ništa ne treba raditi — ovaj oglas se briše na kraju testa.')
    await client.getByRole('button', { name: 'Nastavi' }).click()
    await client.getByRole('button', { name: 'Nastavi' }).click() // photos are optional
    await client.getByTestId('post-price').fill('220')

    const picker = client.getByTestId('promo-picker')
    test.skip(!(await picker.isVisible({ timeout: 10_000 }).catch(() => false)), 'supabase/marketplace/01 is not on this database')
    await client.getByTestId('promo-option-vip').click()
    await expect(client.getByTestId('promo-option-vip')).toHaveAttribute('aria-checked', 'true')
    await client.getByRole('button', { name: 'Objavi posao' }).click()

    await expect(client).toHaveURL(/\/listings\/[0-9a-f-]{36}/, { timeout: 30_000 })
    listingUrl = new URL(client.url()).pathname
    await expect(client.getByTestId('promo-badge-vip').first()).toBeVisible()
    await expect(client.getByTestId('promote-card')).toContainText('VIP oglas do')
  })

  test('VIP oglas je prvi u pretrazi', async () => {
    await provider.goto('/search')
    const card = provider.locator('.task-card.is-promo-vip').filter({ hasText: title })
    await expect(card).toBeVisible()
    await expect(card.getByTestId('promo-badge-vip')).toBeVisible()
    // pinned: no ordinary job is listed above it
    const firstOrdinary = await provider.locator('.task-card').evaluateAll((cards) => cards.findIndex((el) => !/is-promo-/.test(el.className)))
    const mine = await provider.locator('.task-card').evaluateAll((cards, t) => cards.findIndex((el) => el.textContent.includes(t)), title)
    expect(firstOrdinary === -1 || mine < firstOrdinary).toBe(true)
  })

  test('ponuda stiže klijentu bez osvježavanja', async () => {
    await client.goto(listingUrl)
    await expect(client.getByRole('heading', { name: title })).toBeVisible()
    await client.waitForTimeout(1500) // let the realtime channel join

    await provider.goto(listingUrl)
    await provider.getByRole('button', { name: 'Pošalji ponudu' }).first().click()
    const sheet = provider.getByRole('dialog')
    await sheet.getByLabel('Tvoja ponuda (KM)').fill('200')
    await sheet.getByTestId('offer-message').fill('Automatski test: prva ponuda.')
    await sheet.getByRole('button', { name: 'Pošalji ponudu' }).click()
    await expect(provider.getByText('Ponuda je uspješno poslana.')).toBeVisible()

    // the client never reloads: the offer appears through Supabase Realtime
    await expect(client.locator('.offer-row').filter({ hasText: 'Automatski test: prva ponuda.' })).toBeVisible({ timeout: 20_000 })
  })

  test('odbijanje stiže izvođaču uživo i on šalje novu cijenu', async () => {
    await client.locator('.offer-row').filter({ hasText: 'Automatski test: prva ponuda.' }).getByRole('button', { name: 'Odbij' }).click()
    await client.getByRole('dialog').getByRole('button', { name: 'Odbij', exact: true }).click()

    // provider is still on the job page from the previous step: no reload
    await expect(provider.getByTestId('rebid-note')).toContainText('Klijent je odbio ponudu. Pošalji novu cijenu.', { timeout: 20_000 })
    await provider.getByTestId('rebid-open').click()
    const sheet = provider.getByRole('dialog')
    await expect(sheet.getByTestId('rebid-sheet-note')).toContainText('200')

    await sheet.getByLabel('Tvoja ponuda (KM)').fill('200')
    await sheet.getByTestId('offer-message').fill('Automatski test: ista cijena.')
    await sheet.getByRole('button', { name: 'Pošalji ponudu' }).click()
    await expect(sheet.getByText(/Klijent je već odbio 200 KM/)).toBeVisible()

    await sheet.getByLabel('Tvoja ponuda (KM)').fill('150')
    await sheet.getByTestId('offer-message').fill('Automatski test: nova cijena.')
    await sheet.getByRole('button', { name: 'Pošalji ponudu' }).click()
    await expect(provider.getByText('Nova cijena je poslana klijentu.')).toBeVisible()

    await expect(client.locator('.offer-row').filter({ hasText: 'Automatski test: nova cijena.' })).toBeVisible({ timeout: 20_000 })
  })

  test('izvođač vidi posao na ploči: Aktivne ponude', async () => {
    await provider.goto('/account')
    const board = provider.getByTestId('provider-dashboard')
    await expect(board).toBeVisible()
    await board.getByTestId('pd-tab-active').click()
    await expect(board.getByTestId('pd-card-pending').filter({ hasText: title })).toBeVisible()
  })

  test('test oglas se briše', async () => {
    await client.goto('/account')
    const row = client.getByTestId('dashboard-listing').filter({ hasText: title })
    await expect(row).toBeVisible()
    await row.getByRole('button', { name: /Obriši/ }).click()
    await client.getByRole('dialog').getByRole('button', { name: 'Obriši', exact: true }).click()
    await expect(row).toHaveCount(0, { timeout: 15_000 })
  })
})
