#!/usr/bin/env node
// Zadatak test robot: opens the site like a person would, on a desktop, a phone, a small phone and
// inside the Android app, as a guest, a new account, a client, a worker and an admin. On every
// screen it follows the links, presses the buttons, and writes down whatever goes wrong:
// JavaScript crashes, console errors, failed requests, error screens, pages that scroll sideways,
// "undefined"/"NaN" shown to people, broken images, dead links and buttons that do nothing.
//
//   ROBOT_BASE_URL=http://localhost:4175 node robot/explore.mjs
//
// Options (env): ROBOT_PROFILES=desktop,phone,small,app  ROBOT_ROLES=guest,newbie,client,provider,admin
//   ROBOT_MAX_PAGES=45 (per profile and role)  ROBOT_CLICKS=1 (0 = only look, don't press)  ROBOT_FORMS=1 (fill forms with odd input)
//   ROBOT_PARALLEL=4  ROBOT_OUT=robot-report  ROBOT_CHROMIUM=/path/to/chrome  ROBOT_FAIL_ON=error|warn|never
// Report: robot-report/report.md (+ report.json and screenshots).
import { chromium, devices } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { ACCOUNTS } from './accounts.mjs'
import { pageChecks, clickables } from './checks.mjs'
import { PROFILES, appShellStub } from './profiles.mjs'

const BASE = (process.env.ROBOT_BASE_URL || 'http://localhost:4175').replace(/\/+$/, '')
const BASE_PATH = new URL(BASE).pathname.replace(/\/+$/, '')
const ORIGIN = new URL(BASE).origin
const OUT = path.resolve(process.env.ROBOT_OUT || 'robot-report')
const PROFILE_NAMES = (process.env.ROBOT_PROFILES || 'desktop,phone,small,app').split(',').map((s) => s.trim()).filter(Boolean)
const ROLE_NAMES = (process.env.ROBOT_ROLES || 'guest,newbie,client,provider,admin').split(',').map((s) => s.trim()).filter(Boolean)
const MAX_PAGES = Number(process.env.ROBOT_MAX_PAGES || 45)
const CLICKS = process.env.ROBOT_CLICKS !== '0'
const FORMS = process.env.ROBOT_FORMS !== '0'
const FAIL_ON = process.env.ROBOT_FAIL_ON || 'error'
const PARALLEL = Number(process.env.ROBOT_PARALLEL || 4)
const SLOW_MS = Number(process.env.ROBOT_SLOW_MS || 6000)

// Requests the sandbox or CI can't reach, or that are expected to fail; not the site's fault.
const IGNORE_URL = /openfreemap|tiles\.|basemaps|fonts\.(googleapis|gstatic)|challenges\.cloudflare|turnstile|google-analytics|googletagmanager|sentry|\/favicon|\.well-known|web-push|fcm\.googleapis|nominatim/i
const IGNORE_CONSOLE = [
  // network errors are reported from the request itself; a fetch cut off by leaving the page also logs "Failed to fetch"
  /openfreemap|maplibre|tiles|Failed to load resource|Failed to fetch(?! dynamically)/i,
  /Download the React DevTools/i,
  /turnstile|challenges\.cloudflare/i,
  /\[vite\]|service ?worker/i,
  /WebSocket connection to .*realtime.* failed/i,
]
// Buttons a curious person may press, but the robot must not: they sign out, delete, suspend or move money.
const DANGER = /odjav|log ?out|obriši|obrisi|izbriši|izbrisi|briši|ukloni|suspend|blokir|zabran|deaktiv|trajno|ugasi|povuci|otkaž|otkaz|odbij|isplat|oduzmi|ulog|oslobodi|prihvati i|plati|uplati|osiguraj|resetuj|zatvori nalog|zatvori račun|prijavi (korisnika|oglas|ovaj)|delete|remove|ban\b|proslijedi|dodijeli|odobri|potvrdi identitet|pošalji na provjeru|pošalji zahtjev|izbaci/i
// Chrome of the site, pressed once per profile and role instead of on every page.
const seenClicks = new Map()
const TRACE = process.env.ROBOT_TRACE ? (...a) => console.log(new Date().toISOString().slice(11, 19), ...a) : () => {}

