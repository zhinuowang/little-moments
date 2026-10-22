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
      <AppProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </AppProvider>
    </I18nProvider>
  </StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((err) => console.warn('Service worker not registered', err))
  })
}
