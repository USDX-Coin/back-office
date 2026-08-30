import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'

// USDX-49 strict: paths whose BE side is live on Railway must skip MSW
// in the browser so calls hit the real backend. Paths whose BE side is
// not yet implemented stay registered with MSW so the FE keeps working
// against a contract-shaped mock until BE catches up.
//
// BE readiness audited live on https://usdx-backend-api.up.railway.app
// (see PR description for the per-endpoint result table). Update this set
// as endpoints ship — anything that becomes 200/4xx (not 404 "Cannot ...")
// belongs here.
//
// USDX-47: /api/v1/users.* handlers were removed from handlers.ts entirely
// (no MSW fallback). The path entries below are kept as documentation that
// these endpoints are real-BE-only in both browser and Vitest.
//
// USDX-53: /api/v1/threshold handlers removed from handlers.ts. BE endpoint
// has since shipped (200 on dev as of USDX-23 audit).
//
// USDX-23: final integration pass — /api/v1/dashboard/stats and
// /api/v1/requests (list + detail) now flow to the real BE in the browser.
// Handlers remain in handlers.ts so Vitest keeps the MSW-backed coverage
// for the existing unit tests; the worker filter below drops them at runtime.
// /api/v1/staff was already real-BE-only in the browser (handler removed
// in USDX-41); listed here as documentation only.
//
// USDX-82: /api/v1/reports/* handlers were removed from handlers.ts entirely
// (no Vitest coverage needed — production code just calls apiFetch). Path
// entries below kept as documentation that these endpoints are real-BE-only.
//
// USDX-85: Manual Sync endpoints + the 409 SAFE_QUEUE_OCCUPIED branch inside
// `/api/v1/mint` and `/api/v1/burn` were removed from handlers.ts. The
// list/verify/execute paths join the real-BE-only set; the mint/burn paths
// were already listed (USDX-23 final integration) — queue enforcement now
// lives entirely in BE (USDX-83). Vitest tests scope their own
// `server.use(...)` overrides per scenario so no defaults are needed.
//
// USDX-546: /api/v1/kyb* went real on 28 Aug 2026 and their handlers were
// removed from handlers.ts ENTIRELY (no MSW fallback, the USDX-47 / USDX-82 /
// USDX-85 precedent) — leaving a mock registered for a live screen is how a
// reviewer ends up debugging the wrong answer. The tables landed with backend
// PR #271 (migration 0077) and the document endpoints with PR #275; the path
// entries below are the record that these are real-BE-only in both the browser
// and Vitest.
//
// Transparency: /api/v1/transparency/* went real on 13 Aug 2026, after the
// integration pass against api-dev came back 5/5 on the runbook steps
// (catatan/RILIS-TRANSPARANSI-ANGKA.md § Langkah 2 — list renders, 201 on a new
// entry, 200 on an identical replay, 409 LEDGER_IDEMPOTENCY_KEY_CONFLICT on the
// same key with different content, and the three-step attestation upload).
// Handlers stay in handlers.ts so Vitest keeps its MSW-backed coverage; the
// worker filter below drops them at runtime.
const INTEGRATION_PATHS = new Set([
  '/api/v1/auth/login',
  // USDX-392: server-side logout is live on the backend (PR #197).
  '/api/v1/auth/logout',
  '/api/v1/auth/me',
  '/api/v1/mint',
  '/api/v1/burn',
  '/api/v1/rate',
  '/api/v1/threshold',
  '/api/v1/users',
  '/api/v1/users/:id',
  '/api/v1/users/:id/wallets',
  '/api/v1/users/:id/wallets/:walletId',
  '/api/v1/dashboard/stats',
  '/api/v1/staff',
  '/api/v1/staff/:id',
  '/api/v1/requests',
  '/api/v1/requests/:id',
  // USDX-71: GET /api/v1/chains shipped on the backend (USDX-70). Real-BE in the
  // browser; the handler stays in handlers.ts for Vitest coverage.
  '/api/v1/chains',
  // USDX-82: reporting endpoints — documentation only, handlers deleted.
  '/api/v1/reports/mint/daily',
  '/api/v1/reports/mint/by-user',
  '/api/v1/reports/burn/daily',
  '/api/v1/reports/burn/by-user',
  // USDX-85: Manual Sync — documentation only, handlers deleted.
  '/api/v1/manual-sync',
  '/api/v1/manual-sync/:id/verify',
  '/api/v1/manual-sync/:id/execute',
  // USDX-154: KYC review list — BE shipped with USDX-148 (backend PR #90).
  // Real-BE in the browser; the handler stays in handlers.ts for Vitest.
  '/api/v1/kyc',
  // USDX-155: KYC detail + approve/reject + audit trail — same BE ship.
  '/api/v1/kyc/:id',
  '/api/v1/kyc/:id/reviews',
  '/api/v1/kyc/:id/approve',
  '/api/v1/kyc/:id/reject',
  // USDX-546: KYB review — documentation only, handlers deleted. Six endpoints,
  // all live on api-dev (backend PR #271 + #275).
  '/api/v1/kyb',
  '/api/v1/kyb/:id',
  '/api/v1/kyb/:id/reviews',
  '/api/v1/kyb/:id/approve',
  '/api/v1/kyb/:id/reject',
  '/api/v1/kyb/:id/documents/presign',
  '/api/v1/kyb/:id/documents',
  // Transparency — append-only reserve ledger + attestation reports. Live on
  // api-dev as of 13 Aug 2026 (see the note above the set).
  '/api/v1/transparency/ledger',
  '/api/v1/transparency/attestations',
  '/api/v1/transparency/attestations/upload-url',
  '/api/v1/transparency/attestations/:id',
])

const browserHandlers = handlers.filter((handler) => {
  const path = (handler as { info?: { path?: string } }).info?.path
  return !path || !INTEGRATION_PATHS.has(path)
})

export const worker = setupWorker(...browserHandlers)