const PUBLIC_ROUTES = ['/', '/search', '/kako-radi', '/cijene', '/o-nama', '/zaradi', '/pomoc', '/vodici', '/za-biznis', '/kontakt', '/pravila',
  '/pravila-zajednice', '/principi-izvodjaca', '/privatnost', '/nivoi', '/login', '/register', '/forgot-password', '/objavi', '/start', '/intro',
  '/robot-nepostojeca-stranica']
const ACCOUNT_ROUTES = ['/account', '/messages', '/moji-poslovi', '/objavi', '/account/ploca', '/account/placanja', '/account/nacini-placanja', '/account/novcanik',
  '/account/obavijesti', '/account/profil', '/account/vjestine', '/account/znacke', '/account/portfolio', '/account/verifikacija', '/account/postavke',
  '/account/alarmi', '/account/informacije', '/account/placanje', '/account/postavke-obavijesti']
const ADMIN_TABS = ['oversight', 'users', 'support', 'moderation', 'identity', 'reports', 'messages', 'verification', 'listings', 'badges', 'wallet', 'team', 'registry']
const ROLES = {
  guest: { login: null, routes: PUBLIC_ROUTES },
  newbie: { login: 'newbie', routes: ['/', ...ACCOUNT_ROUTES.slice(0, 4), '/account/verifikacija', '/start', '/intro'] },
  client: { login: 'client', routes: ['/', '/search', ...ACCOUNT_ROUTES] },
  provider: { login: 'provider', routes: ['/', '/search', ...ACCOUNT_ROUTES], mode: 'tasker' },
  admin: { login: 'admin', routes: ['/', ...ADMIN_TABS.map((t) => `/admin?tab=${t}`), '/mod', '/account'] },
}

const findings = new Map()
const PROFILES_BY_RUN = new Map()
const stats = { pages: 0, clicks: 0, started: Date.now(), perRun: [] }

const url = (p) => (p.startsWith('http') ? p : `${BASE}${p.startsWith('/') ? '' : '/'}${p}`)
const appPath = (full) => {
  const u = new URL(full)
  let p = u.pathname
  if (BASE_PATH && p.startsWith(BASE_PATH)) p = p.slice(BASE_PATH.length) || '/'
  return p + u.search
}
/** Same kind of page → same pattern, so the robot doesn't open 200 job pages. */
const pattern = (p) => {
  const u = new URL(p, 'http://x')
  const keep = ['tab', 'step', 'edit', 'za', 'published']
  const params = [...u.searchParams.keys()].sort().map((k) => (keep.includes(k) ? `${k}=${/^[0-9a-f-]{36}$/i.test(u.searchParams.get(k)) ? ':id' : u.searchParams.get(k)}` : `${k}=*`))
  return u.pathname.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id').replace(/\/\d+(?=\/|$)/g, '/:n') + (params.length ? `?${params.join('&')}` : '')
}

function record(run, where, f) {
  const key = `${f.kind}|${where}|${f.message}|${(f.detail || '').slice(0, 160)}`
  let item = findings.get(key)
  if (!item) {
    item = { ...f, where, runs: new Set(), examples: [], count: 0 }
    findings.set(key, item)
  }
  item.count += 1
  item.runs.add(run)
  if (item.examples.length < 3 && f.url && !item.examples.includes(f.url)) item.examples.push(f.url)
  if (f.shot && !item.shot) item.shot = f.shot
}

async function settle(page) {
  await page.waitForLoadState('domcontentloaded').catch(() => {})
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
  // lazy routes show a skeleton first; give them a moment to be replaced
  await page.waitForFunction(() => document.querySelectorAll('[class*="skeleton" i]').length <= 2, null, { timeout: 5000 }).catch(() => {})
  await page.waitForTimeout(250)
}

