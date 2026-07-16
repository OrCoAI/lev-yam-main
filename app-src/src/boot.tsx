import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './lib/auth'
import { I18nProvider } from './lib/i18n'
import RouteErrorBoundary from './shell/ErrorBoundary'
import App from './App'
import './styles.css'

// basename '/app' matches Vite's base — routes are written without the /app prefix.
// The boundary sits above AuthProvider so even a crash while deriving the auth
// context shows the bilingual error card (it only needs i18n + router context).
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <BrowserRouter basename="/app">
        <RouteErrorBoundary>
          <AuthProvider>
            <App />
          </AuthProvider>
        </RouteErrorBoundary>
      </BrowserRouter>
    </I18nProvider>
  </StrictMode>,
)
