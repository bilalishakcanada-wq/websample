// Renders the Poso.ba brand mark into the source PNGs that `@capacitor/assets` turns into
// iOS/Android icons + splash screens (assets/icon*.png, assets/splash*.png) and the PWA icons.
//
//   node scripts/brand-assets.mjs && npm run app:assets
//
// The mark: a "P" whose bowl is a gold badge with a navy check — "posao" + "riješeno".
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const fontsDir = resolve(root, 'assets/fonts')
// Let librsvg find the bundled Manrope (Google Fonts, OFL) without touching system fonts.
mkdirSync(fontsDir, { recursive: true })
writeFileSync(resolve(fontsDir, 'fonts.conf'), `<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><dir>${fontsDir}</dir><cachedir>/tmp/poso-fontconfig</cachedir></fontconfig>`)
process.env.FONTCONFIG_FILE = resolve(fontsDir, 'fonts.conf')

const NAVY = '#0d2a52'
const NAVY_DEEP = '#071b3a'
const NAVY_LIGHT = '#17407a'
const GOLD = '#f5b400'
const GOLD_DEEP = '#d99a00'

/** The mark itself, drawn in a 1000×1000 box centred on (500, 500). */
const mark = (scale = 1, x = 0, y = 0) => `
  <g transform="translate(${x} ${y}) scale(${scale})">
    <!-- stem -->
    <rect x="248" y="190" width="150" height="598" rx="75" fill="url(#gold)" />
    <!-- bowl / badge -->
    <circle cx="560" cy="418" r="228" fill="url(#gold)" />
    <circle cx="560" cy="418" r="150" fill="${NAVY}" />
    <!-- check -->
    <path d="M478 424 L540 486 L650 358" fill="none" stroke="${GOLD}" stroke-width="58" stroke-linecap="round" stroke-linejoin="round" />
  </g>`

const defs = `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${NAVY_LIGHT}" />
      <stop offset="0.55" stop-color="${NAVY}" />
      <stop offset="1" stop-color="${NAVY_DEEP}" />
    </linearGradient>
    <linearGradient id="gold" gradientUnits="userSpaceOnUse" x1="0" y1="190" x2="0" y2="790">
      <stop offset="0" stop-color="#ffc83d" />
      <stop offset="1" stop-color="${GOLD_DEEP}" />
    </linearGradient>
    <radialGradient id="glow" cx="0.2" cy="0.1" r="0.9">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.10" />
      <stop offset="1" stop-color="#ffffff" stop-opacity="0" />
    </radialGradient>
  </defs>`

const svg = (size, body) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${defs}${body}</svg>`)

// App icon (iOS masks the corners itself; Android gets separate adaptive layers below).
const icon = svg(1024, `
  <rect width="1024" height="1024" fill="url(#bg)" />
  <rect width="1024" height="1024" fill="url(#glow)" />
  ${mark(0.9, 46, 72)}`)

// Adaptive icon: capacitor-assets insets both layers to the visible 72dp area, so the mark is drawn large here.
const iconForeground = svg(1024, mark(1, -6, 23))
const iconBackground = svg(1024, `<rect width="1024" height="1024" fill="url(#bg)" /><rect width="1024" height="1024" fill="url(#glow)" />`)

// Splash: 2732×2732 so every device crops from the centre. Keep everything in the middle 40%.
const splash = (dark) => svg(2732, `
  <rect width="2732" height="2732" fill="${dark ? NAVY_DEEP : NAVY}" />
  <rect width="2732" height="2732" fill="url(#glow)" />
  ${mark(0.62, 1056, 890)}
  <text x="1366" y="1690" text-anchor="middle" font-family="Manrope" font-weight="800" font-size="168" fill="#ffffff" letter-spacing="-4">Poso.ba</text>
  <text x="1366" y="1790" text-anchor="middle" font-family="Manrope" font-weight="600" font-size="62" fill="#ffffff" fill-opacity="0.72">Objavi posao. Riješeno.</text>`)

const out = (name) => resolve(root, 'assets', name)
await sharp(icon).png().toFile(out('icon.png'))
await sharp(icon).png().toFile(out('icon-only.png'))
await sharp(iconForeground).png().toFile(out('icon-foreground.png'))
await sharp(iconBackground).png().toFile(out('icon-background.png'))
await sharp(splash(false)).png({ compressionLevel: 9 }).toFile(out('splash.png'))
await sharp(splash(true)).png({ compressionLevel: 9 }).toFile(out('splash-dark.png'))

// PWA icons served from /icons (manifest + apple-touch-icon).
for (const size of [48, 72, 96, 128, 192, 256, 512]) {
  await sharp(icon).resize(size, size).webp({ quality: 92 }).toFile(resolve(root, 'icons', `icon-${size}.webp`))
}
// Web app manifest icons (public/icons). Maskable ones keep the mark inside the central 80% circle.
const maskable = svg(1024, `<rect width="1024" height="1024" fill="url(#bg)" /><rect width="1024" height="1024" fill="url(#glow)" />${mark(0.7, 149, 170)}`)
for (const size of [192, 512]) {
  await sharp(icon).resize(size, size).png().toFile(resolve(root, 'public/icons', `icon-${size}.png`))
  await sharp(maskable).resize(size, size).png().toFile(resolve(root, 'public/icons', `icon-maskable-${size}.png`))
}
await sharp(icon).resize(180, 180).png().toFile(resolve(root, 'public/icons', 'apple-touch-icon.png'))
console.log('brand assets written to assets/ and icons/')