async function login(browser, who) {
  TRACE('login', who)
  const context = await browser.newContext({ ...devices['Desktop Chrome'], locale: 'bs-BA' })
  const page = await context.newPage()
  const { email, password } = ACCOUNTS[who]
  await page.goto(url('/login'))
  await page.getByLabel('Email adresa').fill(email)
  await page.getByLabel('Lozinka', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Nastavi' }).click()
  await page.waitForURL((u) => !u.pathname.endsWith('/login'), { timeout: 25_000 })
  await settle(page)
  const state = await context.storageState()
  await context.close()
  return state
}

function watch(page, run, current) {
  const net = { requests: 0, fileChoosers: 0, dialogs: 0 }
  page.on('dialog', (d) => {
    net.dialogs += 1
    // the robot types <img onerror=alert(1)> and <script>alert(1)</script> into forms: an alert means it ran
    if (d.message() === '1') push({ kind: 'xss', severity: 'error', message: 'Text typed by a person ran as code on the page (cross-site scripting)' })
  })
  page.on('filechooser', () => { net.fileChoosers += 1 })
  const push = (f) => record(run, pattern(current.path), { ...f, url: current.path })
  page.on('request', () => { net.requests += 1 })
  page.on('pageerror', (err) => push({ kind: 'js-exception', severity: 'error', message: `JavaScript crash: ${String(err.message).split('\n')[0].slice(0, 200)}`, detail: (err.stack || '').split('\n').slice(1, 3).join(' ').trim() }))
  page.on('console', (msg) => {
    if (msg.type() !== 'error' && msg.type() !== 'warning') return
    const text = msg.text()
    if (IGNORE_CONSOLE.some((re) => re.test(text))) return
    if (msg.type() === 'warning' && !/React|key|deprecated|act\(|Each child/i.test(text)) return
    push({ kind: msg.type() === 'error' ? 'console-error' : 'console-warning', severity: msg.type() === 'error' ? 'error' : 'warn', message: `Console ${msg.type()}: ${text.split('\n')[0].slice(0, 220)}` })
  })
  page.on('response', async (res) => {
    const u = res.url()
    if (res.status() < 400 || IGNORE_URL.test(u)) return
    const ours = u.startsWith(ORIGIN) || /\/(rest|auth|storage|functions|realtime)\/v1\//.test(u)
    if (!ours) return
    let body = ''
    try { body = (await res.text()).slice(0, 200) } catch { /* body gone */ }
    const where = new URL(u)
    const endpoint = where.pathname.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/gi, ':id')
    // edge functions don't run in the local test database; the live site has them
    if (/\/functions\/v1\//.test(endpoint) && /name resolution failed|not found|no such function/i.test(body)) return
    const expected = res.status() === 401 && /\/auth\/v1\/(user|token)/.test(endpoint) && run.includes('guest')
    if (expected) return
    push({ kind: 'http', severity: res.status() >= 500 || res.status() === 404 ? 'error' : 'warn', message: `${res.request().method()} ${endpoint} → ${res.status()}`, detail: body })
  })
  page.on('requestfailed', (req) => {
    const u = req.url()
    const err = req.failure()?.errorText || ''
    if (IGNORE_URL.test(u) || /ERR_ABORTED|NS_BINDING_ABORTED/.test(err)) return
    if (!(u.startsWith(ORIGIN) || /\/(rest|auth|storage|functions)\/v1\//.test(u))) return
    push({ kind: 'request-failed', severity: 'error', message: `Request failed: ${new URL(u).pathname} (${err})` })
  })
  return net
}

async function shot(page, run, p) {
  const file = `shots/${run}-${pattern(p).replace(/[^a-z0-9]+/gi, '_').slice(0, 60) || 'home'}.png`
  const full = path.join(OUT, file)
  if (!fs.existsSync(full)) await page.screenshot({ path: full }).catch(() => {})
  return file
}

async function inspect(page, run, current, profile) {
  const list = await page.evaluate(pageChecks, { phone: profile.phone }).catch((e) => [{ kind: 'robot', severity: 'warn', message: `Checks failed: ${e.message.slice(0, 120)}` }])
  let file = null
  for (const f of list) {
    if (f.severity === 'error' && !file) file = await shot(page, run, current.path)
    record(run, pattern(current.path), { ...f, url: current.path, shot: f.severity === 'error' ? file : undefined })
  }
}

/** Runs in every page before the site's own code: records layout shifts and the largest paint (Web Vitals). */
function vitalsRecorder() {
  const v = { cls: 0, lcp: 0, lcpEl: '', shifts: [] }
  window.__robotVitals = v
  const name = (n) => {
    if (!n || n.nodeType !== 1) return ''
    const cls = typeof n.className === 'string' && n.className.trim() ? `.${n.className.trim().split(/\s+/).slice(0, 2).join('.')}` : ''
    return `${n.tagName.toLowerCase()}${cls}`
  }
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (e.hadRecentInput) continue // shifts right after a tap or key are expected
        v.cls += e.value
        if (e.value >= 0.02) v.shifts.push({ value: Math.round(e.value * 1000) / 1000, at: Math.round(e.startTime), nodes: (e.sources || []).map((s) => name(s.node)).filter(Boolean).slice(0, 3) })
      }
    }).observe({ type: 'layout-shift', buffered: true })
    new PerformanceObserver((list) => {
      const last = list.getEntries().at(-1)
      if (last) { v.lcp = Math.round(last.startTime); v.lcpEl = name(last.element) }
    }).observe({ type: 'largest-contentful-paint', buffered: true })
  } catch { /* browser without these entry types */ }
}

