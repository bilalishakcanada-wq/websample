// The cookie banner on a first visit: on a small phone its three buttons fit, nothing covers them, it
// sits above the tab bar, the choice sticks after a reload and can be changed on the cookie policy page.
import { test, expect, devices } from '@playwright/test'

const { defaultBrowserType: _browser, ...smallPhone } = devices['Galaxy S9+']
const firstVisit = { cookies: [], origins: [] }

/** True when a tap in the middle of the element lands on that element and it is fully on screen. */
const tappable = (locator) => locator.evaluate((el) => {
  const r = el.getBoundingClientRect()
  const onScreen = r.left >= 0 && r.top >= 0 && r.right <= window.innerWidth && r.bottom <= window.innerHeight
  const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
  return onScreen && Boolean(hit) && (hit === el || el.contains(hit))
})

test('telefon: baner za kolačiće se vidi, ne prekriva meni i pamti izbor', async ({ browser }) => {
  const context = await browser.newContext({ ...smallPhone, viewport: { width: 360, height: 640 }, locale: 'bs-BA', storageState: firstVisit })
  const page = await context.newPage()
  await page.goto('/')

  const banner = page.getByRole('dialog', { name: 'Kolačići i memorija preglednika' })
  await expect(banner).toBeVisible()
  for (const name of ['Postavke', 'Samo neophodno', 'Prihvati sve']) {
    expect(await tappable(banner.getByRole('button', { name, exact: true })), `"${name}" se može pritisnuti`).toBe(true)
  }

  // above the tab bar, and at most half the screen
  const box = await banner.boundingBox()
  const nav = await page.locator('.mobile-nav').boundingBox()
  if (nav) expect(box.y + box.height).toBeLessThanOrEqual(nav.y)
  expect(box.height).toBeLessThan(640 / 2)

  // settings: the optional switch works from the keyboard, necessary storage cannot be switched off
  await banner.getByRole('button', { name: 'Postavke', exact: true }).click()
  const errors = banner.getByRole('checkbox', { name: /Izvještaji o greškama/ })
  await expect(errors).not.toBeChecked()
  await errors.focus()
  await page.keyboard.press('Space')
  await expect(errors).toBeChecked()
  await expect(banner.getByRole('checkbox', { name: /Neophodno/ })).toBeDisabled()
  await page.keyboard.press('Space')

  await banner.getByRole('button', { name: 'Samo neophodno', exact: true }).click()
  await expect(banner).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('dialog', { name: 'Kolačići i memorija preglednika' })).toHaveCount(0)
  expect(JSON.parse(await page.evaluate(() => localStorage.getItem('zadatak-consent'))).errors).toBe(false)

  // the cookie policy page reopens the settings
  await page.goto('/kolacici')
  await page.getByRole('button', { name: 'Promijeni svoj izbor' }).click()
  await expect(banner).toBeVisible()
  await banner.getByRole('checkbox', { name: /Izvještaji o greškama/ }).check()
  await banner.getByRole('button', { name: 'Sačuvaj izbor' }).click()
  await expect(banner).toHaveCount(0)
  expect(JSON.parse(await page.evaluate(() => localStorage.getItem('zadatak-consent'))).errors).toBe(true)

  await context.close()
})
