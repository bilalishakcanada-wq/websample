import { expect } from '@playwright/test'

export const ACCOUNTS = {
  client: { email: process.env.E2E_CLIENT_EMAIL, password: process.env.E2E_CLIENT_PASSWORD },
  provider: { email: process.env.E2E_PROVIDER_EMAIL, password: process.env.E2E_PROVIDER_PASSWORD },
}

export const accountsConfigured = () => Boolean(ACCOUNTS.client.email && ACCOUNTS.client.password && ACCOUNTS.provider.email && ACCOUNTS.provider.password)

/** Signs in through the real login page and waits for the account area. */
export async function login(page, who) {
  const { email, password } = ACCOUNTS[who]
  await page.goto('/login')
  await page.getByLabel('Email adresa').fill(email)
  await page.getByLabel('Lozinka', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Nastavi' }).click()
  await expect(page).toHaveURL(/\/account/, { timeout: 20_000 })
}

/** Native confirm()/alert() dialogs are accepted so destructive steps can proceed. */
export function acceptDialogs(page) {
  page.on('dialog', (dialog) => dialog.accept())
}
