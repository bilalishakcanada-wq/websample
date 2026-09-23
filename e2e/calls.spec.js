import { expect, test } from '@playwright/test'
import { accountsConfigured, login } from './helpers.js'

/**
 * Poziv unutar aplikacije, obje strane. Chromium dobija lažni mikrofon i kameru
 * (--use-fake-device-for-media-stream), pa poziv može proći bez pravog hardvera.
 *
 * Preduslov: postoji razgovor u kojem je posao u toku (chat_state = 'open').
 * Test ga sam ne pravi — koristi onaj koji već stoji u bazi; ako ga nema, preskače.
 */
test.describe.configure({ mode: 'serial' })

test.describe('Pozivi u aplikaciji', () => {
  test.skip(!accountsConfigured(), 'E2E nalozi nisu podešeni')

  let clientCtx
  let providerCtx
  let client
  let provider

  test.beforeAll(async ({ browser }) => {
    const media = {
      permissions: ['microphone', 'camera'],
      locale: 'bs-BA',
    }
    clientCtx = await browser.newContext(media)
    providerCtx = await browser.newContext(media)
    client = await clientCtx.newPage()
    provider = await providerCtx.newPage()
    await login(client, 'client')
    await login(provider, 'provider')
  })

  test.afterAll(async () => {
    await clientCtx?.close()
    await providerCtx?.close()
  })

  test('dugmad za poziv postoje samo dok je posao u toku', async () => {
    await client.goto('/messages')
    await client.waitForSelector('.chat-list-main', { timeout: 20_000 })
    await client.locator('.chat-list-main').first().click()
    await client.waitForTimeout(1500)

    const state = await client.evaluate(() => ({
      pozivi: document.querySelectorAll('.chat-call').length,
      composer: Boolean(document.querySelector('.chat-composer')),
      zakljucano: Boolean(document.querySelector('.ch-state-notice')),
    }))
    // ili je otvoreno (pozivi + composer) ili zaključano (obavijest, bez poziva)
    if (state.zakljucano) {
      expect(state.pozivi).toBe(0)
      expect(state.composer).toBe(false)
    } else {
      expect(state.pozivi).toBe(2)
      expect(state.composer).toBe(true)
    }
  })

  test('klijent zove, izvođaču zazvoni i javi se', async () => {
    await client.goto('/messages')
    await client.waitForSelector('.chat-list-main', { timeout: 20_000 })

    // otvori prvi razgovor koji ima dugmad za poziv (posao u toku)
    const rows = client.locator('.chat-list-main')
    const count = await rows.count()
    let open = null
    for (let i = 0; i < count; i += 1) {
      await rows.nth(i).click()
      await client.waitForTimeout(1200)
      if (await client.locator('.chat-call').count() > 0) { open = client.locator('.chat-call').first(); break }
      await client.goto('/messages')
      await client.waitForSelector('.chat-list-main', { timeout: 20_000 })
    }
    expect(open, 'nema razgovora u stanju open').not.toBeNull()

    await provider.goto('/messages')

    await open.click()                                    // audio poziv
    await expect(client.locator('.call-panel')).toBeVisible({ timeout: 15_000 })

    // izvođaču stiže dolazni poziv kroz Realtime
    await expect(provider.locator('.call-panel')).toBeVisible({ timeout: 20_000 })
    await provider.locator('.call-answer').click()

    // obje strane u razgovoru
    await expect(provider.locator('.call-decline')).toBeVisible()
    await expect(client.locator('.call-panel')).toBeVisible()

    await client.locator('.call-decline').click()         // prekid
    await expect(client.locator('.call-panel')).toHaveCount(0, { timeout: 10_000 })
  })
})
