// Pre-renders the phone Welcome screen to static HTML so a first-time visitor sees the real first
// screen from the HTML itself (before any JavaScript). Runs before `vite build`; the output is
// injected into index.html by the `poso-prerender` plugin in vite.config.js.
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { mkdirSync, writeFileSync } from 'node:fs'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
try {
  const { default: Welcome } = await server.ssrLoadModule('/src/app/Welcome.jsx')
  // same base as the build, so the pre-rendered links point at /websample/start on GitHub Pages (the phone app's URL)
  const basename = (process.env.VITE_BASE || '/').replace(/\/+$/, '')
  const html = renderToString(createElement(MemoryRouter, { basename, initialEntries: [basename || '/'] }, createElement(Welcome)))
  mkdirSync('src/prerender', { recursive: true })
  writeFileSync('src/prerender/welcome.html', html)
  console.log(`prerender: welcome.html ${(html.length / 1024).toFixed(1)} KB`)
} finally {
  await server.close()
}
