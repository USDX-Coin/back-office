import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'

// USDX-49 strict: paths whose BE side is live on Railway must skip MSW
// in the browser so calls hit the real backend. Paths whose BE side is
// not yet implemented stay registered with MSW so the FE keeps working
// against a contract-shaped mock until BE catches up.
//
// BE readiness audited live on https://backend-dev-c526.up.railway.app
// (see PR description for the per-endpoint result table). Update this set
// as endpoints ship — anything that becomes 200/4xx (not 404 "Cannot ...")
// belongs here.
//
// USDX-47: /api/v1/users.* handlers were removed from handlers.ts entirely
// (no MSW fallback). The path entries below are kept as documentation that
// these endpoints are real-BE-only in both browser and Vitest.
//
// USDX-53: /api/v1/threshold handlers removed from handlers.ts. BE endpoint
// is currently 404 on dev — listed here to document FE intent (real-BE-only)
// and to surface the BE gap as a Post-Merge Action in the PR description.
const INTEGRATION_PATHS = new Set([
  '/api/v1/auth/login',
  '/api/v1/auth/me',
  '/api/v1/mint',
  '/api/v1/burn',
  '/api/v1/rate',
  '/api/v1/threshold',
  '/api/v1/users',
  '/api/v1/users/:id',
  '/api/v1/users/:id/wallets',
  '/api/v1/users/:id/wallets/:walletId',
])

const browserHandlers = handlers.filter((handler) => {
  const path = (handler as { info?: { path?: string } }).info?.path
  return !path || !INTEGRATION_PATHS.has(path)
})

export const worker = setupWorker(...browserHandlers)
