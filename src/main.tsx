import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'

// Registro activo del Service Worker para detectar y aplicar actualizaciones PWA automáticamente
if ('serviceWorker' in navigator) {
  let isReloading = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (isReloading) return
    isReloading = true
    window.location.reload()
  })

  registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return
      // Verificar actualizaciones al volver a abrir/enfocar la PWA
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          registration.update().catch(() => {})
        }
      })
      // Comprobación periódica cada 30 minutos si la app queda abierta
      window.setInterval(() => {
        registration.update().catch(() => {})
      }, 30 * 60 * 1000)
    }
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)