async function vitals(page, run, current) {
  const v = await page.evaluate(() => window.__robotVitals).catch(() => null)
  if (!v) return
  const pat = pattern(current.path)
  if (v.cls > 0.1) {
    const worst = [...v.shifts].sort((a, b) => b.value - a.value).slice(0, 3).map((s) => `${s.value} at ${s.at} ms: ${s.nodes.join(', ') || '?'}`).join('; ')
    record(run, pat, { kind: 'layout-shift', severity: v.cls > 0.25 ? 'error' : 'warn', message: `Page jumps while loading (layout shift ${v.cls.toFixed(2)}, good is under 0.1): taps can land on the wrong thing`, detail: worst, url: current.path })
  }
  if (v.lcp > 2500) record(run, pat, { kind: 'slow-paint', severity: v.lcp > 4000 ? 'error' : 'warn', message: `Main content appeared after ${(v.lcp / 1000).toFixed(1)} s (good is under 2.5 s)`, detail: v.lcpEl, url: current.path })
}

/** Runs in the page: counts DOM changes so the robot can tell whether a press did anything. */
function observeMutations() {
  window.__robotMut = 0
  window.__robotObs?.disconnect()
  window.__robotObs = new MutationObserver((m) => { window.__robotMut += m.length })
  window.__robotObs.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true })
}

async function pressButtons(page, run, current, net, profile) {
  const items = await page.evaluate(clickables).catch(() => [])
  let pressed = 0
  for (const item of items) {
    if (item.tag === 'a' && item.href && !item.href.startsWith('#')) continue // links are followed as pages
    const label = item.text || '(bez teksta)'
    if (DANGER.test(label)) continue
    const onceKey = `${run}|${label}|${item.tag}`
    const seenOn = seenClicks.get(onceKey)
    if (seenOn && seenOn !== pattern(current.path)) continue // the same header button on another page
    seenClicks.set(onceKey, pattern(current.path))
    if (pressed >= 30) break
    pressed += 1
    stats.clicks += 1
    const before = page.url()
    await page.evaluate(observeMutations).catch(() => {})
    const reqBefore = net.requests
    const choosersBefore = net.fileChoosers + net.dialogs
    const pagesBefore = page.context().pages().length
    TRACE(run, current.path, 'press', label)
    const target = () => page.locator(`[data-robot-id="${item.id}"]`).first()
    let failure = null
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await target().click({ timeout: 3000 })
        failure = null
        break
      } catch (e) {
        failure = e.message || ''
        if (attempt === 0 && /intercepts pointer events|outside of the viewport/.test(failure)) {
          // maybe something the robot opened earlier is still on top: start the page fresh and try again
          await page.goto(url(current.path)).catch(() => {})
          await settle(page)
          await page.evaluate(clickables).catch(() => [])
          await page.evaluate(observeMutations).catch(() => {})
          if (!(await target().count())) { failure = null; break }
          continue
        }
        break
      }
    }
    if (failure !== null) {
      const msg = failure || ''
      if (/intercepts pointer events/.test(msg)) {
        const cover = (msg.match(/<([a-z]+)[^>]*class="([^"]*)"[^>]*>.*?intercepts/s) || []).slice(1).join('.')
        record(run, pattern(current.path), { kind: 'covered', severity: 'error', message: `Button "${label}" can't be pressed: something is on top of it`, detail: cover.slice(0, 120), url: current.path, shot: await shot(page, run, current.path) })
      } else if (/outside of the viewport/.test(msg)) {
        record(run, pattern(current.path), { kind: 'offscreen', severity: 'error', message: `Button "${label}" is outside the screen and can't be reached`, url: current.path, shot: await shot(page, run, current.path) })
      }
      continue
    }
    await page.waitForTimeout(700)
    TRACE('  clicked')
    const extra = page.context().pages().slice(pagesBefore)
    const opened = extra.length > 0
    for (const other of extra) await other.close().catch(() => {})
    const mut = await page.evaluate(() => (window.__robotMut === undefined ? 1 : window.__robotMut)).catch(() => 1)
    const moved = page.url() !== before
    TRACE('  mut', mut, 'moved', moved)
    if (!moved && !opened && mut === 0 && net.requests === reqBefore && net.fileChoosers + net.dialogs === choosersBefore && !item.active && !item.inForm && item.type !== 'submit') {
      record(run, pattern(current.path), { kind: 'dead-button', severity: 'warn', message: `Button "${label}" does nothing when pressed`, url: current.path })
    }
    const errorScreen = await page.getByText(/Došlo je do greške|Ova stranica se nije mogla učitati/).first().isVisible().catch(() => false)
    if (errorScreen) record(run, pattern(current.path), { kind: 'crash-screen', severity: 'error', message: `Pressing "${label}" shows the error screen`, url: current.path, shot: await shot(page, run, current.path + '-click') })
    if (moved) {
      // a button that navigates is fine; if it lands on the 404 page that's a dead end
      if (/\/404$/.test(new URL(page.url()).pathname)) record(run, pattern(current.path), { kind: 'dead-link', severity: 'error', message: `Button "${label}" leads to "page not found"`, url: current.path })
      current.discovered.add(appPath(page.url()))
    }
    if (moved || opened || mut > 0) {
      // reset: close whatever opened (sheets, menus, dialogs), or reload when that isn't enough
      await page.keyboard.press('Escape').catch(() => {})
      TRACE('  escaped')
      if (moved || (await page.locator('[role="dialog"], .modal, .sheet, [aria-modal="true"]').count().catch(() => 0)) > 0) {
        await page.goto(url(current.path)).catch(() => {})
        await settle(page)
        // the fresh page lost the robot's marks: put them back, or every later press on this page times out unseen
        await page.evaluate(clickables).catch(() => [])
      }
    }
  }
}


