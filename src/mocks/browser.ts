import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'

// USDX-49 strict: paths whose BE side is live on Railway must skip MSW
// in the browser so calls hit the real backend. Paths whose BE side is
// not yet implemented stay registered with MSW so the FE keeps working
// against a contract-shaped mock until BE catches up.
//
// BE readiness audited live on https://backend-production-9740.up.railway.app
// (see PR description for the per-endpoint result table). Update this set
// as endpoints ship — anything that becomes 200/4xx (not 404 "Cannot ...")
// belongs here.
//
// Test environments (Vitest) still get the full handler set via mocks/server.ts.
const INTEGRATION_PATHS = new Set([
  '/api/v1/auth/login',
  '/api/v1/auth/me',
  '/api/v1/mint',
  '/api/v1/burn',
  '/api/v1/rate',
])

const browserHandlers = handlers.filter((handler) => {
  const path = (handler as { info?: { path?: string } }).info?.path
  return !path || !INTEGRATION_PATHS.has(path)
})

export const worker = setupWorker(...browserHandlers)
