import { expect } from '@playwright/test'

export const ACCOUNTS = {
  client: { email: process.env.E2E_CLIENT_EMAIL, password: process.env.E2E_CLIENT_PASSWORD },
  provider: { email: process.env.E2E_PROVIDER_EMAIL, password: process.env.E2E_PROVIDER_PASSWORD },
  admin: { email: process.env.E2E_ADMIN_EMAIL, password: process.env.E2E_ADMIN_PASSWORD },
}

export const accountsConfigured = () => Boolean(ACCOUNTS.client.email && ACCOUNTS.client.password && ACCOUNTS.provider.email && ACCOUNTS.provider.password)

/** Signs in through the real login page and waits for the account area. */
export async function login(page, who) {
  const { email, password } = ACCOUNTS[who]
  await page.goto('/login')
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('password-input').fill(password)
  await page.getByTestId('login-submit').click()
  // desktop lands on /account, phones on the app home
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 })
}

/** Native confirm()/alert() dialogs are accepted so destructive steps can proceed. */
export function acceptDialogs(page) {
  page.on('dialog', (dialog) => dialog.accept())
}
