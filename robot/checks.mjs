// Checks that run inside the page after it settles. Each returns findings like
//   { kind, severity: 'error' | 'warn', message, detail }
// Everything here is plain DOM code: it is serialized and evaluated in the browser.

/** Runs in the page. `opts.phone` turns on the touch-size checks. */
export function pageChecks(opts) {
  const out = []
  const push = (kind, severity, message, detail) => out.push({ kind, severity, message, detail })
  const visible = (el) => {
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) return false
    const s = getComputedStyle(el)
    return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05
  }
  const describe = (el) => {
    const id = el.id ? `#${el.id}` : ''
    const cls = typeof el.className === 'string' && el.className.trim() ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}` : ''
    const text = (el.innerText || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 50)
    return `${el.tagName.toLowerCase()}${id}${cls}${text ? ` "${text}"` : ''}`
  }

  // 1. the app's error screens
  const bodyText = document.body.innerText || ''
  for (const t of ['Došlo je do greške', 'Ova stranica se nije mogla učitati']) {
    if (bodyText.includes(t)) push('crash-screen', 'error', `Error screen shown: "${t}"`)
  }

  // 2. programmer text leaking into the UI
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  const leaks = new Set()
  const LEAK = /(^|[\s(:])(undefined|NaN|null|\[object Object\]|Invalid Date|Infinity)(?=$|[\s).,:])/
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = n.textContent.trim()
    if (!text || !n.parentElement || ['SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE', 'TEXTAREA'].includes(n.parentElement.tagName)) continue
    if (LEAK.test(text) && visible(n.parentElement)) leaks.add(text.slice(0, 80))
  }
  for (const t of leaks) push('bad-text', 'error', `Placeholder value shown to people: "${t}"`)
  for (const el of document.querySelectorAll('input[placeholder], textarea[placeholder]')) {
    if (/undefined|NaN|null/.test(el.placeholder)) push('bad-text', 'error', `Placeholder value in a field: "${el.placeholder}"`)
  }

  // 2b. raw technical errors shown to people instead of a Bosnian message
  const RAW = /(violates (foreign key|check|unique|row-level)|duplicate key|PGRST\d+|JWT (expired|malformed)|TypeError|ReferenceError|Cannot read propert|is not a function|Failed to fetch|NetworkError|null value in column|permission denied for|row-level security|function [\w.]+\(.*\) does not exist|syntax error at or near|invalid input syntax|Internal Server Error|Unexpected token)/i
  for (const el of document.querySelectorAll('body *:not(script):not(style)')) {
    if (el.children.length || !visible(el)) continue
    const t = (el.textContent || '').trim()
    if (t && RAW.test(t)) { push('raw-error', 'error', `Technical error text shown to people: "${t.slice(0, 120)}"`); break }
  }

  // 3. sideways scrolling (the page is wider than the screen)
  const vw = document.documentElement.clientWidth
  const sw = document.scrollingElement.scrollWidth
  if (sw > vw + 2) {
    const wide = []
    for (const el of document.body.querySelectorAll('*')) {
      const r = el.getBoundingClientRect()
      if (r.right > vw + 2 && r.width > 0 && visible(el)) {
        // report the outermost offender only
        if (!wide.some((w) => w.contains(el))) wide.push(el)
        if (wide.length > 4) break
      }
    }
    // an element inside a horizontal scroller is fine
    const real = wide.filter((el) => {
      for (let p = el.parentElement; p; p = p.parentElement) {
        const s = getComputedStyle(p)
        if (/(auto|scroll|hidden|clip)/.test(s.overflowX) && p !== document.body && p !== document.documentElement) return false
      }
      return true
    })
    const bodyClips = /(hidden|clip)/.test(getComputedStyle(document.body).overflowX) || /(hidden|clip)/.test(getComputedStyle(document.documentElement).overflowX)
    if (real.length && !bodyClips) push('overflow', 'error', `Page scrolls sideways (${sw}px wide on a ${vw}px screen)`, real.map(describe).join(' | '))
  }

  // 4. broken images
  for (const img of document.images) {
    if (img.complete && img.naturalWidth === 0 && img.getAttribute('src') && visible(img) && img.loading !== 'lazy') {
      push('broken-image', 'error', 'Image failed to load', img.currentSrc || img.src)
    }
  }

  // 5. accessibility basics
  for (const el of document.querySelectorAll('button, a[href], [role="button"]')) {
    if (!visible(el)) continue
    const name = (el.getAttribute('aria-label') || el.innerText || el.textContent || el.title || el.querySelector('img[alt]')?.alt || el.getAttribute('aria-labelledby') || '').trim()
    if (!name) push('a11y-name', 'warn', 'Button or link without a name (screen readers say nothing)', describe(el) + ' ' + (el.outerHTML.slice(0, 120)))
  }
  for (const el of document.querySelectorAll('input:not([type=hidden]):not([type=submit]):not([type=button]), textarea, select')) {
    if (!visible(el)) continue
    const labelled = el.labels?.length || el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.title
    if (!labelled) push('a11y-label', 'warn', 'Form field without a label', describe(el) + (el.placeholder ? ` placeholder="${el.placeholder}"` : ''))
  }
  for (const img of document.querySelectorAll('img')) {
    if (visible(img) && !img.hasAttribute('alt')) push('a11y-alt', 'warn', 'Image without alt text', img.src.slice(0, 100))
  }

  // 6. tap targets on phones (Apple and Google both ask for ~44/48px; flag the really small ones)
  if (opts.phone) {
    for (const el of document.querySelectorAll('button, a[href], [role="button"], input[type=checkbox], input[type=radio]')) {
      if (!visible(el)) continue
      const r = el.getBoundingClientRect()
      const inline = el.tagName === 'A' && getComputedStyle(el).display === 'inline'
      // a checkbox inside a big label is tapped through the label
      const label = el.labels?.[0]?.getBoundingClientRect()
      if (label && label.width >= 24 && label.height >= 24) continue
      if (!inline && (r.width < 24 || r.height < 24) && r.width > 0) push('tap-target', 'warn', `Tap target only ${Math.round(r.width)}×${Math.round(r.height)}px`, describe(el))
    }
  }

  // 7. still loading
  const skeletons = [...document.querySelectorAll('[class*="skeleton" i], [aria-busy="true"]')].filter(visible)
  if (skeletons.length > 2) push('stuck-loading', 'error', `Still showing ${skeletons.length} loading placeholders after the page settled`, skeletons.slice(0, 3).map(describe).join(' | '))

  // 8. text cut off inside buttons
  for (const el of document.querySelectorAll('button, .primary-button, .ap-btn')) {
    if (!visible(el)) continue
    if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflow !== 'visible' && getComputedStyle(el).textOverflow !== 'ellipsis') {
      push('clipped-text', 'warn', 'Button text is cut off', describe(el))
    }
  }

  // 9. text too faint to read against its background (WCAG AA: 4.5:1, or 3:1 for large text)
  const rgba = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/)
    if (!m) return null
    const [r, g, b, a = 1] = m[1].split(/[\s,/]+/).filter(Boolean).map(Number)
    return [r, g, b, a]
  }
  const lum = ([r, g, b]) => {
    const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4 }
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
  }
  const over = (top, under) => [0, 1, 2].map((i) => top[i] * top[3] + under[i] * (1 - top[3])).concat(1)
  // the background behind an element; null when it is a picture or gradient (can't be judged from styles)
  const backdrop = (el) => {
    const layers = []
    for (let n = el; n; n = n.parentElement) {
      const s = getComputedStyle(n)
      if (s.backgroundImage && s.backgroundImage !== 'none') return null
      // a decorative ::before/::after layer (hero gradients, photos) sits behind the text: can't be judged
      for (const pseudo of ['::before', '::after']) {
        const ps = getComputedStyle(n, pseudo)
        if (ps.content !== 'none' && ps.position === 'absolute' && (ps.backgroundImage !== 'none' || (rgba(ps.backgroundColor)?.[3] || 0) > 0)) return null
      }
      const c = rgba(s.backgroundColor)
      if (c && c[3] > 0) { layers.push(c); if (c[3] >= 1) break }
    }
    let bg = [255, 255, 255, 1]
    for (const c of layers.reverse()) bg = over(c, bg)
    return bg
  }
  const faint = new Map()
  const textWalker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  let judged = 0
  for (let n = textWalker.nextNode(); n && judged < 600; n = textWalker.nextNode()) {
    const el = n.parentElement
    if (!el || !n.textContent.trim() || ['SCRIPT', 'STYLE', 'NOSCRIPT', 'OPTION'].includes(el.tagName)) continue
    if (el.closest('[disabled], [aria-disabled="true"], [aria-hidden="true"], .leaflet-container, .maplibregl-map')) continue
    if (!visible(el)) continue
    const s = getComputedStyle(el)
    if (Number(s.opacity) < 1 || s.textShadow !== 'none') continue
    judged += 1
    const bg = backdrop(el)
    const fg = rgba(s.color)
    if (!bg || !fg) continue
    const text = over(fg, bg)
    const [a, b] = [lum(text), lum(bg)].sort((x, y) => y - x)
    const ratio = (a + 0.05) / (b + 0.05)
    const size = parseFloat(s.fontSize)
    const large = size >= 24 || (size >= 18.66 && Number(s.fontWeight) >= 700)
    const need = large ? 3 : 4.5
    if (ratio >= need) continue
    const key = `${s.color}|${bg.join(',')}`
    if (!faint.has(key)) faint.set(key, { ratio, need, el, color: s.color, bg })
  }
  for (const f of [...faint.values()].sort((x, y) => x.ratio - y.ratio).slice(0, 6)) {
    push('contrast', f.ratio < 3 ? 'error' : 'warn', `Text hard to read: contrast ${f.ratio.toFixed(1)}:1 (needs ${f.need}:1)`, `${describe(f.el)} color ${f.color} on rgb(${f.bg.slice(0, 3).map(Math.round).join(',')})`)
  }

  return out
}

/** Runs in the page: everything a person could click, with a stable selector to find it again. */
export function clickables() {
  const visible = (el) => {
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) return false
    const s = getComputedStyle(el)
    return s.visibility !== 'hidden' && s.display !== 'none' && s.pointerEvents !== 'none'
  }
  const items = []
  const seen = new Set()
  const all = document.querySelectorAll('button, [role="button"], [role="tab"], summary, a[href]')
  all.forEach((el, index) => {
    if (!visible(el) || el.disabled || el.getAttribute('aria-disabled') === 'true') return
    const text = (el.innerText || el.getAttribute('aria-label') || el.title || '').trim().replace(/\s+/g, ' ').slice(0, 60)
    const href = el.tagName === 'A' ? el.getAttribute('href') : null
    const key = `${el.tagName}|${text}|${href || ''}`
    if (seen.has(key)) return
    seen.add(key)
    el.setAttribute('data-robot-id', String(index))
    const active = el.getAttribute('aria-pressed') === 'true' || el.getAttribute('aria-selected') === 'true' || el.getAttribute('aria-current') || /(^|\s)(active|selected|is-active|on)(\s|$)/.test(typeof el.className === 'string' ? el.className : '')
    items.push({ id: String(index), tag: el.tagName.toLowerCase(), text, href, active: Boolean(active), target: el.getAttribute('target'), type: el.getAttribute('type'), inForm: Boolean(el.closest('form')) })
  })
  return items
}

/**
 * Runs in the page: the problems a customer actually trips over, checked over the whole page
 * (it scrolls through it). Every finding carries `mark`: the element gets data-robot-mark so the
 * robot can outline it in red on the screenshot.
 *   covered       a button, link or field whose middle is under something else (a press lands on that)
 *   overlap       two buttons/fields on top of each other, or two pieces of text drawn over each other
 *   cut-off       a button, field or text sticking out past the left or right edge of the screen
 *   field-label   a field with no label at all (nobody knows what to type)
 *   field-zoom    phone: a field with text under 16px (iPhone zooms the whole page in when it is tapped)
 *   field-size    phone: a field too small to tap
 *   overlay       phone: fixed bars/banners that take a big part of the screen at once
 */
export function layoutChecks(opts) {
  const out = []
  // sections far down the page skip layout until scrolled near (content-visibility: auto), so their
  // sizes are guesses; lay everything out for real while measuring
  const force = document.createElement('style')
  force.textContent = '*, *::before, *::after { content-visibility: visible !important; scroll-behavior: auto !important }'
  document.head.appendChild(force)
  let marks = 0
  const mark = (el) => {
    if (!el.hasAttribute('data-robot-mark')) el.setAttribute('data-robot-mark', String(marks++))
    return el.getAttribute('data-robot-mark')
  }
  const push = (kind, severity, message, detail, el) => out.push({ kind, severity, message, detail, mark: el ? mark(el) : undefined })
  const vw = document.documentElement.clientWidth
  const vh = window.innerHeight
  const shown = (el) => {
    // closed <details>, content-visibility, display/visibility/opacity
    if (el.checkVisibility && !el.checkVisibility({ contentVisibilityAuto: true, opacityProperty: true, visibilityProperty: true })) return false
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      const s = getComputedStyle(n)
      if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) < 0.05) return false
      if (n.getAttribute('aria-hidden') === 'true' || n.inert) return false
    }
    const r = el.getBoundingClientRect()
    return r.width > 2 && r.height > 2
  }
  const name = (el) => (el.getAttribute('aria-label') || el.innerText || el.value || el.placeholder || el.title || el.getAttribute('alt') || '').trim().replace(/\s+/g, ' ').slice(0, 50)
  const describe = (el) => {
    const id = el.id ? `#${el.id}` : ''
    const cls = typeof el.className === 'string' && el.className.trim() ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}` : ''
    const text = name(el)
    return `${el.tagName.toLowerCase()}${id}${cls}${text ? ` "${text}"` : ''}`
  }
  const what = (el) => {
    const t = el.tagName
    if (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT') return 'Field'
    if (t === 'A') return 'Link'
    return 'Button'
  }
  // the area of the element a person can actually see, after every scroll box / clipping parent cuts it
  const clipped = (el) => {
    let r = el.getBoundingClientRect()
    let box = { left: r.left, top: r.top, right: r.right, bottom: r.bottom }
    for (let p = el.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
      const s = getComputedStyle(p)
      if (s.position === 'fixed') break
      if (/(auto|scroll|hidden|clip)/.test(s.overflowX + s.overflowY)) {
        const pr = p.getBoundingClientRect()
        box = { left: Math.max(box.left, pr.left), top: Math.max(box.top, pr.top), right: Math.min(box.right, pr.right), bottom: Math.min(box.bottom, pr.bottom) }
      }
    }
    return box.right - box.left > 2 && box.bottom - box.top > 2 ? box : null
  }
  const fixedAncestor = (el) => {
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      const p = getComputedStyle(n).position
      if (p === 'fixed' || p === 'sticky') return n
    }
    return null
  }
  const inScroller = (el) => {
    for (let p = el.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
      if (/(auto|scroll)/.test(getComputedStyle(p).overflowX)) return true
    }
    return false
  }
  // the app scrolls inside its own boxes on phones, so let the browser scroll whatever box holds it
  const scrollToEl = (el) => el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' })

  // an open dialog: only what is inside it can be reached, and that is correct
  const dialogs = [...document.querySelectorAll('[role="dialog"], [aria-modal="true"], dialog[open]')].filter(shown)
  const scope = dialogs.length ? dialogs[dialogs.length - 1] : document.body
  const CONTROL = 'button, a[href], [role="button"], [role="tab"], [role="checkbox"], [role="switch"], input:not([type=hidden]), select, textarea, summary'
  const controls = [...scope.querySelectorAll(CONTROL)]
    .filter((el) => !el.closest('.maplibregl-map, .leaflet-container, [data-robot-ignore]') && shown(el))
    .slice(0, 400)

  // 1. covered: scroll to each control and see what a press in its middle would hit
  const covers = new Map()
  for (const el of controls) {
    if (el.disabled) continue
    // checkboxes/radios/file inputs are often hidden visually and pressed through their label
    if (el.tagName === 'INPUT' && /^(checkbox|radio|file|range|color)$/.test(el.type) && el.labels?.length) continue
    if (!fixedAncestor(el)) scrollToEl(el)
    const box = clipped(el)
    if (!box) continue
    const x = (Math.max(box.left, 0) + Math.min(box.right, vw)) / 2
    const y = (Math.max(box.top, 0) + Math.min(box.bottom, vh)) / 2
    if (x <= 0 || y <= 0 || x >= vw || y >= vh) continue
    const hit = document.elementFromPoint(x, y)
    if (!hit || el === hit || el.contains(hit) || hit.contains(el)) continue
    if (el.labels && [...el.labels].some((l) => l.contains(hit))) continue
    if (hit.closest('label')?.contains(el)) continue
    // the thing on top is another control the same person asked for (e.g. a clear "x" inside a field)
    const cover = hit.closest(CONTROL) && el.parentElement?.contains(hit) ? null : hit
    if (!cover) continue
    const top = fixedAncestor(cover) || cover
    const key = describe(top)
    if (!covers.has(key)) covers.set(key, { list: [] })
    covers.get(key).list.push(el)
  }
  for (const [key, { list }] of covers) {
    const names = list.slice(0, 4).map((el) => `${what(el).toLowerCase()} "${name(el) || '?'}"`).join(', ')
    push('covered', 'error', `${list.length === 1 ? `${what(list[0])} "${name(list[0]) || '?'}" is` : `${list.length} buttons/fields are`} covered by ${key} (a press lands on that instead)`, names + (list.length > 4 ? ` and ${list.length - 4} more` : ''), list[0])
  }

  // 2. two controls drawn on top of each other
  window.scrollTo({ top: 0, behavior: 'instant' })
  const docBox = (el) => {
    const r = el.getBoundingClientRect()
    const toDoc = (q) => ({ left: q.left + window.scrollX, top: q.top + window.scrollY, right: q.right + window.scrollX, bottom: q.bottom + window.scrollY })
    // a link wrapped over two lines is two boxes, not one big rectangle over its neighbours
    return { ...toDoc(r), w: r.width, h: r.height, parts: [...el.getClientRects()].map(toDoc) }
  }
  const inter = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
  const interParts = (a, b) => {
    let sum = 0
    for (const p of a.parts.length ? a.parts : [a]) for (const q of b.parts.length ? b.parts : [b]) sum += inter(p, q)
    return sum
  }
  const flow = controls.filter((el) => !fixedAncestor(el) && !(el.tagName === 'INPUT' && /^(checkbox|radio)$/.test(el.type)))
  // only the part a person can see: chips scrolled out of a small scroll box are not "on top" of anything
  const boxes = flow.filter((el) => clipped(el)).map((el) => {
    const b = docBox(el)
    const c = clipped(el)
    const cut = { left: c.left + window.scrollX, top: c.top + window.scrollY, right: c.right + window.scrollX, bottom: c.bottom + window.scrollY }
    b.parts = b.parts.map((q) => ({ left: Math.max(q.left, cut.left), top: Math.max(q.top, cut.top), right: Math.min(q.right, cut.right), bottom: Math.min(q.bottom, cut.bottom) })).filter((q) => q.right > q.left && q.bottom > q.top)
    return { el, b: { ...b, ...cut, w: cut.right - cut.left, h: cut.bottom - cut.top } }
  })
  let overlaps = 0
  for (let i = 0; i < boxes.length && overlaps < 6; i += 1) {
    for (let j = i + 1; j < boxes.length && overlaps < 6; j += 1) {
      const a = boxes[i]; const b = boxes[j]
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue
      if (!inter(a.b, b.b)) continue
      const area = interParts(a.b, b.b)
      if (!area) continue
      const small = Math.min(a.b.w * a.b.h, b.b.w * b.b.h)
      if (area / small < 0.25) continue
      // a label wrapped around its own field, or the same link twice (image + title) is fine
      if (a.el.labels && [...a.el.labels].includes(b.el)) continue
      if (a.el.tagName === 'A' && b.el.tagName === 'A' && a.el.href === b.el.href) continue
      // a small button placed on a clickable card (save, share): fine when the button is the one on top
      const [big, small_] = a.b.w * a.b.h >= b.b.w * b.b.h ? [a, b] : [b, a]
      if (area / (small_.b.w * small_.b.h) > 0.95) {
        small_.el.scrollIntoView({ block: 'center', behavior: 'instant' })
        const r = small_.el.getBoundingClientRect()
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
        if (hit && (small_.el === hit || small_.el.contains(hit)) && big.el !== hit) continue
      }
      overlaps += 1
      push('overlap', 'error', `${what(a.el)} "${name(a.el) || '?'}" and ${what(b.el).toLowerCase()} "${name(b.el) || '?'}" are on top of each other`, `${describe(a.el)} | ${describe(b.el)}`, a.el)
    }
  }

  // 3. text drawn over other text (broken layout); per line, so wrapped paragraphs don't count
  const lines = []
  const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT)
  const range = document.createRange()
  for (let n = walker.nextNode(); n && lines.length < 3000; n = walker.nextNode()) {
    const el = n.parentElement
    if (!el || !n.textContent.trim() || ['SCRIPT', 'STYLE', 'NOSCRIPT', 'OPTION', 'TEXTAREA'].includes(el.tagName)) continue
    if (el.closest('svg, .maplibregl-map, .leaflet-container, [data-robot-ignore]') || fixedAncestor(el) || !shown(el)) continue
    range.selectNodeContents(n)
    // text cut with "…" or hidden by a parent's overflow only shows inside that parent
    const clip = clipped(el)
    if (!clip) continue
    for (const q of range.getClientRects()) {
      const r = { left: Math.max(q.left, clip.left), right: Math.min(q.right, clip.right), top: Math.max(q.top, clip.top), bottom: Math.min(q.bottom, clip.bottom) }
      if (r.right - r.left < 4 || r.bottom - r.top < 4) continue
      lines.push({ el, node: n, left: r.left + window.scrollX, right: r.right + window.scrollX, top: r.top + window.scrollY, bottom: r.bottom + window.scrollY })
    }
  }
  lines.sort((a, b) => a.top - b.top)
  const textHits = []
  for (let i = 0; i < lines.length && textHits.length < 5; i += 1) {
    const a = lines[i]
    for (let j = i + 1; j < lines.length && lines[j].top < a.bottom; j += 1) {
      const b = lines[j]
      if (a.node === b.node) continue
      const area = inter(a, b)
      if (!area) continue
      const small = Math.min((a.right - a.left) * (a.bottom - a.top), (b.right - b.left) * (b.bottom - b.top))
      if (area / small < 0.3) continue
      // both must really be seen there: one may sit under a solid card (that is covering, not overlap)
      const cx = (Math.max(a.left, b.left) + Math.min(a.right, b.right)) / 2 - window.scrollX
      const cyDoc = (Math.max(a.top, b.top) + Math.min(a.bottom, b.bottom)) / 2
      window.scrollTo({ top: Math.max(0, cyDoc - vh / 2), behavior: 'instant' })
      const hit = document.elementFromPoint(cx, cyDoc - window.scrollY)
      if (!hit || !(a.el.contains(hit) || hit.contains(a.el) || b.el.contains(hit) || hit.contains(b.el))) continue
      if (textHits.some((t) => (t.a === a.el && t.b === b.el) || (t.a === b.el && t.b === a.el))) continue
      textHits.push({ a: a.el, b: b.el })
      push('overlap', 'error', `Text drawn over other text: "${a.node.textContent.trim().slice(0, 40)}" and "${b.node.textContent.trim().slice(0, 40)}"`, `${describe(a.el)} | ${describe(b.el)}`, a.el)
      break
    }
  }
  window.scrollTo({ top: 0, behavior: 'instant' })

  // 4. sticking out past the edge of the screen (also when the page hides sideways scrolling, which hides the bug)
  const cut = []
  for (const el of controls) {
    if (inScroller(el) || fixedAncestor(el)?.getBoundingClientRect().width > vw) continue
    // what a parent with overflow: hidden cuts away is not on screen at all (tickers, carousels)
    const r = clipped(el)
    if (r && (r.right > vw + 2 || r.left < -2)) cut.push(el)
  }
  for (const { el } of lines.filter((l) => (l.right - window.scrollX > vw + 2 || l.left - window.scrollX < -2) && !inScroller(l.el)).slice(0, 40)) {
    const r = clipped(el)
    if (r && (r.right > vw + 2 || r.left < -2) && !cut.includes(el)) cut.push(el)
  }
  const outer = cut.filter((el) => !cut.some((o) => o !== el && o.contains(el)))
  for (const el of outer.slice(0, 5)) {
    const r = el.getBoundingClientRect()
    push('cut-off', 'error', `${['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(el.tagName) ? what(el) : 'Text'} "${name(el) || '?'}" is cut off at the ${r.left < -2 ? 'left' : 'right'} edge of the screen`, `${describe(el)} spans ${Math.round(r.left)}–${Math.round(r.right)}px on a ${vw}px screen`, el)
  }

  // 5. fields
  for (const el of controls) {
    if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || /^(submit|button|reset|image|file)$/.test(el.type)) continue
    const labelled = (el.labels && [...el.labels].some((l) => l.innerText.trim())) || el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.title
    if (!labelled && !el.placeholder && !(el.tagName === 'SELECT' && el.options[el.selectedIndex]?.text.trim())) {
      push('field-label', 'error', 'Field with no label or hint: people can\'t tell what to type', describe(el), el)
    }
    if (opts.phone && !/^(checkbox|radio|range|color)$/.test(el.type)) {
      const s = getComputedStyle(el)
      if (parseFloat(s.fontSize) < 16 && !el.readOnly) push('field-zoom', 'warn', `Field text is ${s.fontSize}: iPhone zooms the page in when it is tapped`, describe(el), el)
      const r = el.getBoundingClientRect()
      if (r.height < 32 && el.tagName !== 'TEXTAREA') push('field-size', 'warn', `Field only ${Math.round(r.height)}px tall, hard to tap`, describe(el), el)
    }
  }

  // 6. phone: how much of the screen fixed bars/banners take (dialogs the person opened don't count)
  if (opts.phone && !dialogs.length) {
    const bars = [...document.body.querySelectorAll('*')].filter((el) => {
      const s = getComputedStyle(el)
      return (s.position === 'fixed' || s.position === 'sticky') && shown(el)
    }).filter((el, _i, all) => !all.some((o) => o !== el && o.contains(el)))
    let area = 0
    const names = []
    for (const el of bars) {
      const r = el.getBoundingClientRect()
      const h = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0))
      const w = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0))
      if (h * w < 0.04 * vw * vh) continue
      area += h * w
      names.push(`${describe(el)} ${Math.round(h)}px`)
    }
    const share = area / (vw * vh)
    if (share > 0.35) push('overlay', share > 0.5 ? 'error' : 'warn', `Fixed bars and banners cover ${Math.round(share * 100)}% of the phone screen`, names.join(' | '))
  }

  force.remove()
  return out
}