const TRICKY = {
  text: 'Robot <b>test</b> "navodnici" ćčžšđ ĆČŽŠĐ 😀 <img src=x onerror=alert(1)>',
  textarea: 'Robot test: <script>alert(1)</script> ' + 'Dugačak tekst sa ćčžšđ i emoji 😀. '.repeat(120),
  email: 'robot@test',
  number: '-1',
  tel: '000',
  url: 'javascript:alert(1)',
  date: '2020-01-01',
  search: '%\' OR 1=1 --',
}
const SKIP_FORMS = /\/(login|register|forgot-password|reset-password)/

/** Fills every form on the page with awkward input (emoji, HTML, negative numbers, very long text,
 *  past dates) and submits it, like a careless or malicious person would. */
async function fillForms(page, run, current, net) {
  if (SKIP_FORMS.test(current.path)) return
  const count = await page.locator('form').count().catch(() => 0)
  for (let i = 0; i < Math.min(count, 3); i += 1) {
    const form = page.locator('form').nth(i)
    if (!(await form.isVisible().catch(() => false))) continue
    if (await form.locator('input[type=password], input[type=file][required]').count()) continue
    const submit = form.locator('button[type=submit], button:not([type]), input[type=submit]').last()
    const label = ((await submit.textContent({ timeout: 1000 }).catch(() => '')) || '').trim()
    if (!label || DANGER.test(label)) continue
    const key = `${run}|form|${pattern(current.path)}|${label}`
    if (seenClicks.has(key)) continue
    seenClicks.set(key, true)
    TRACE(run, current.path, 'form', label)
    const fields = form.locator('input:not([type=hidden]):not([type=file]):not([type=submit]):not([type=button]), textarea, select')
    const n = await fields.count()
    for (let f = 0; f < n; f += 1) {
      const field = fields.nth(f)
      if (!(await field.isVisible().catch(() => false)) || !(await field.isEnabled().catch(() => false))) continue
      const tag = await field.evaluate((el) => el.tagName.toLowerCase()).catch(() => 'input')
      const type = tag === 'input' ? ((await field.getAttribute('type')) || 'text') : tag
      try {
        if (type === 'checkbox' || type === 'radio') await field.check({ timeout: 1000 })
        else if (tag === 'select') {
          const values = await field.evaluate((el) => [...el.options].map((o) => o.value).filter(Boolean))
          if (values.length) await field.selectOption(values[values.length - 1], { timeout: 1000 })
        } else await field.fill(TRICKY[type] ?? TRICKY.text, { timeout: 1500 })
      } catch { /* read-only or custom widget */ }
    }
    await page.evaluate(observeMutations).catch(() => {})
    const reqBefore = net.requests
    if (!(await submit.click({ timeout: 3000 }).then(() => true, () => false))) continue
    await page.waitForTimeout(1500)
    await settle(page)
    const mut = await page.evaluate(() => (window.__robotMut === undefined ? 1 : window.__robotMut)).catch(() => 1)
    if (mut === 0 && net.requests === reqBefore) {
      record(run, pattern(current.path), { kind: 'silent-form', severity: 'warn', message: `Form "${label}" gives no answer when sent with odd input`, url: current.path })
    }
    await inspect(page, run, { ...current, path: current.path }, PROFILES_BY_RUN.get(run))
    await page.goto(url(current.path)).catch(() => {})
    await settle(page)
  }
}

