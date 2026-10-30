// After `vite build`: every public page gets its own copy of the app shell (dist/<page>.html) with its
// own title, description and share preview (Open Graph). GitHub Pages and Cloudflare Pages serve
// /kako-radi from kako-radi.html with status 200, so Google indexes the page (the SPA fallback answers
// 404 on GitHub Pages) and WhatsApp / Viber / Facebook show the page's title and picture. The app
// itself starts exactly as from index.html.
import { readFileSync, writeFileSync } from 'node:fs'
import { SITE_PAGES } from '../src/data/siteMap.js'

const BRAND = process.env.VITE_APP_NAME || 'Zadatak'
const base = (process.env.VITE_BASE || '/').replace(/\/+$/, '')
// where the site lives (absolute URLs for previews and the canonical link): SITE_URL, else the sitemap's
const sitemap = readFileSync('public/sitemap.xml', 'utf8')
// (the sitemap's only when this build is for that same path: a build for another host gets no absolute links)
const fromSitemap = (sitemap.match(/<loc>([^<]+)<\/loc>/)?.[1] || '').replace(/\/+$/, '')
const sameBase = (() => { try { return new URL(fromSitemap).pathname.replace(/\/+$/, '') === base } catch { return false } })()
const siteUrl = (process.env.SITE_URL || (sameBase ? fromSitemap : '')).replace(/\/+$/, '')

const HOME = {
  path: '/',
  title: `${BRAND} · Objavi posao, izaberi najboljeg. Riješeno.`,
  description: 'Objavi posao besplatno i primi ponude provjerenih majstora i izvođača u svom gradu, širom Bosne i Hercegovine.',
}
// the info pages from the site map, plus the job search (it lists real jobs to anyone)
const PAGES = SITE_PAGES
  .filter((page) => !page.app || page.path === '/search')
  .map((page) => ({ path: page.path, title: `${page.title} · ${BRAND}`, description: page.short }))

const escape = (text) => String(text).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

function withMeta(html, page) {
  const url = `${siteUrl}${page.path === '/' ? '/' : page.path}`
  const tags = [
    `<meta name="description" content="${escape(page.description)}" />`,
    siteUrl && `<link rel="canonical" href="${url}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${escape(BRAND)}" />`,
    `<meta property="og:locale" content="bs_BA" />`,
    `<meta property="og:title" content="${escape(page.title)}" />`,
    `<meta property="og:description" content="${escape(page.description)}" />`,
    siteUrl && `<meta property="og:url" content="${url}" />`,
    siteUrl && `<meta property="og:image" content="${siteUrl}/og-image.png" />`,
    `<meta property="og:image:width" content="1024" />`,
    `<meta property="og:image:height" content="500" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
  ].filter(Boolean).join('\n    ')
  return html
    // running twice on the same build must not stack the tags
    .replace(/\s*<(?:meta property="og:|meta name="twitter:|link rel="canonical")[^>]*>/g, '')
    .replace(/<title>[^<]*<\/title>/, `<title>${escape(page.title)}</title>`)
    .replace(/<meta name="description"[^>]*>/, tags)
}

const shell = readFileSync('dist/index.html', 'utf8')
writeFileSync('dist/index.html', withMeta(shell, HOME))
for (const page of PAGES) writeFileSync(`dist${page.path}.html`, withMeta(shell, page))
console.log(`static pages: index + ${PAGES.length} pages with their own title and preview${base ? ` (base ${base})` : ''}`)
