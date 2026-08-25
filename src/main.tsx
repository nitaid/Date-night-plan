import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { StoreProvider } from './state/store'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </StrictMode>,
)

// Offline shell, so the app opens on a train with no signal.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // A failed registration only costs offline support, not the app.
    })
  })
}
