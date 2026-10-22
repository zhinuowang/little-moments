import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/courier-prime/latin-400.css'
import '@fontsource/short-stack/latin-400.css'
import '@chinese-fonts/xiaolai/dist/Xiaolai/result.css'
import './styles/index.css'
import App from './App'
import { I18nProvider } from './i18n'
import { AppProvider } from './store/AppContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <AppProvider>
        <App />
      </AppProvider>
    </I18nProvider>
  </StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((err) => console.warn('Service worker not registered', err))
  })
}
