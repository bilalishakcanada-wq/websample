// Uslovi i pogodnosti posla (supabase/offers/job_conditions.sql), with three accounts:
//   client posts a job that needs the gas licence and says they provide the material
//   → a worker without that badge sees a red cross, the offer button sends them to the badge,
//     and a direct API insert is refused by the database
//   → a worker who holds every badge (majstor@, exists only in the robot's local database) sends the offer.
// Runs only where the tester account is configured (the robot's private database), never against the live site.
import { test, expect } from '@playwright/test'
import { ACCOUNTS, accountsConfigured, acceptDialogs, login } from './helpers.js'

const jwtSub = (authorization = '') => {
  try { return JSON.parse(Buffer.from(authorization.split(' ')[1].split('.')[1], 'base64url').toString()).sub || null } catch { return null }
}

const TESTER = { email: process.env.E2E_TESTER_EMAIL, password: process.env.E2E_TESTER_PASSWORD }

test.describe.serial('Uslovi posla i značke', () => {
  test.skip(!accountsConfigured() || !TESTER.email, 'needs E2E_CLIENT_*, E2E_PROVIDER_* and E2E_TESTER_* (robot/local-db only)')

  let clientCtx, providerCtx, testerCtx
  let client, provider, tester
  const title = `[E2E] Popravka plinskog bojlera ${Date.now()}`
  let listingUrl = ''

  test.beforeAll(async ({ browser }) => {
    ACCOUNTS.tester = TESTER
    clientCtx = await browser.newContext()
    providerCtx = await browser.newContext()
    testerCtx = await browser.newContext()
    client = await clientCtx.newPage()
    provider = await providerCtx.newPage()
    tester = await testerCtx.newPage()
    for (const page of [client, provider, tester]) acceptDialogs(page)
    await login(client, 'client')
    await login(provider, 'provider')
    await login(tester, 'tester')
  })

  test.afterAll(async () => {
    await clientCtx?.close()
    await providerCtx?.close()
    await testerCtx?.close()
  })

  test('klijent traži plinsku licencu i nudi materijal', async () => {
    await client.goto('/objavi')
    await client.getByTestId('post-title').fill(title)
    await client.getByRole('button', { name: 'Fleksibilan sam' }).click()
    await client.getByRole('button', { name: 'Nastavi' }).click()

    await client.getByRole('button', { name: 'Online / na daljinu' }).click()
    await client.getByRole('button', { name: 'Nastavi' }).click()

    await client.getByRole('combobox').first().selectOption({ label: 'Ostalo' })
    await client.getByTestId('post-description').fill('Automatski test uslova posla. Ništa ne treba raditi — ovaj oglas se briše na kraju testa.')
    await client.getByTestId('condition-licence_gas').click()
    await client.getByTestId('condition-materials').click()
    await expect(client.getByTestId('condition-licence_gas')).toHaveAttribute('aria-pressed', 'true')
    await client.getByRole('button', { name: 'Nastavi' }).click()

    await client.getByRole('button', { name: 'Nastavi' }).click() // photos are optional

    await client.getByTestId('post-price').fill('1')
    await expect(client.getByText('Licenca: plin · Obezbjeđujem materijal')).toBeVisible()
    await client.getByRole('button', { name: 'Objavi posao' }).click()

    await expect(client).toHaveURL(/\/listings\/[0-9a-f-]{36}/, { timeout: 30_000 })
    listingUrl = new URL(client.url()).pathname
    await expect(client.getByTestId('job-conditions')).toContainText('Plinska licenca')
    await expect(client.getByTestId('job-conditions')).toContainText('Materijal')
  })

  test('izvođač bez značke vidi križić i put do značke', async () => {
    await provider.goto(listingUrl)
    await expect(provider.getByRole('heading', { name: title })).toBeVisible()
    const row = provider.getByTestId('condition-state-licence_gas')
    await expect(row).toHaveAttribute('data-met', 'false')
    const cta = provider.getByRole('button', { name: 'Osvoji značku: Plinska licenca' }).first()
    await expect(cta).toBeVisible()
    await cta.click()
    await expect(provider).toHaveURL(/\/account\/znacke\?next=.*#licence_gas/)
    await expect(provider.getByText(/vrati se na posao/)).toBeVisible()
  })

  test('baza odbija ponudu i kad se zaobiđe sučelje', async () => {
    // reuse the app's own Supabase headers (anon key + the worker's session) for a direct REST call
    const signedRequest = provider.waitForRequest((req) => req.url().includes('/rest/v1/') && Boolean(jwtSub(req.headers().authorization)))
    await provider.goto(listingUrl)
    const sample = await signedRequest
    const headers = sample.headers()
    const base = sample.url().split('/rest/v1/')[0]
    const me = jwtSub(headers.authorization)
    const response = await provider.request.post(`${base}/rest/v1/bids`, {
      headers: { apikey: headers.apikey, authorization: headers.authorization, 'content-type': 'application/json' },
      data: { listing_id: listingUrl.split('/').pop(), bidder_id: me, amount: 1, message: 'Pokušaj mimo sučelja.' },
    })
    expect(response.ok()).toBe(false)
    expect(await response.text()).toMatch(/USLOV_POSLA|bids_insert_conditions/)
  })

  test('izvođač sa svim značkama šalje ponudu', async () => {
    await tester.goto(listingUrl)
    await expect(tester.getByTestId('condition-state-licence_gas')).toHaveAttribute('data-met', 'true')
    await tester.getByRole('button', { name: 'Pošalji ponudu' }).first().click()
    const sheet = tester.getByRole('dialog')
    await sheet.getByLabel('Tvoja ponuda (KM)').fill('1')
    await sheet.getByTestId('offer-message').fill('Automatski test: ponuda majstora sa licencom.')
    await sheet.getByRole('button', { name: 'Pošalji ponudu' }).click()
    await expect(tester.getByText('Ponuda je uspješno poslana.')).toBeVisible()
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
