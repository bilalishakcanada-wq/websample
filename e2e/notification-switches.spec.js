// Obavijesti: the switches under Postavke really hold, and the red count on the bell goes away once read.
//   Push / Email switch off → stays off after a reload (the database skips push / email for this person)
//   → on again → stays on. Postavke obavijesti shows the same state.
//   Count next to Obavijesti: opening the list marks everything read and the count disappears (and stays gone).
import { test, expect } from '@playwright/test'
import { accountsConfigured, login } from './helpers.js'

test.describe.serial('Obavijesti: prekidači i brojač', () => {
  test.skip(!accountsConfigured(), 'E2E accounts are not configured (E2E_CLIENT_* / E2E_PROVIDER_* env)')

  test.beforeEach(async ({ page }) => { await login(page, 'client') })

  const setSwitch = async (page, testid, on) => {
    const toggle = page.getByTestId(testid)
    await expect(toggle).toBeEnabled()
    if ((await toggle.getAttribute('aria-checked')) !== String(on)) await toggle.click()
    await expect(toggle).toHaveAttribute('aria-checked', String(on))
    await expect(toggle).toBeEnabled() // saved
  }

  test('Push i Email ostaju kako ih postaviš', async ({ page }) => {
    await page.goto('/account/postavke')
    await setSwitch(page, 'notify-push-toggle', false)
    await setSwitch(page, 'notify-email-toggle', false)

    await page.reload()
    await expect(page.getByTestId('notify-push-toggle')).toHaveAttribute('aria-checked', 'false')
    await expect(page.getByTestId('notify-email-toggle')).toHaveAttribute('aria-checked', 'false')
    // the phone row never claims "prima obavijesti" while push is off for the account
    await expect(page.getByTestId('device-push')).not.toContainText('prima obavijesti')

    await page.goto('/account/postavke-obavijesti')
    const channels = page.locator('.np-row input[role="switch"]')
    await expect(channels.nth(0)).not.toBeChecked()
    await expect(channels.nth(1)).not.toBeChecked()
    await expect(page.getByText('Isključeno').first()).toBeVisible()

    await page.goto('/account/postavke')
    await setSwitch(page, 'notify-push-toggle', true)
    await setSwitch(page, 'notify-email-toggle', true)
    await page.reload()
    await expect(page.getByTestId('notify-push-toggle')).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByTestId('notify-email-toggle')).toHaveAttribute('aria-checked', 'true')
  })

  test('brojač kod Obavijesti nestane kad ih pročitaš', async ({ page }) => {
    await page.goto('/search')
    const link = page.getByTestId('side-account-obavijesti')
    const badge = link.locator('.mobile-nav-badge')
    const hasUnread = await badge.waitFor({ state: 'visible', timeout: 8_000 }).then(() => true, () => false)
    test.skip(!hasUnread, 'no unread notifications for this account right now')
    await link.click() // in-app: the menu (and its count) stays on screen
    await expect(page).toHaveURL(/\/account\/obavijesti/)
    await expect(badge).toHaveCount(0)
    await page.reload()
    await expect(page.locator('.notif-list').first()).toBeVisible()
    await expect(badge).toHaveCount(0)
  })
})
