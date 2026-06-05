import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import ShareGate from './ShareGate.jsx'
import { I18nProvider } from './i18n/I18nContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <I18nProvider>
      <ShareGate />
    </I18nProvider>
  </StrictMode>,
)
