// Ko mora potvrditi identitet — cijeli tok kroz sučelje, sa tri strane:
//   novi klijent se registruje i objavi posao bez lične karte
//   → novi izvođač ne može poslati ponudu (ni kroz formu ni direktno u bazu)
//   → šalje ime, JMBG i sliku lične karte → admin potvrđuje → izvođač šalje ponudu.
// Svaki prolaz pravi novi nalog, novi JMBG i novu sliku dokumenta, pa se može ponavljati
// na istoj bazi (isti broj ili ista slika ne mogu biti odobreni dvaput).
// JMBG je SINTETIČKI: ispravna kontrolna cifra, ali nije ničiji pravi broj.
import { existsSync, readFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
import { test, expect } from '@playwright/test'
import { ACCOUNTS, acceptDialogs, login } from './helpers.js'

const PASSWORD = 'Test12345!'

/** Ispravan, nasumičan JMBG: rođen 1980–1999, regija Sarajevo (17). */
function sintetickiJmbg() {
  const r = (n) => Math.floor(Math.random() * n)
  const pad = (v, n) => String(v).padStart(n, '0')
  for (;;) {
    const base = `${pad(1 + r(28), 2)}${pad(1 + r(12), 2)}${pad(980 + r(20), 3)}17${pad(r(500), 3)}`
    const c = [...base].map(Number)
    const m = 11 - ((7 * (c[0] + c[6]) + 6 * (c[1] + c[7]) + 5 * (c[2] + c[8]) + 4 * (c[3] + c[9]) + 3 * (c[4] + c[10]) + 2 * (c[5] + c[11])) % 11)
    if (m === 10) continue // ne bi prošlo provjeru kontrolne cifre
    return base + (m === 11 ? 0 : m)
  }
}

/** Oštra, srednje svijetla PNG "lična karta" s nasumičnim poljima — svaki put drugi otisak. */
function slikaDokumenta(w = 900, h = 570) {
  const px = Buffer.alloc((w * 3 + 1) * h)
  const polja = Array.from({ length: 40 }, () => ({ x: Math.random() * (w - 160), y: Math.random() * (h - 30), w: 40 + Math.random() * 120, h: 8 + Math.random() * 18 }))
  for (let y = 0; y < h; y += 1) {
    px[y * (w * 3 + 1)] = 0
    for (let x = 0; x < w; x += 1) {
      const tamno = polja.some((p) => x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h)
      const v = tamno ? 50 : 180 + ((x * 7 + y * 13) % 23)
      const i = y * (w * 3 + 1) + 1 + x * 3
      px[i] = v; px[i + 1] = v; px[i + 2] = Math.min(255, v + 10)
    }
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
  const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
    const td = Buffer.concat([Buffer.from(type), data])
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td))
    return Buffer.concat([len, td, c])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(px)), chunk('IEND', Buffer.alloc(0))])
}

/** Adresa i javni ključ lokalne baze (robot/local-db/setup.sh ih upiše u .env.local). */
function lokalnaBaza() {
  if (!existsSync('.env.local')) return null
  const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split('\n').map((l) => l.split('=')).filter((p) => p.length >= 2).map(([k, ...v]) => [k.trim(), v.join('=').trim()]))
  return env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY ? { url: env.VITE_SUPABASE_URL, key: env.VITE_SUPABASE_ANON_KEY } : null
}

