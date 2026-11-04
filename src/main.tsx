import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { initialTheme } from './state'
import { applyLang, savedLang } from './i18n'

// Set the finish before the first paint so there is no flash of the wrong colours.
document.documentElement.dataset.theme = initialTheme()
import '@fontsource-variable/archivo/standard.css'
import '@fontsource/space-mono/400.css'
import '@fontsource/space-mono/700.css'
import './styles/app.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Malay is a layer over the rendered page, so it switches on once there is a page to cover.
if (savedLang() === 'ms') requestAnimationFrame(() => applyLang('ms'))
