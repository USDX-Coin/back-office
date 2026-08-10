import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

async function enableMocking() {
  // MSW only runs in local dev (`vite dev` → import.meta.env.DEV === true).
  // A production build (`vite build`) must talk to the real backend, never the
  // mock service worker.
  if (!import.meta.env.DEV) return
  // Skipped under E2E (VITE_E2E=true): the Playwright suite intercepts the API
  // itself via page.route(), and an active MSW service worker would re-issue
  // passthrough requests from the SW context, bypassing those routes.
  if (import.meta.env.VITE_E2E === 'true') return
  const { worker } = await import('./mocks/browser')
  return worker.start({ onUnhandledRequest: 'bypass' })
}

// In production, proactively unregister any stale MSW service worker left over
// from earlier builds that shipped it — otherwise a cached SW keeps serving
// mock responses to returning visitors even after this fix ships.
if (!import.meta.env.DEV && 'serviceWorker' in navigator) {
  navigator.serviceWorker
    .getRegistrations()
    .then((regs) => regs.forEach((r) => void r.unregister()))
    .catch(() => undefined)
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
