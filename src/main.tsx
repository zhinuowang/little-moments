import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/courier-prime/latin-400.css'
import '@fontsource/short-stack/latin-400.css'
import '@chinese-fonts/xiaolai/dist/Xiaolai/result.css'
import './styles/index.css'
import App from './App'
import { I18nProvider } from './i18n'
import { AppProvider } from './store/AppContext'
import { AuthProvider } from './store/AuthContext'
import { captureAuthReturn } from './lib/cloud/authReturn'
import { cloudEnabled } from './lib/cloud/config'

// a sign-in link or Google brings credentials back in the URL; take them out before routing
if (cloudEnabled) captureAuthReturn()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <AuthProvider>
        <AppProvider>
          <App />
        </AppProvider>
      </AuthProvider>
    </I18nProvider>
  </StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((err) => console.warn('Service worker not registered', err))
    // files this first visit loaded before the worker existed (fonts, lazy chunks) — keep them offline
    navigator.serviceWorker.ready.then((reg) => {
      const urls = performance.getEntriesByType('resource').map((r) => r.name).filter((u) => u.startsWith(location.origin))
      reg.active?.postMessage({ type: 'cache-urls', urls })
    }).catch(() => { /* fine */ })
  })
}