async function crawl(browser, profileName, roleName, state) {
  const profile = PROFILES[profileName]
  const role = ROLES[roleName]
  const run = `${profileName}-${roleName}`
  PROFILES_BY_RUN.set(run, profile)
  const context = await browser.newContext({ ...profile.context, locale: 'bs-BA', storageState: state || undefined, serviceWorkers: 'block' })
  await context.addInitScript(vitalsRecorder)
  if (profileName === 'app') await context.addInitScript(appShellStub)
  if (role.mode) await context.addInitScript((m) => { try { localStorage.setItem('zadatak-mode', m) } catch { /* private mode */ } }, role.mode)
  // grant clipboard so "copy link" buttons work like on a real device
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: ORIGIN }).catch(() => {})
  const page = await context.newPage()
  page.on('dialog', (d) => d.dismiss().catch(() => {}))
  const current = { path: '/', discovered: new Set() }
  const net = watch(page, run, current)

  const queue = [...role.routes]
  const visitedPatterns = new Map()
  let visits = 0
  const t0 = Date.now()
  while (queue.length && visits < MAX_PAGES) {
    const next = queue.shift()
    const pat = pattern(next)
    if ((visitedPatterns.get(pat) || 0) >= (pat.includes(':id') ? 2 : 1)) continue
    visitedPatterns.set(pat, (visitedPatterns.get(pat) || 0) + 1)
    visits += 1
    stats.pages += 1
    current.path = next
    current.discovered = new Set()
    const started = Date.now()
    TRACE(run, 'open', next)
    try {
      // ERR_ABORTED: the previous page redirected at the same moment; one retry settles it
      const res = await page.goto(url(next), { timeout: 30_000 }).catch((e) => (/ERR_ABORTED/.test(e.message) ? page.goto(url(next), { timeout: 30_000 }) : Promise.reject(e)))
      if (res && res.status() >= 400 && !next.includes('nepostojeca')) record(run, pat, { kind: 'http', severity: 'error', message: `Page answered ${res.status()}`, url: next })
    } catch (e) {
      record(run, pat, { kind: 'navigation', severity: 'error', message: `Page did not open: ${e.message.split('\n')[0]}`, url: next })
      continue
    }
    await settle(page)
    const took = Date.now() - started
    if (took > SLOW_MS) record(run, pat, { kind: 'slow', severity: 'warn', message: `Page took ${(took / 1000).toFixed(1)} s to settle`, url: next })
    const landed = appPath(page.url())
    if (/\/404$/.test(landed.split('?')[0]) && !next.includes('nepostojeca') && next !== '/404') {
      record(run, pat, { kind: 'dead-link', severity: 'error', message: 'Link leads to "page not found"', url: next, detail: current.from ? `linked from ${current.from}` : '' })
    }
    await inspect(page, run, current, profile)
    await vitals(page, run, current)
    // follow the links on the page
    const links = await page.$$eval('a[href]', (as) => as.map((a) => a.href)).catch(() => [])
    for (const href of links) {
      if (!href.startsWith(ORIGIN)) continue
      const p = appPath(href.split('#')[0])
      if (BASE_PATH && !new URL(href).pathname.startsWith(BASE_PATH)) continue
      if (/\.(pdf|png|jpe?g|svg|apk|zip)$/i.test(p) || /\/dev\//.test(p)) continue
      if (!queue.includes(p)) queue.push(p)
    }
    if (CLICKS) await pressButtons(page, run, current, net, profile)
    if (CLICKS && FORMS) await fillForms(page, run, current, net)
    for (const p of current.discovered) if (!queue.includes(p)) queue.push(p)
  }
  stats.perRun.push({ run, pages: visits, seconds: Math.round((Date.now() - t0) / 1000) })
  console.log(`robot: ${run}: ${visits} pages in ${Math.round((Date.now() - t0) / 1000)} s`)
  await context.close()
}

