import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider } from './context/AuthContext.jsx'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { setupNative } from './utils/native'
import { watchServiceWorkerUpdates } from './utils/appUpdates'
import { installErrorReporter } from './utils/errorReporter'
import { watchHandoff } from './utils/authHandoff'

setupNative()
watchServiceWorkerUpdates()
installErrorReporter()
watchHandoff()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </AuthProvider>
  </StrictMode>,
)
