import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Poso.ba — Marketplace za usluge',
        short_name: 'Poso.ba',
        description: 'Pronađite ili ponudite lokalne usluge u Bosni i Hercegovini.',
        lang: 'bs',
        start_url: '/',
        display: 'standalone',
        background_color: '#f6f4ee',
        theme_color: '#0d2a52',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,jpeg,ico}'],
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
})
