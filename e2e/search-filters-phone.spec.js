// Search filters on a phone are bottom sheets: a tap or swipe on the dimmed page, or a swipe down
// on the sheet, closes it and never opens the job that sits underneath.
import { test, expect, devices } from '@playwright/test'

const { defaultBrowserType: _browser, ...iphone } = devices['iPhone 13']
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** A real finger: down, optional moves, held a moment, up (Playwright's own tap is instant). */
async function finger(cdp, points, hold = 150) {
  const [[x, y], ...moves] = points
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
  for (const [mx, my] of moves) {
    await sleep(16)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: mx, y: my }] })
  }
  await sleep(hold)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}
const swipe = (x, from, to, steps = 12) => Array.from({ length: steps + 1 }, (_, i) => [x, from + ((to - from) * i) / steps])

test('telefon: filteri se zatvaraju dodirom pored ili povlačenjem nadolje, bez otvaranja posla', async ({ browser, browserName }) => {
  test.skip(browserName !== 'chromium', 'touch input goes through the Chromium DevTools protocol')
  const context = await browser.newContext({ ...iphone, locale: 'bs-BA' })
  const page = await context.newPage()
  const cdp = await context.newCDPSession(page)
  await page.goto('/search')
  const sheet = page.locator('.filter-sheet')
  const open = async (menu) => {
    await page.locator(`.filter-menu[data-menu=${menu}] .filter-pill`).tap()
    await expect(sheet).toBeVisible()
    await sleep(400)
  }

  // tap on the dimmed page above the sheet
  await open('category')
  await finger(cdp, [[195, 60]])
  await expect(sheet).toHaveCount(0)
  await expect(page).toHaveURL(/\/search/)

  // swipe down on the dimmed page
  await open('price')
  await finger(cdp, swipe(195, 60, 400), 30)
  await expect(sheet).toHaveCount(0)
  await expect(page).toHaveURL(/\/search/)

  // swipe the sheet itself down by its title
  await open('category')
  const head = await page.locator('.filter-sheet-head').boundingBox()
  await finger(cdp, swipe(195, head.y + 10, head.y + 320), 30)
  await expect(sheet).toHaveCount(0)
  await expect(page).toHaveURL(/\/search/)

  // nothing on the sheet is hidden behind other overlays: every option can be tapped
  await open('other')
  await page.getByText('Još bez ponuda').tap()
  await expect(page.getByRole('checkbox', { name: 'Još bez ponuda' })).toBeChecked()
  await sheet.getByRole('button', { name: 'Zatvori' }).tap()
  await expect(sheet).toHaveCount(0)

  await context.close()
})
