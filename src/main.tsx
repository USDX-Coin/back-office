import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

async function enableMocking() {
  // Intentionally enable MSW in production builds too — it's still "mock-only".
  // Skipped under E2E (VITE_E2E=true): the Playwright suite intercepts the API
  // itself via page.route(), and an active MSW service worker would re-issue
  // passthrough requests from the SW context, bypassing those routes.
  if (import.meta.env.VITE_E2E === 'true') return
  const { worker } = await import('./mocks/browser')
  return worker.start({ onUnhandledRequest: 'bypass' })
}

enableMocking()
  .catch(() => undefined)
  .then(() => {
    const rootEl = document.getElementById('root')
    if (!rootEl) return

    createRoot(rootEl).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
