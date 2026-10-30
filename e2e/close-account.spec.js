// Zatvori nalog: Postavke → "Deaktiviraj ili obriši nalog" → izbor, obavezan razlog, kod s emaila.
//   The code step stays locked until a choice and a reason are picked; a wrong code shows the server's words;
//   the right code leaves only the "Nalog je deaktiviran" screen, and "Ponovo aktiviraj" brings the app back.
// The delete-account function is answered here (no edge functions in the test database, and nothing may
// really close the test account); the page, the session and everything else are real.
import { test, expect } from '@playwright/test'
import { accountsConfigured, login } from './helpers.js'

test.describe('Zatvori nalog', () => {
  test.skip(!accountsConfigured(), 'E2E accounts are not configured (E2E_CLIENT_* / E2E_PROVIDER_* env)')

  test('kod s emaila i razlog prije deaktivacije, pa povratak', async ({ page }) => {
    const calls = []
    await page.route('**/functions/v1/delete-account', async (route) => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } })
      const body = route.request().postDataJSON() || {}
      calls.push(body)
      const reply = (status, json) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(json) })
      if (body.action === 'send_code') return reply(200, { sent: true, wait: 60 })
      if (body.action === 'deactivate') return body.code === '482913' ? reply(200, { success: true }) : reply(400, { error: 'Kod nije tačan. Još 4 pokušaja.' })
      if (body.action === 'reactivate') return reply(200, { success: true })
      return reply(400, { error: 'unexpected' })
    })

    await login(page, 'client')
    await page.goto('/account/postavke')
    await page.getByTestId('delete-account').click()
    await expect(page).toHaveURL(/\/account\/zatvori-nalog/)

    const send = page.getByTestId('close-send-code')
    await expect(send).toBeDisabled()
    await page.locator('label').filter({ has: page.getByTestId('close-mode-deactivate') }).click()
    await expect(send).toBeDisabled() // still needs a reason
    await expect(page.getByTestId('close-reason-other')).toBeEnabled()
    await page.locator('label').filter({ has: page.getByTestId('close-reason-other') }).click()
    await expect(send).toBeDisabled() // "Nešto drugo" needs a few words
    await page.getByTestId('close-detail').fill('Selim se u inostranstvo')
    await expect(send).toBeEnabled()
    await send.click()

    const confirm = page.getByTestId('close-confirm')
    await expect(confirm).toBeDisabled()
    await page.getByTestId('close-code').fill('111111')
    await confirm.click()
    await expect(page.getByRole('alert')).toContainText('Kod nije tačan')

    await page.getByTestId('close-code').fill('482913')
    await confirm.click()
    await expect(page.getByTestId('deactivated-screen')).toBeVisible()
    expect(calls.find((call) => call.action === 'deactivate' && call.code === '482913')).toMatchObject({ reason: 'other', detail: 'Selim se u inostranstvo' })

    await page.getByTestId('reactivate-account').click()
    await expect(page.getByTestId('deactivated-screen')).toBeHidden()
  })
})
