import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Deploy target decides the base path: '/' on a domain (Vercel), '/websample/' on GitHub Pages.
const base = process.env.VITE_BASE || '/'

// https://vite.dev/config/
export default defineConfig({
  base,
  optimizeDeps: {
    // maplibre-gl ships its own worker bundle; pre-bundling breaks it.
    exclude: ['maplibre-gl'],
  },
  // the desktop app may assign a port via PORT when 5173 is already taken
  server: { port: Number(process.env.PORT) || 5173 },
  plugins: [
    react(),
    process.env.VITE_NO_PWA ? null : VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
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
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // the map library chunk is large; still fine to precache
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallbackDenylist: [/^\/api\//, /\/storage\/v1\//],
        runtimeCaching: [
          { urlPattern: ({ url }) => url.hostname.endsWith('supabase.co') && url.pathname.startsWith('/storage/'), handler: 'CacheFirst', options: { cacheName: 'poso-media', expiration: { maxEntries: 200, maxAgeSeconds: 7 * 24 * 3600 } } },
          { urlPattern: ({ url }) => url.hostname.includes('fonts.g'), handler: 'StaleWhileRevalidate', options: { cacheName: 'poso-fonts' } },
        ],
      },
    }),
  ],
})