test.describe.serial('Klijent objavljuje bez ID-a, izvođač nudi tek poslije potvrde', () => {
  test.skip(!ACCOUNTS.admin.email || !ACCOUNTS.admin.password, 'admin nalog za E2E nije podešen (E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD)')

  const stamp = Date.now()
  const slova = String.fromCharCode(...String(stamp).slice(-6).split('').map((d) => 97 + Number(d)))
  const klijentIme = `Test Klijent ${slova}`
  const izvodjacIme = `Test Izvodjac ${slova}`
  const naslov = `[E2E] Posao bez lične karte ${stamp}`
  let listingUrl = ''
  /** @type {import('@playwright/test').BrowserContext[]} */ const ctxs = []
  /** @type {import('@playwright/test').Page} */ let klijent
  /** @type {import('@playwright/test').Page} */ let izvodjac
  /** @type {import('@playwright/test').Page} */ let admin

  test.beforeAll(async ({ browser }) => {
    const nova = async () => { const ctx = await browser.newContext(); ctxs.push(ctx); const p = await ctx.newPage(); acceptDialogs(p); return p }
    klijent = await nova()
    izvodjac = await nova()
    admin = await nova()
  })
  test.afterAll(async () => { for (const ctx of ctxs) await ctx.close() })

  async function registruj(page, { ime, email, tip, next }) {
    await page.goto(`/register?next=${encodeURIComponent(next)}`)
    await page.getByRole('button', { name: new RegExp(tip) }).click()
    if (tip === 'Pružam usluge') await page.locator('.trade-chip').first().click()
    await page.getByLabel('Ime i prezime').fill(ime)
    await page.getByLabel('Email adresa').fill(email)
    await page.getByLabel('Lozinka', { exact: true }).fill(PASSWORD)
    await page.getByLabel('Grad').fill('Sarajevo')
    await page.getByRole('button', { name: 'Nastavi' }).click()
  }

  test('novi klijent objavljuje posao bez lične karte', async () => {
    await registruj(klijent, { ime: klijentIme, email: `klijent-${stamp}@test.zadatak`, tip: 'Tražim majstora', next: '/objavi' })
    await expect(klijent).toHaveURL(/\/objavi/, { timeout: 30_000 })
    await expect(klijent.getByTestId('post-gate')).toHaveCount(0)
    await klijent.getByPlaceholder('npr. Montaža kuhinjskih elemenata').fill(naslov)
    await klijent.getByRole('button', { name: 'Fleksibilan sam' }).click()
    await klijent.getByRole('button', { name: 'Nastavi' }).click()
    await klijent.getByRole('button', { name: 'Online / na daljinu' }).click()
    await klijent.getByRole('button', { name: 'Nastavi' }).click()
    await klijent.getByRole('combobox').first().selectOption({ label: 'Ostalo' })
    await klijent.getByPlaceholder(/Opišite šta tačno treba uraditi/).fill('Automatski test: klijent objavljuje posao bez potvrde identiteta.')
    await klijent.getByRole('button', { name: 'Nastavi' }).click()
    await klijent.getByRole('button', { name: 'Nastavi' }).click() // slike nisu obavezne
    await klijent.getByPlaceholder(/Ostavite prazno/).fill('30')
    await klijent.getByRole('button', { name: 'Objavi posao' }).click()
    await expect(klijent).toHaveURL(/\/listings\/[0-9a-f-]{36}/, { timeout: 30_000 })
    listingUrl = new URL(klijent.url()).pathname
    await expect(klijent.getByRole('heading', { name: naslov })).toBeVisible()
  })

  test('novi izvođač ne može poslati ponudu bez lične karte', async () => {
    await registruj(izvodjac, { ime: izvodjacIme, email: `izvodjac-${stamp}@test.zadatak`, tip: 'Pružam usluge', next: listingUrl })
    await expect(izvodjac).toHaveURL(new RegExp(listingUrl), { timeout: 30_000 })
    const dugme = izvodjac.getByRole('button', { name: 'Potvrdi identitet za ponudu' }).first()
    await expect(dugme).toBeVisible({ timeout: 20_000 })
  })

  test('baza odbija i ponudu poslanu mimo forme', async () => {
    const baza = lokalnaBaza()
    test.skip(!baza, 'nema .env.local s lokalnom bazom')
    const token = await izvodjac.evaluate(() => {
      const k = Object.keys(localStorage).find((key) => /^sb-.*-auth-token$/.test(key))
      return k ? JSON.parse(localStorage.getItem(k)).access_token : null
    })
    expect(token).toBeTruthy()
    const res = await izvodjac.request.post(`${baza.url}/rest/v1/bids`, {
      headers: { apikey: baza.key, Authorization: `Bearer ${token}`, 'content-type': 'application/json', Prefer: 'return=minimal' },
      data: { listing_id: listingUrl.split('/').pop(), bidder_id: JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).sub, amount: 30, message: 'Pokušaj mimo forme, bez potvrđenog identiteta.' },
    })
    expect(res.status()).toBeGreaterThanOrEqual(400)
    expect(await res.text()).toContain('VERIFIKACIJA_POTREBNA')
  })

  test('izvođač šalje ličnu kartu na provjeru', async () => {
    await izvodjac.getByRole('button', { name: 'Potvrdi identitet za ponudu' }).first().click()
    await expect(izvodjac).toHaveURL(/\/account\/verifikacija\?next=/)
    await izvodjac.waitForSelector('.verif-form', { timeout: 20_000 })
    await izvodjac.getByLabel(/Ime i prezime/).fill(izvodjacIme)
    await izvodjac.getByLabel(/^JMBG/).fill(sintetickiJmbg())
    await izvodjac.locator('.verif-uploads input[type="file"]').first().setInputFiles({ name: 'licna-karta.png', mimeType: 'image/png', buffer: slikaDokumenta() })
    const posalji = izvodjac.getByRole('button', { name: /Pošalji na provjeru/ })
    await expect(posalji).toBeEnabled({ timeout: 15_000 })
    await posalji.click()
    await expect(izvodjac.locator('.verif-state.wait')).toContainText('Provjera je u toku', { timeout: 25_000 })
    await izvodjac.getByRole('link', { name: 'Nazad na posao' }).click()
    await expect(izvodjac.getByRole('button', { name: 'Identitet se provjerava' }).first()).toBeVisible({ timeout: 20_000 })
  })

  test('admin potvrđuje identitet', async () => {
    await login(admin, 'admin')
    await admin.goto('/admin?tab=identity')
    const red = admin.locator('.idv-row', { hasText: izvodjacIme })
    await expect(red).toBeVisible({ timeout: 20_000 })
    await red.getByRole('button', { name: 'Otvori podatke' }).click()
    await red.getByRole('button', { name: 'Potvrdi identitet' }).click()
    await expect(admin.getByText('Identitet potvrđen.')).toBeVisible({ timeout: 20_000 })
  })

  test('potvrđeni izvođač šalje ponudu', async () => {
    await izvodjac.reload()
    await izvodjac.getByRole('button', { name: 'Pošalji ponudu' }).first().click()
    const sheet = izvodjac.getByRole('dialog')
    await sheet.getByLabel('Tvoja ponuda (KM)').fill('30')
    await sheet.getByPlaceholder(/Napiši zašto si prava osoba/).fill('Automatski test: ponuda poslije potvrđenog identiteta.')
    await sheet.getByRole('button', { name: 'Pošalji ponudu' }).click()
    await expect(izvodjac.getByText('Ponuda je uspješno poslana.')).toBeVisible({ timeout: 20_000 })
  })
})
