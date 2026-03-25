import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

async function enableMocking() {
  // Intentionally enable MSW in production builds.
  // Note: MSW is still "mock-only"; this changes which code executes,
  // not any underlying API availability.
  const { worker } = await import('./mocks/browser')
  return worker.start({ onUnhandledRequest: 'bypass' })
}

enableMocking().then(() => {
  const rootEl = document.getElementById('root')
  if (!rootEl) return

  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
