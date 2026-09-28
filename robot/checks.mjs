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

  // 9. elements sticking out of the screen at the bottom that can't be reached (fixed bars covering content)
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
