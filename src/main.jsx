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
import { watchServiceWorkerUpdates } from './utils/appUpdates'
import { installErrorReporter } from './utils/errorReporter'
import { watchHandoff } from './utils/authHandoff'

setupNative()
watchServiceWorkerUpdates()
installErrorReporter()
watchHandoff()

// the query cache wraps everything; it is persisted to localStorage when storage is available
const DataProvider = persister
  ? ({ children }) => <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>{children}</PersistQueryClientProvider>
  : ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <DataProvider>
      <AuthProvider>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </AuthProvider>
    </DataProvider>
  </StrictMode>,
)
