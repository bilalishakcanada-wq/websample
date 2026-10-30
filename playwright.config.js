// @ts-check
import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests against a real build talking to the real Supabase project.
 *   local:  E2E_BASE_URL=http://localhost:54971 npx playwright test   (dev server already running)
 *   CI:     builds with VITE_NO_PWA=1 (no service worker in tests) and serves `vite preview`.
 * Accounts come from E2E_CLIENT_EMAIL / E2E_CLIENT_PASSWORD / E2E_PROVIDER_EMAIL / E2E_PROVIDER_PASSWORD.
 */
const baseURL = process.env.E2E_BASE_URL || 'http://localhost:4173'
// the flows start as someone who already answered the cookie banner (e2e/cookie-consent.spec.js tests the banner itself)
const CONSENT_CHOSEN = { name: 'zadatak-consent', value: JSON.stringify({ v: 1, errors: false, at: '2026-10-30T00:00:00.000Z' }) }

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'bs-BA',
    ...devices['Desktop Chrome'],
    // a new account and a new job need location and notifications allowed (components/RequiredPermissions.jsx);
    // everyone in the test database is in Sarajevo, so the device point is too
    permissions: ['geolocation', 'notifications'],
    storageState: { cookies: [], origins: [{ origin: new URL(baseURL).origin, localStorage: [CONSENT_CHOSEN] }] },
    geolocation: { latitude: 43.8563, longitude: 18.4131 },
    // a preinstalled Chromium (sandboxes without `playwright install`): PW_CHROMIUM=/path/to/chrome
    ...(process.env.PW_CHROMIUM ? { launchOptions: { executablePath: process.env.PW_CHROMIUM } } : {}),
  },
  webServer: process.env.E2E_BASE_URL ? undefined : {
    command: 'npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
