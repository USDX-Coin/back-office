import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'

// USDX-39 + USDX-40: endpoints owned by integration tickets must hit the
// real BE (via Vite/Netlify proxy), not MSW. Test environments still get
// the full `handlers` set via `mocks/server.ts`.
const INTEGRATION_PATHS = new Set([
  // USDX-39
  '/api/v1/auth/login',
  '/api/v1/auth/me',
  '/api/v1/requests',
  '/api/v1/requests/:id',
  // USDX-40
  '/api/v1/users',
  '/api/v1/mint',
  '/api/v1/burn',
  '/api/v1/rate',
])

const browserHandlers = handlers.filter((handler) => {
  const path = (handler as { info?: { path?: string } }).info?.path
  return !path || !INTEGRATION_PATHS.has(path)
})

export const worker = setupWorker(...browserHandlers)