function writeReport() {
  const items = [...findings.values()].map((f) => ({ ...f, runs: [...f.runs].sort() }))
  const order = { error: 0, warn: 1 }
  items.sort((a, b) => order[a.severity] - order[b.severity] || b.runs.length - a.runs.length || a.kind.localeCompare(b.kind))
  const errors = items.filter((f) => f.severity === 'error')
  const warns = items.filter((f) => f.severity === 'warn')
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ base: BASE, stats, findings: items }, null, 2))
  const lines = [
    '# Zadatak robot report',
    '',
    `Site: ${BASE}  ·  ${stats.pages} pages and ${stats.clicks} button presses in ${Math.round((Date.now() - stats.started) / 1000)} s  ·  profiles: ${PROFILE_NAMES.join(', ')}  ·  roles: ${ROLE_NAMES.join(', ')}`,
    '',
    `**${errors.length} problems** and ${warns.length} warnings.`,
    '',
  ]
  const section = (title, list) => {
    if (!list.length) return
    lines.push(`## ${title}`, '')
    for (const f of list) {
      lines.push(`- **${f.message}** — \`${f.where}\` (${f.kind}; ${f.runs.length > 6 ? `${f.runs.length} profile/role runs` : f.runs.join(', ')})`)
      if (f.detail) lines.push(`  - ${String(f.detail).replace(/\s+/g, ' ').slice(0, 300)}`)
      if (f.shot) lines.push(`  - screenshot: ${f.shot}`)
    }
    lines.push('')
  }
  section('Problems', errors)
  section('Warnings', warns)
  fs.writeFileSync(path.join(OUT, 'report.md'), lines.join('\n'))
  return { errors, warns }
}

async function main() {
  fs.rmSync(OUT, { recursive: true, force: true })
  fs.mkdirSync(path.join(OUT, 'shots'), { recursive: true })
  const browser = await chromium.launch({ executablePath: process.env.ROBOT_CHROMIUM || undefined })
  const states = {}
  for (const role of ROLE_NAMES) {
    const who = ROLES[role]?.login
    if (!who) continue
    try {
      states[role] = await login(browser, who)
    } catch (e) {
      record(`login-${role}`, '/login', { kind: 'login', severity: 'error', message: `Could not sign in as ${role}: ${e.message.split('\n')[0]}`, url: '/login' })
    }
  }
  // every screen × role combination is its own browser context; run a few side by side
  const jobs = []
  for (const profile of PROFILE_NAMES) for (const role of ROLE_NAMES) if (!ROLES[role].login || states[role]) jobs.push([profile, role])
  const worker = async () => {
    for (let job = jobs.shift(); job; job = jobs.shift()) {
      const [profile, role] = job
      try {
        await crawl(browser, profile, role, states[role])
      } catch (e) {
        record(`${profile}-${role}`, '*', { kind: 'robot', severity: 'error', message: `Robot run stopped: ${e.message.split('\n')[0]}` })
      }
      writeReport()
    }
  }
  await Promise.all(Array.from({ length: PARALLEL }, worker))
  await browser.close()
  const { errors, warns } = writeReport()
  console.log(`robot: ${errors.length} problems, ${warns.length} warnings → ${path.join(OUT, 'report.md')}`)
  if ((FAIL_ON === 'error' && errors.length) || (FAIL_ON === 'warn' && (errors.length || warns.length))) process.exitCode = 1
}

main().catch((e) => {
  console.error(e)
  process.exit(2)
})
