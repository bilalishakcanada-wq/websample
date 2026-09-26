import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

// Deploy target decides the base path: '/' on a domain (Vercel), '/websample/' on GitHub Pages.
const base = process.env.VITE_BASE || '/'

/**
 * The app stylesheet must not block the first paint: the branded boot screen in index.html should
 * show while the CSS (and the JS) are still downloading. The link becomes a non-blocking preload
 * that turns into a stylesheet on load; main.jsx waits for it before mounting, so React never
 * paints unstyled.
 */
const asyncCss = () => ({
  name: 'poso-async-css',
  apply: 'build',
  transformIndexHtml: (html, ctx) => {
    html = html.replace(
      /<link rel="stylesheet"([^>]*?)href="([^"]+\.css)"([^>]*)>/g,
      (_, pre, href, post) => `<link rel="preload" as="style"${pre}href="${href}"${post} onload="this.onload=null;this.rel='stylesheet'"><noscript><link rel="stylesheet"${pre}href="${href}"${post}></noscript>`,
    )
    // the visitor's first screen is a lazy chunk: preloading it removes a round trip from the first paint
    const welcome = Object.values(ctx.bundle || {}).find((chunk) => chunk.type === 'chunk' && /app[\\/]Welcome\.jsx$/.test(chunk.facadeModuleId || ''))
    if (welcome) html = html.replace('</head>', `    <link rel="modulepreload" crossorigin href="${base}${welcome.fileName}">\n  </head>`)
    return html
  },
})

/**
 * First-time phone visitors get the real first screen (Welcome) straight from the HTML, with just
 * the CSS it needs inlined — no waiting for the JS bundle. scripts/prerender.mjs writes the markup
 * before the build; this plugin extracts the matching rules from the built stylesheet and injects both.
 * A tiny inline script shows it only on phones, only on the home path, only when nobody is signed in.
 */
