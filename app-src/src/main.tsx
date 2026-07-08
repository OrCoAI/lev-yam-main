import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './lib/auth'
import { I18nProvider } from './lib/i18n'
import App from './App'
import './styles.css'

// basename '/app' matches Vite's base — routes are written without the /app prefix.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <BrowserRouter basename="/app">
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </I18nProvider>
  </StrictMode>,
)
