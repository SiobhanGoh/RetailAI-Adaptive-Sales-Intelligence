import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { initialTheme } from './state'

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