const prerenderWelcome = () => ({
  name: 'poso-prerender',
  apply: 'build',
  enforce: 'post',
  transformIndexHtml: {
    order: 'post',
    handler(html, ctx) {
      let welcome = ''
      try { welcome = readFileSync('src/prerender/welcome.html', 'utf8') } catch { return html }
      const cssAsset = Object.values(ctx.bundle || {}).find((a) => a.type === 'asset' && /^assets\/index-.*\.css$/.test(a.fileName))
      if (!cssAsset) return html
      // generic state classes ("active") would drag in half the stylesheet: match by the screen's own prefixes
      const prefixes = [...new Set([...welcome.matchAll(/class="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/)).filter((c) => /^(wl|hero-arc|brand-mark)/.test(c)).map((c) => c.split('-')[0]))]
      const wanted = (selector) => /^(:root|html|body|\*)\s*[,{]?$/.test(selector.trim()) || /^(:root|html|body)$/.test(selector.trim()) || selector.trim() === '*' || prefixes.some((p) => new RegExp(`\\.${p}(-|\\b)`).test(selector)) || /\.hero-arc/.test(selector)
      const critical = extractCss(String(cssAsset.source), wanted)
      // the decision is made in <head> (before any paint) and applied through CSS, so neither
      // the splash nor the welcome ever flashes: html[data-boot=welcome] picks the welcome
      const decide = `<script>(function(){try{var phone=window.innerWidth<=768;var signedIn=Object.keys(localStorage).some(function(k){return k.indexOf('sb-')===0&&k.slice(-11)==='-auth-token'});var path=location.pathname.replace(/\\/+$/,'');var home=path===''||path==='${base}'.replace(/\\/+$/,'');if(phone&&!signedIn&&home)document.documentElement.setAttribute('data-boot','welcome')}catch(e){}})()</script>`
      // the pre-rendered screen is an overlay *outside* React's root: React mounts underneath and the
      // Welcome component removes it once it has painted the same thing — the first paint stays the LCP
      const boot = `${decide}<style id="critical-css">#boot-welcome{display:none;position:fixed;inset:0;z-index:5;overflow:auto}html[data-boot=welcome] #boot-welcome{display:block}html[data-boot=welcome] #boot-splash{display:none}${critical}</style>`
      html = html.replace('</head>', `    ${boot}\n  </head>`)
      return html.replace('<div id="root">', `<div id="boot-welcome" aria-hidden="true">${welcome}</div><div id="root">`)
    },
  },
})

/**
 * App.css has grown over many redesigns and still carries rules for screens that no longer exist.
 * At build time, drop every selector naming a class that appears nowhere in the source (any word in
 * src/ or index.html counts, as do dynamic prefixes like `wf-${step}` or 'tier-' + x), so the one
 * stylesheet the first paint waits for is ~10% smaller. The source files stay as they are.
 * Kept always: classes added by libraries at runtime (maplibre), :is()/:where() lists, and anything
 * inside :not(), which never makes a rule dead.
 */
const pruneUnusedCss = () => ({
  name: 'poso-prune-css',
  apply: 'build',
  enforce: 'pre',
  transform(code, id) {
    if (process.env.POSO_KEEP_CSS) return null // debug: ship the stylesheet unpruned
    if (!/src[\\/](App|index|app[\\/]app)\.css$/.test(id.split('?')[0])) return null
    const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]))
    const source = [...walk('src').filter((f) => /\.(jsx?|mjs|html)$/.test(f)), 'index.html'].map((f) => readFileSync(f, 'utf8')).join('\n')
    const words = new Set(source.match(/[A-Za-z_][\w-]*/g))
    const prefixes = [...new Set([...source.matchAll(/([A-Za-z][\w-]*-)(?:\$\{|['"`]\s*\+)/g)].map((m) => m[1])), 'maplibregl-']
    const used = (name) => words.has(name) || prefixes.some((p) => name.startsWith(p))
    const live = (selector) => /:(is|where|matches)\(/.test(selector) || [...selector.replace(/:not\([^)]*\)/g, '').matchAll(/\.([A-Za-z_][\w-]*)/g)].every((m) => used(m[1]))
    const prune = (css) => {
      let out = ''
      let i = 0
      while (i < css.length) {
        const open = css.indexOf('{', i)
        if (open === -1) { out += css.slice(i); break }
        const prelude = css.slice(i, open)
        let depth = 0
        let close = open
        for (; close < css.length; close++) { if (css[close] === '{') depth++; else if (css[close] === '}' && --depth === 0) break }
        const inner = css.slice(open + 1, close)
        i = close + 1
        const head = prelude.trim()
        if (/^@(media|supports|layer|container)/.test(head)) { const kept = prune(inner); if (kept.trim()) out += `${prelude}{${kept}}` }
        else if (head.startsWith('@')) out += `${prelude}{${inner}}`
        else { const kept = head.split(',').filter(live); if (kept.length) out += `${kept.join(',')}{${inner}}` }
      }
      return out
    }
    // before bundling, so the file name's hash reflects what actually ships
    return { code: prune(code.replace(/\/\*[\s\S]*?\*\//g, '')), map: null }
  },
})

/** Keeps the top-level rules (and the matching rules inside @media / @supports) whose selector passes `wanted`;
 *  @font-face and @keyframes blocks are kept as they are. */
function extractCss(css, wanted) {
  const kept = extractRules(css, wanted)
  // only the keyframes the kept rules actually animate with
  const names = new Set([...kept.matchAll(/animation(?:-name)?:\s*([^;}]+)/g)].flatMap((m) => m[1].split(',').map((v) => v.trim().split(/\s+/).find((t) => /^[a-zA-Z_-][\w-]*$/.test(t) && !/^(ease|linear|infinite|both|forwards|backwards|alternate|none|normal|reverse|paused|running)$/.test(t)))).filter(Boolean))
  const frames = [...css.matchAll(/@keyframes\s+([\w-]+)\s*\{/g)].filter((m) => names.has(m[1])).map((m) => { let i = m.index + m[0].length - 1; let depth = 0; const start = m.index; for (; i < css.length; i++) { if (css[i] === '{') depth++; else if (css[i] === '}') { depth--; if (depth === 0) { i++; break } } } return css.slice(start, i) })
  return kept + frames.join('')
}
function extractRules(css, wanted) {
  const out = []
  let i = 0
  const readBlock = () => { // from '{' at css[i] to its matching '}' (inclusive), returns inner text
    let depth = 0; const start = i
    for (; i < css.length; i++) { if (css[i] === '{') depth++; else if (css[i] === '}') { depth--; if (depth === 0) { i++; break } } }
    return css.slice(start + 1, i - 1)
  }
  while (i < css.length) {
    const braceAt = css.indexOf('{', i)
    if (braceAt === -1) break
    const prelude = css.slice(i, braceAt).trim()
    i = braceAt
    const inner = readBlock()
    if (!prelude) continue
    if (prelude.startsWith('@font-face')) out.push(`${prelude}{${inner}}`)
    else if (prelude.startsWith('@media') || prelude.startsWith('@supports')) { const kept = extractRules(inner, wanted); if (kept) out.push(`${prelude}{${kept}}`) }
    else if (prelude.startsWith('@')) continue
    else if (prelude.split(',').some((sel) => wanted(sel))) out.push(`${prelude}{${inner}}`)
  }
  return out.join('')
}

// https://vite.dev/config/
export default defineConfig({
  base,
  // a build id busts the persisted query cache and lets the app tell versions apart
  define: { 'import.meta.env.VITE_BUILD_ID': JSON.stringify(process.env.GITHUB_SHA?.slice(0, 7) || String(Date.now())) },
  optimizeDeps: {
    // maplibre-gl ships its own worker bundle; pre-bundling breaks it.
    exclude: ['maplibre-gl'],
  },
  // the desktop app may assign a port via PORT when 5173 is already taken
  server: { port: Number(process.env.PORT) || 5173 },
  build: {
    target: 'es2022',
    cssCodeSplit: true,
    cssMinify: 'lightningcss',
    chunkSizeWarningLimit: 600,
    rolldownOptions: {
      output: {
        // vendor code changes rarely → long-lived cache; app code changes often → small hashed chunks
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom)[\\/]/, priority: 30 },
            { name: 'query', test: /node_modules[\\/]@tanstack[\\/]/, priority: 25 },
            { name: 'supabase', test: /node_modules[\\/]@supabase[\\/]/, priority: 25 },
          ],
        },
      },
    },
  },
  plugins: [
    react(),
    pruneUnusedCss(),
    asyncCss(),
    prerenderWelcome(),
    process.env.VITE_NO_PWA ? null : VitePWA({
      registerType: 'autoUpdate',
      // registerSW.js se ubacuje kao OBIČNA skripta u <head>, bez defer — parser
      // stane na njoj i čeka mrežni krug, a odmah iza nje je pre-renderovani prvi
      // ekran. Rezultat: prvi paint kasni za cijeli round-trip. 'script-defer'
      // dodaje defer, pa parser nastavi i odmah nacrta ekran.
      injectRegister: 'script-defer',
      // custom service worker (src/sw.js): workbox precache + Web Push handlers
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // the 1 MB map chunk is fetched (and runtime-cached) only when someone opens the map
        globIgnores: ['**/TaskMap-*.js', '**/maplibre-gl-worker-*.js', '**/DesktopHome-*.js', '**/AdminPage-*.js', '**/node_modules/**'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      // lets the service worker (and push) be tested on the dev server too
      devOptions: { enabled: true, type: 'module', suppressWarnings: true },
      manifest: {
        name: 'Poso.ba — Marketplace za usluge',
        short_name: 'Poso.ba',
        description: 'Pronađite ili ponudite lokalne usluge u Bosni i Hercegovini.',
        lang: 'bs',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f6f4ee',
        theme_color: '#0d2a52',
        categories: ['business', 'productivity'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Objavi posao', url: `${base}objavi`, icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Pretraži poslove', url: `${base}search`, icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Poruke', url: `${base}messages`, icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] },
        ],
      },
    }),
  ],
})
