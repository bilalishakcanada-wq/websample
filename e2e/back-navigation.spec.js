// "Nazad" goes exactly one step: back to the screen that was open before, and an open sheet,
// menu or map closes first instead of throwing the person out of the page. Guest only, on a phone.
import { test, expect, devices } from '@playwright/test'

const { defaultBrowserType: _browser, ...phone } = devices['Pixel 7']
test.use(phone)

const path = (page) => new URL(page.url()).pathname
// a tap during the slide between screens lands on the animation, not the page: let it finish first
const settle = (page) => expect(page.locator('html[data-nav-dir]')).toHaveCount(0)

test('Nazad vraća korak po korak kroz donje kartice', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('nav-search').click()
  await expect(page).toHaveURL(/\/search/)
  await settle(page)
  await page.getByTestId('nav-moji-poslovi').click()
  await expect(page).not.toHaveURL(/\/search/)
  await settle(page)
  await page.goBack()
  await expect.poll(() => path(page)).toBe('/search')
  await page.goBack()
  await expect.poll(() => path(page)).toBe('/')
})

test('Nazad prvo zatvara filter i mapu, pa tek onda napušta pretragu', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('nav-search').click()
  await expect(page).toHaveURL(/\/search/)
  await settle(page)

  await page.getByRole('button', { name: /Kategorija/ }).first().click()
  await expect(page.locator('.filter-popover')).toBeVisible()
  await page.goBack()
  await expect(page.locator('.filter-popover')).toHaveCount(0)
  expect(path(page)).toBe('/search')

  await page.getByRole('button', { name: 'Mapa' }).first().click()
  await expect(page.locator('.browse-layout.view-map')).toBeVisible()
  await page.goBack()
  await expect(page.locator('.browse-layout.view-list')).toBeVisible()
  expect(path(page)).toBe('/search')

  await page.goBack()
  await expect.poll(() => path(page)).toBe('/')
})
