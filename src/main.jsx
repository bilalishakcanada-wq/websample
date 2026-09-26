import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider } from './context/AuthContext.jsx'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { QueryClientProvider } from '@tanstack/react-query'
import { persistOptions, persister, queryClient } from './lib/queryClient'
import { setupNative } from './utils/native'
import { seedHistory } from './utils/backNav'
import { watchServiceWorkerUpdates } from './utils/appUpdates'
import { installErrorReporter } from './utils/errorReporter'
import { watchHandoff } from './utils/authHandoff'
import { installImageFade } from './utils/imageFade'

seedHistory()
setupNative()
watchServiceWorkerUpdates()
installErrorReporter()
watchHandoff()
installImageFade()

// the query cache wraps everything; it is persisted to localStorage when storage is available
const DataProvider = persister
  ? ({ children }) => <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>{children}</PersistQueryClientProvider>
  : ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>

// the stylesheet loads without blocking the boot screen; React mounts only once it has applied
const cssReady = () => {
  const links = [...document.querySelectorAll('link[rel="preload"][as="style"], link[rel="stylesheet"]')].filter((link) => /\/assets\/.*\.css/.test(link.href))
  return Promise.all(links.map((link) => (link.sheet && link.rel === 'stylesheet' ? Promise.resolve() : new Promise((resolve) => {
    link.addEventListener('load', resolve, { once: true })
    link.addEventListener('error', resolve, { once: true })
    window.setTimeout(resolve, 4000) // never wait forever on a stalled stylesheet
  }))))
}

// safety net: whatever happens, the pre-rendered overlay never outlives the first seconds
window.setTimeout(() => document.getElementById('boot-welcome')?.remove(), 6000)

cssReady().then(() => createRoot(document.getElementById('root')).render(
  <StrictMode>
    <DataProvider>
      <AuthProvider>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </AuthProvider>
    </DataProvider>
  </StrictMode>,
))
