import { http, HttpResponse } from 'msw'
import { isAddress } from 'viem'
import { canHandleAmountIdr } from '@/lib/roleAuth'
import type {
  Customer,
  KycDetail,
  KycListItem,
  KycReviewLog,
  Staff,
  OtcMintTransaction,
  OtcRedeemTransaction,
  OtcStatus,
  RateConfig,
  RateMode,
  UpdateRateConfig,
  FeeConfig,
  UpdateFeeConfig,
  RequestDetail,
  RequestListItem,
  OrderDetail,
  OrderListItem,
} from '@/lib/types'
import { canManageRate, canManageFeeConfig } from '@/lib/types'
import {
  createKycReviewLog,
  createMockCustomerList,
  createMockKycDetailState,
  createMockKycList,
  createMockStaffList,
  createMockOtcTransactions,
  createMockChainConfigs,
  createMockRequests,
  createOtcMintTransaction,
  createOtcRedeemTransaction,
  createBurnRequestFromSubmission,
  createInitialRateHistory,
  createRateConfig,
  computeRateInfo,
  createInitialFeeHistory,
  createFeeConfig,
  computeDashboardStats,
  customerToPhaseOneUser,
  createMintFromRequest,
  createMockOrders,
  MANAGER_THRESHOLD_IDR,
} from './data'

// ─── Stores ───
let customerStore: Customer[] = createMockCustomerList()
let staffStore: Staff[] = createMockStaffList()
let otcMintStore: OtcMintTransaction[]
let otcRedeemStore: OtcRedeemTransaction[]
;({ mints: otcMintStore, redeems: otcRedeemStore } = createMockOtcTransactions(customerStore, staffStore))
let rateHistory: RateConfig[] = createInitialRateHistory(staffStore[0]?.id ?? 'seed')
let feeHistory: FeeConfig[] = createInitialFeeHistory(staffStore[0]?.id ?? 'seed')
let requestList: RequestListItem[]
let requestDetails: Map<string, RequestDetail>
;({ list: requestList, details: requestDetails } = createMockRequests(customerStore, staffStore))
let orderList: OrderListItem[]
let orderDetails: Map<string, OrderDetail>
;({ list: orderList, details: orderDetails } = createMockOrders(customerStore))
let kycList: KycListItem[] = createMockKycList()
let kycDetails: Map<string, KycDetail>
let kycReviews: Map<string, KycReviewLog[]>
;({ details: kycDetails, reviews: kycReviews } = createMockKycDetailState(kycList))

const pendingTimers = new Set<ReturnType<typeof setTimeout>>()

export function resetMockData() {
  customerStore = createMockCustomerList()
  staffStore = createMockStaffList()
  ;({ mints: otcMintStore, redeems: otcRedeemStore } = createMockOtcTransactions(customerStore, staffStore))
  rateHistory = createInitialRateHistory(staffStore[0]?.id ?? 'seed')
  feeHistory = createInitialFeeHistory(staffStore[0]?.id ?? 'seed')
  ;({ list: requestList, details: requestDetails } = createMockRequests(customerStore, staffStore))
  ;({ list: orderList, details: orderDetails } = createMockOrders(customerStore))
  kycList = createMockKycList()
  ;({ details: kycDetails, reviews: kycReviews } = createMockKycDetailState(kycList))
  pendingTimers.forEach(clearTimeout)
  pendingTimers.clear()
}

// USDX-84 — test helper. The seeded `createMockRequests` factory generates
// multiple PENDING_APPROVAL/APPROVED entries per Safe (legacy demo data
// useful for list/dashboard tests). That collides with the SoT § Safe
// Propose Queue 1-pending-per-Safe invariant the POST handlers now enforce,
// so submission tests need a clean queue before exercising the happy path.
//
// Not exported from the runtime API surface (no callers in src/, only tests).
export function clearActiveRequestsForTests() {
  for (const item of requestList) {
    if (item.status === 'PENDING_APPROVAL' || item.status === 'APPROVED') {
      requestDetails.delete(item.id)
    }
  }
  requestList = requestList.filter(
    (r) => r.status !== 'PENDING_APPROVAL' && r.status !== 'APPROVED'
  )
}

// Exposed for AuthProvider: looks up Staff without going over HTTP
export function findStaffByEmail(email: string): Staff | undefined {
  const needle = email.trim().toLowerCase()
  return staffStore.find((s) => s.email.toLowerCase() === needle)
}

export function findStaffById(id: string): Staff | undefined {
  return staffStore.find((s) => s.id === id)
}

export function getDefaultStaff(): Staff | undefined {
  return staffStore[0]
}

// HMR safety — clear orphan timers when the module is replaced
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    pendingTimers.forEach(clearTimeout)
    pendingTimers.clear()
  })
}

// ─── Settlement simulator (inline) ───

function settleAfterDelay(
  store: Array<OtcMintTransaction | OtcRedeemTransaction>,
  txId: string
) {
  const delay = 8000 + Math.random() * 7000
  const timer = setTimeout(() => {
    pendingTimers.delete(timer)
    try {
      const tx = store.find((t) => t.id === txId)
      if (!tx || tx.status !== 'pending') return
      const outcome: OtcStatus = Math.random() < 0.9 ? 'completed' : 'failed'
      tx.status = outcome
      tx.settledAt = new Date().toISOString()
    } catch (err) {
      console.warn('[msw] settlement callback failed', err)
    }
  }, delay)
  pendingTimers.add(timer)
}

/** Test hook — synchronously transitions a pending tx to a terminal state. */
export function flushSettlement(txId: string, outcome: 'completed' | 'failed' = 'completed') {
  const all = [...otcMintStore, ...otcRedeemStore]
  const tx = all.find((t) => t.id === txId)
  if (!tx || tx.status !== 'pending') return
  tx.status = outcome
  tx.settledAt = new Date().toISOString()
}

/**
 * Test hook — simulate Safe UI sign + execute by transitioning a
 * Phase-1 request from PENDING_APPROVAL → EXECUTED. The Notifications
 * list filters on `status === 'PENDING_APPROVAL'`, so executed rows
 * disappear automatically once the polling refetch lands.
 */
export function flushApproval(
  requestId: string,
  outcome: 'EXECUTED' | 'REJECTED' = 'EXECUTED'
) {
  const list = requestList.find((r) => r.id === requestId)
  const detail = requestDetails.get(requestId)
  if (!list || !detail || list.status !== 'PENDING_APPROVAL') return
  list.status = outcome
  detail.status = outcome
  detail.updatedAt = new Date().toISOString()
}

// Browser dev hook for the E2E smoke spec
if (typeof window !== 'undefined') {
  ;(window as unknown as { __mswFlushSettlement?: typeof flushSettlement }).__mswFlushSettlement =
    flushSettlement
  ;(window as unknown as { __mswFlushApproval?: typeof flushApproval }).__mswFlushApproval =
    flushApproval
}

// ─── Helpers ───

function paginate<T>(items: T[], page: number, pageSize: number) {
  const start = (page - 1) * pageSize
  const data = items.slice(start, start + pageSize)
  return {
    data,
    meta: {
      page,
      pageSize,
      total: items.length,
      totalPages: Math.ceil(items.length / pageSize) || 1,
    },
  }
}

function badRequest(code: string, message: string, details?: Record<string, string>) {
  return HttpResponse.json({ error: { code, message, details } }, { status: 400 })
}

// USDX-155 — phase-one error shapes for the KYC review endpoints
// (sot/api/kyc.yaml § detail/approve/reject error responses).
function kycNotFound() {
  return HttpResponse.json(
    {
      status: 'error',
      metadata: null,
      data: null,
      error: { code: 'NOT_FOUND', message: 'KYC record not found' },
    },
    { status: 404 }
  )
}

function kycForbidden() {
  return HttpResponse.json(
    {
      status: 'error',
      metadata: null,
      data: null,
      error: { code: 'FORBIDDEN', message: 'Developer role cannot approve or reject KYC' },
    },
    { status: 403 }
  )
}

function kycInvalidStatus() {
  return HttpResponse.json(
    {
      status: 'error',
      metadata: null,
      data: null,
      error: {
        code: 'INVALID_STATUS',
        message: 'KYC status is not PENDING (it may have been reviewed concurrently)',
      },
    },
    { status: 409 }
  )
}

// Asia/Jakarta (UTC+7) date bucket of an ISO timestamp, mirrors BE
// `(col AT TIME ZONE 'Asia/Jakarta')::date`. Inclusive both bounds
// (equivalent to col < endDate + 1 day). Shared by the requests (USDX-98)
// and KYC (USDX-154) list handlers.
function jakartaDate(iso: string): string {
  return new Date(new Date(iso).getTime() + 7 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)
}

// ─── Mock JWT (mock-only; v1 risk R64 — not a real signed token) ───
function base64UrlEncode(payload: object): string {
  const json = JSON.stringify(payload)
  // btoa is available in browser + jsdom; encodeURIComponent guards against unicode
  const b64 = btoa(unescape(encodeURIComponent(json)))
  return b64.replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
}

export function issueMockJwt(staff: Staff): string {
  const header = base64UrlEncode({ alg: 'HS256', typ: 'JWT' })
  const now = Math.floor(Date.now() / 1000)
  const body = base64UrlEncode({
    sub: staff.id,
    email: staff.email,
    role: staff.role,
    iat: now,
    exp: now + 60 * 60 * 24 * 30, // 30 days — matches "Remember this device for 30 days"
  })
  return `${header}.${body}.mock-signature`
}

function base64UrlDecode(segment: string): string {
  const pad = segment.length % 4 === 0 ? 0 : 4 - (segment.length % 4)
  const b64 = segment.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad)
  return decodeURIComponent(escape(atob(b64)))
}

interface MockJwtClaims {
  sub: string
  email: string
  role: string
  iat: number
  exp: number
}

export function verifyMockJwt(token: string): MockJwtClaims | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  if (parts[2] !== 'mock-signature') return null
  try {
    const claims = JSON.parse(base64UrlDecode(parts[1])) as MockJwtClaims
    if (typeof claims.exp !== 'number') return null
    if (Math.floor(Date.now() / 1000) >= claims.exp) return null
    if (typeof claims.sub !== 'string' || !claims.sub) return null
    return claims
  } catch {
    return null
  }
}

function unauthorized(message = 'Invalid or missing token') {
  return HttpResponse.json(
    {
      status: 'error',
      metadata: null,
      data: null,
      error: { code: 'UNAUTHORIZED', message },
    },
    { status: 401 }
  )
}

// sot/openapi.yaml § ErrorResponse declares only `error: { code, message }`.
function phaseOneBadRequest(message: string, code = 'VALIDATION_ERROR') {
  return HttpResponse.json(
    {
      status: 'error',
      metadata: null,
      data: null,
      error: { code, message },
    },
    { status: 400 }
  )
}

function authenticatedStaff(request: Request): Staff | null {
  const header = request.headers.get('Authorization') ?? ''
  if (!header.startsWith('Bearer ')) return null
  const claims = verifyMockJwt(header.slice('Bearer '.length).trim())
  if (!claims) return null
  return findStaffById(claims.sub) ?? null
}

// ─── Handlers ───

export const handlers = [
  // ─── Auth ───
  // Response envelope follows sot/openapi.yaml § /api/v1/auth/login.
  http.post('/api/v1/auth/login', async ({ request }) => {
    let body: { email?: string; password?: string }
    try {
      body = (await request.json()) as { email?: string; password?: string }
    } catch {
      return HttpResponse.json(
        {
          status: 'error',
          metadata: null,
          data: null,
          error: { code: 'BAD_REQUEST', message: 'Request body must be valid JSON' },
        },
        { status: 400 }
      )
    }
    const email = body.email?.trim() ?? ''
    const password = body.password ?? ''
    if (!email || !password) {
      return HttpResponse.json(
        {
          status: 'error',
          metadata: null,
          data: null,
          error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' },
        },
        { status: 401 }
      )
    }
    // R64 (mock-only): any non-empty credential pair authenticates.
    const matched = findStaffByEmail(email) ?? getDefaultStaff()
    if (!matched) {
      return HttpResponse.json(
        {
          status: 'error',
          metadata: null,
          data: null,
          error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' },
        },
        { status: 401 }
      )
    }
    return HttpResponse.json({
      status: 'success',
      metadata: null,
      data: {
        accessToken: issueMockJwt(matched),
        staff: matched,
      },
    })
  }),

  // sot/openapi.yaml § /api/v1/auth/me — restore session by Bearer token.
  http.get('/api/v1/auth/me', ({ request }) => {
    const staff = authenticatedStaff(request)
    if (!staff) return unauthorized()
    return HttpResponse.json({
      status: 'success',
      metadata: null,
      data: staff,
    })
  }),

  // USDX-23: /api/customers/* handlers removed — legacy mock domain replaced
  // by the SoT `/api/v1/users` flow (USDX-37 + USDX-47). No remaining consumer.
  //
  // USDX-41: /api/staff/* mock removed — StaffPage now hits real GET /api/v1/staff.

  // ─── OTC Mint ───
  http.get('/api/otc/mint', ({ request }) => {
    const url = new URL(request.url)
    const page = Number(url.searchParams.get('page') || '1')
    const pageSize = Number(url.searchParams.get('pageSize') || '10')
    const operatorStaffId = url.searchParams.get('operatorStaffId')

    let result = [...otcMintStore].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    if (operatorStaffId) result = result.filter((t) => t.operatorStaffId === operatorStaffId)

    return HttpResponse.json(paginate(result, page, pageSize))
  }),

  http.post('/api/otc/mint', async ({ request }) => {
    const body = (await request.json()) as Partial<OtcMintTransaction> & {
      customerId: string
      operatorStaffId: string
    }
    const customer = customerStore.find((c) => c.id === body.customerId)
    const operator = staffStore.find((s) => s.id === body.operatorStaffId)
    if (!customer) return badRequest('VALIDATION', 'Customer not found')
    if (!operator) return badRequest('VALIDATION', 'Operator not found')

    const created = createOtcMintTransaction(customer, operator, {
      ...body,
      status: 'pending',
      createdAt: new Date().toISOString(),
      settledAt: undefined,
    })
    otcMintStore.unshift(created)
    settleAfterDelay(otcMintStore, created.id)
    return HttpResponse.json(created, { status: 201 })
  }),

  // ─── OTC Redeem ───
  http.get('/api/otc/redeem', ({ request }) => {
    const url = new URL(request.url)
    const page = Number(url.searchParams.get('page') || '1')
    const pageSize = Number(url.searchParams.get('pageSize') || '10')
    const operatorStaffId = url.searchParams.get('operatorStaffId')

    let result = [...otcRedeemStore].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    if (operatorStaffId) result = result.filter((t) => t.operatorStaffId === operatorStaffId)

    return HttpResponse.json(paginate(result, page, pageSize))
  }),

  http.post('/api/otc/redeem', async ({ request }) => {
    const body = (await request.json()) as Partial<OtcRedeemTransaction> & {
      customerId: string
      operatorStaffId: string
    }
    const customer = customerStore.find((c) => c.id === body.customerId)
    const operator = staffStore.find((s) => s.id === body.operatorStaffId)
    if (!customer) return badRequest('VALIDATION', 'Customer not found')
    if (!operator) return badRequest('VALIDATION', 'Operator not found')

    const created = createOtcRedeemTransaction(customer, operator, {
      ...body,
      status: 'pending',
      createdAt: new Date().toISOString(),
      settledAt: undefined,
    })
    otcRedeemStore.unshift(created)
    settleAfterDelay(otcRedeemStore, created.id)
    return HttpResponse.json(created, { status: 201 })
  }),

  // USDX-37: /api/dashboard/snapshot mock removed — superseded by SoT
  // /api/v1/dashboard/stats (real BE per mocks/browser.ts § INTEGRATION_PATHS;
  // tests still hit the in-process /api/v1/dashboard/stats handler below).

  // USDX-42: /report mock removed — superseded by /requests.

  // USDX-41: /api/profile/:id mock removed — ProfilePage uses useAuth().user
  // (sourced from real GET /api/v1/auth/me).

  // ─── Rate (sot/openapi.yaml § /api/v1/rate) ───
  // GET is intentionally not Bearer-gated in the mock: the production endpoint
  // requires auth, but enforcing it here would 401 React Query's first fetch
  // when child-component effects fire before AuthProvider has wired apiFetch
  // bindings. Real backend reads JWT and returns 401 — UI handles that path
  // already via apiFetch.onUnauthorized.
  http.get('/api/v1/rate', () =>
    HttpResponse.json({
      status: 'success',
      metadata: null,
      data: computeRateInfo(rateHistory),
    })
  ),

  http.post('/api/v1/rate', async ({ request }) => {
    const operator = authenticatedStaff(request)
    if (!operator) return unauthorized()
    if (!canManageRate(operator.role)) {
      return HttpResponse.json(
        {
          status: 'error',
          metadata: null,
          data: null,
          error: { code: 'FORBIDDEN', message: 'Only ADMIN can update rate' },
        },
        { status: 403 }
      )
    }

    const body = (await request.json()) as UpdateRateConfig

    function rateBadRequest(message: string) {
      return HttpResponse.json(
        {
          status: 'error',
          metadata: null,
          data: null,
          error: { code: 'VALIDATION', message },
        },
        { status: 400 }
      )
    }

    if (body.mode !== 'MANUAL' && body.mode !== 'DYNAMIC') {
      return rateBadRequest('mode must be MANUAL or DYNAMIC')
    }
    if (body.mode === 'MANUAL') {
      const n = Number(body.manualRate)
      if (!body.manualRate || !Number.isFinite(n) || n <= 0) {
        return rateBadRequest('manualRate is required when mode is MANUAL')
      }
    }
    for (const key of ['spreadBuyPct', 'spreadSellPct'] as const) {
      const raw = body[key]
      if (raw != null) {
        const n = Number(raw)
        if (!Number.isFinite(n) || n < 0) {
          return rateBadRequest(`${key} must be a non-negative number`)
        }
      }
    }

    const created = createRateConfig({
      mode: body.mode as RateMode,
      manualRate: body.mode === 'MANUAL' ? (body.manualRate ?? null) : null,
      spreadBuyPct: body.spreadBuyPct ?? '0',
      spreadSellPct: body.spreadSellPct ?? '0',
      updatedBy: operator.id,
      createdAt: new Date().toISOString(),
    })
    rateHistory.push(created)
    return HttpResponse.json(
      { status: 'success', metadata: null, data: created },
      { status: 201 }
    )
  }),

  // ─── Fee config (sot/api/fee.yaml § /api/v1/fee-config, USDX-207) ───
  // GET = semua role backoffice (read); POST = admin only (append-only).
  // Mock-served (not in browser INTEGRATION_PATHS) — BE belum tentu live.
  // GET not Bearer-gated, same rationale as /api/v1/rate above.
  http.get('/api/v1/fee-config', () =>
    HttpResponse.json({
      status: 'success',
      metadata: null,
      data: feeHistory[feeHistory.length - 1],
    })
  ),

  http.post('/api/v1/fee-config', async ({ request }) => {
    const operator = authenticatedStaff(request)
    if (!operator) return unauthorized()
    if (!canManageFeeConfig(operator.role)) {
      return HttpResponse.json(
        {
          status: 'error',
          metadata: null,
          data: null,
          error: { code: 'FORBIDDEN', message: 'Only ADMIN can update fee config' },
        },
        { status: 403 }
      )
    }

    const body = (await request.json()) as UpdateFeeConfig

    // sot/conventions.md § Validation Error — fee-config is on the v1→422
    // allowlist, so body failures use 422 VALIDATION_ERROR (not 400/VALIDATION).
    function feeValidationError(message: string) {
      return HttpResponse.json(
        {
          status: 'error',
          metadata: null,
          data: null,
          error: { code: 'VALIDATION_ERROR', message },
        },
        { status: 422 }
      )
    }

    // POST = full 5-field snapshot; every field required + non-negative (W3
    // redeem fields included so partial submits can't zero them out, USDX-245).
    for (const key of [
      'mintFeePct',
      'pgFeeVaFlat',
      'pgFeeQrisPct',
      'redeemFeePct',
      'disbursementFeeFlat',
    ] as const) {
      const raw = body[key]
      const n = Number(raw)
      if (raw == null || raw === '' || !Number.isFinite(n) || n < 0) {
        return feeValidationError(`${key} is required and must be a non-negative number`)
      }
    }

    const created = createFeeConfig({
      mintFeePct: body.mintFeePct,
      pgFeeVaFlat: body.pgFeeVaFlat,
      pgFeeQrisPct: body.pgFeeQrisPct,
      redeemFeePct: body.redeemFeePct,
      disbursementFeeFlat: body.disbursementFeeFlat,
      updatedBy: operator.id,
      createdAt: new Date().toISOString(),
    })
    feeHistory.push(created)
    return HttpResponse.json(
      { status: 'success', metadata: null, data: created },
      { status: 201 }
    )
  }),

  // ─── Chain config — sot/api/chains.yaml § GET /api/v1/chains ───
  // FE-facing chain metadata (block explorer + Safe addresses) used to build
  // on-chain deep-links. Real-BE-backed in the browser (see browser.ts §
  // INTEGRATION_PATHS); this handler keeps Vitest coverage. Not Bearer-gated in
  // the mock for the same reason as /api/v1/rate above.
  http.get('/api/v1/chains', () =>
    HttpResponse.json({
      status: 'success',
      metadata: null,
      data: createMockChainConfigs(),
    })
  ),

  // USDX-82: MSW reporting handlers removed — `/api/v1/reports/*` now hits the
  // real BE (sot/api/reporting.yaml). Requests fall through to the configured
  // VITE_API_URL via `onUnhandledRequest: 'bypass'` in main.tsx.

  // ─── Phase 1 Requests (mint/burn approval lifecycle) — see sot/openapi.yaml ───
  // USDX-51: `?search=` filters by user name / address substring (case-insensitive).
  // USDX-78: `?search=` also matches on request `id` (prefix / substring) — users
  // typically paste the short form `019e1aa8` from the ID column. Per
  // sot/api/requests.yaml § search L26-34.
  http.get('/api/v1/requests', ({ request }) => {
    const url = new URL(request.url)
    const page = Math.max(1, Number(url.searchParams.get('page') || '1'))
    const limit = Math.max(1, Number(url.searchParams.get('limit') || '10'))
    const type = url.searchParams.get('type')
    const status = url.searchParams.get('status')
    const chain = url.searchParams.get('chain')
    const safeType = url.searchParams.get('safeType')
    const search = url.searchParams.get('search')?.trim().toLowerCase()
    const startDate = url.searchParams.get('startDate')
    const endDate = url.searchParams.get('endDate')

    // Mirror backend USDX-98: date-only, reject datetime → 400; cross-field
    // endDate >= startDate only when both present.
    const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
    if (startDate !== null && !DATE_RE.test(startDate))
      return phaseOneBadRequest('startDate must be YYYY-MM-DD')
    if (endDate !== null && !DATE_RE.test(endDate))
      return phaseOneBadRequest('endDate must be YYYY-MM-DD')
    if (startDate && endDate && endDate < startDate)
      return phaseOneBadRequest('endDate must be greater than or equal to startDate')

    let rows = [...requestList]
    if (type === 'mint' || type === 'burn') rows = rows.filter((r) => r.type === type)
    if (status) rows = rows.filter((r) => r.status === status)
    if (chain) rows = rows.filter((r) => r.chain === chain)
    if (safeType === 'STAFF' || safeType === 'MANAGER') {
      rows = rows.filter((r) => r.safeType === safeType)
    }
    if (startDate) rows = rows.filter((r) => jakartaDate(r.createdAt) >= startDate)
    if (endDate) rows = rows.filter((r) => jakartaDate(r.createdAt) <= endDate)
    if (search) {
      rows = rows.filter(
        (r) =>
          r.userName.toLowerCase().includes(search) ||
          r.userAddress.toLowerCase().includes(search) ||
          r.id.toLowerCase().includes(search)
      )
    }

    const start = (page - 1) * limit
    const data = rows.slice(start, start + limit)

    return HttpResponse.json({
      status: 'success',
      metadata: { page, limit, total: rows.length },
      data,
    })
  }),

  // ─── Phase 2 W1 — KYC backoffice list (sot/api/kyc.yaml § list, USDX-154) ───
  // Real BE in the browser (see src/mocks/browser.ts § INTEGRATION_PATHS);
  // this handler keeps Vitest coverage. The contract exposes no sort params —
  // order is fixed at submitted_at ascending (oldest pending first, week1.md
  // § Backoffice Approval Menu).
  http.get('/api/v1/kyc', ({ request }) => {
    const url = new URL(request.url)
    const page = Math.max(1, Number(url.searchParams.get('page') || '1'))
    const limit = Math.max(1, Number(url.searchParams.get('limit') || '10'))
    const status = url.searchParams.get('status')
    const entityType = url.searchParams.get('entityType')
    const search = url.searchParams.get('search')?.trim().toLowerCase()
    const startDate = url.searchParams.get('startDate')
    const endDate = url.searchParams.get('endDate')

    const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
    if (startDate !== null && !DATE_RE.test(startDate))
      return phaseOneBadRequest('startDate must be YYYY-MM-DD')
    if (endDate !== null && !DATE_RE.test(endDate))
      return phaseOneBadRequest('endDate must be YYYY-MM-DD')
    if (startDate && endDate && endDate < startDate)
      return phaseOneBadRequest('endDate must be greater than or equal to startDate')

    let rows = [...kycList]
    if (status) rows = rows.filter((r) => r.status === status)
    if (entityType) rows = rows.filter((r) => r.entityType === entityType)
    // Search matches user email only (plaintext in `users`) — kyc.yaml § search.
    if (search) rows = rows.filter((r) => r.userEmail.toLowerCase().includes(search))
    if (startDate)
      rows = rows.filter((r) => r.submittedAt && jakartaDate(r.submittedAt) >= startDate)
    if (endDate)
      rows = rows.filter((r) => r.submittedAt && jakartaDate(r.submittedAt) <= endDate)

    rows.sort((a, b) => (a.submittedAt ?? '').localeCompare(b.submittedAt ?? ''))

    const start = (page - 1) * limit
    return HttpResponse.json({
      status: 'success',
      metadata: { page, limit, total: rows.length },
      data: rows.slice(start, start + limit),
    })
  }),

  // ─── USDX-155 — KYC detail / reviews / approve / reject (sot/api/kyc.yaml) ───
  // Real BE in the browser (INTEGRATION_PATHS); handlers kept for Vitest.

  http.get('/api/v1/kyc/:id', ({ request, params }) => {
    const staff = authenticatedStaff(request)
    if (!staff) return unauthorized()
    const detail = kycDetails.get(String(params.id))
    if (!detail) return kycNotFound()
    // Audit-first (kyc.yaml § detail): a VIEWED row is inserted on EVERY call
    // — Developer included, never debounced. Mirrored here so tests can assert
    // the trail grows when the modal (re)fetches.
    kycReviews.get(detail.id)?.unshift(
      createKycReviewLog({
        action: 'VIEWED',
        actorStaffId: staff.id,
        actorStaffName: staff.name,
        ipAddress: null,
        createdAt: new Date().toISOString(),
      })
    )
    return HttpResponse.json({
      status: 'success',
      metadata: null,
      // Presigned URLs are generated per request — stamp a fresh 5-minute TTL.
      data: { ...detail, urlExpiresAt: new Date(Date.now() + 5 * 60_000).toISOString() },
    })
  }),

  http.get('/api/v1/kyc/:id/reviews', ({ request, params }) => {
    const staff = authenticatedStaff(request)
    if (!staff) return unauthorized()
    const rows = kycReviews.get(String(params.id))
    if (!rows) return kycNotFound()
    // Reverse-chronological; reading the trail does NOT write a VIEWED row
    // (kyc.yaml § reviewsHistory).
    return HttpResponse.json({ status: 'success', metadata: null, data: rows })
  }),

  http.post('/api/v1/kyc/:id/approve', ({ request, params }) => {
    const staff = authenticatedStaff(request)
    if (!staff) return unauthorized()
    if (staff.role === 'DEVELOPER') return kycForbidden()
    const detail = kycDetails.get(String(params.id))
    if (!detail) return kycNotFound()
    if (detail.status !== 'PENDING') return kycInvalidStatus()
    const now = new Date().toISOString()
    detail.status = 'VERIFIED'
    detail.reviewedBy = staff.id
    detail.reviewedByName = staff.name
    detail.reviewedAt = now
    detail.updatedAt = now
    const listRow = kycList.find((r) => r.id === detail.id)
    if (listRow) {
      listRow.status = 'VERIFIED'
      listRow.reviewedAt = now
      listRow.reviewedByName = staff.name
    }
    kycReviews.get(detail.id)?.unshift(
      createKycReviewLog({
        action: 'APPROVED',
        actorStaffId: staff.id,
        actorStaffName: staff.name,
        ipAddress: null,
        createdAt: now,
      })
    )
    return HttpResponse.json({ status: 'success', metadata: null, data: listRow ?? detail })
  }),

  http.post('/api/v1/kyc/:id/reject', async ({ request, params }) => {
    const staff = authenticatedStaff(request)
    if (!staff) return unauthorized()
    if (staff.role === 'DEVELOPER') return kycForbidden()
    const detail = kycDetails.get(String(params.id))
    if (!detail) return kycNotFound()
    if (detail.status !== 'PENDING') return kycInvalidStatus()
    let body: { reason?: unknown }
    try {
      body = (await request.json()) as { reason?: unknown }
    } catch {
      return phaseOneBadRequest('Invalid JSON body', 'BAD_REQUEST')
    }
    const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
    if (reason.length < 1 || reason.length > 500) {
      return phaseOneBadRequest('reason must be 1–500 characters', 'BAD_REQUEST')
    }
    const now = new Date().toISOString()
    detail.status = 'REJECTED'
    detail.rejectionReason = reason
    detail.reviewedBy = staff.id
    detail.reviewedByName = staff.name
    detail.reviewedAt = now
    detail.updatedAt = now
    const listRow = kycList.find((r) => r.id === detail.id)
    if (listRow) {
      listRow.status = 'REJECTED'
      listRow.reviewedAt = now
      listRow.reviewedByName = staff.name
    }
    kycReviews.get(detail.id)?.unshift(
      createKycReviewLog({
        action: 'REJECTED',
        actorStaffId: staff.id,
        actorStaffName: staff.name,
        reason,
        ipAddress: null,
        createdAt: now,
      })
    )
    return HttpResponse.json({ status: 'success', metadata: null, data: listRow ?? detail })
  }),

  // ─── Dashboard stats — sot/openapi.yaml § /api/v1/dashboard/stats ───
  http.get('/api/v1/dashboard/stats', () =>
    HttpResponse.json({
      status: 'success',
      metadata: null,
      data: computeDashboardStats(requestList),
    })
  ),

  http.get('/api/v1/requests/:id', ({ params }) => {
    const detail = requestDetails.get(String(params.id))
    if (!detail) {
      return HttpResponse.json(
        { status: 'error', metadata: null, data: null, error: { code: 'NOT_FOUND', message: 'Request not found' } },
        { status: 404 }
      )
    }
    return HttpResponse.json({ status: 'success', metadata: null, data: detail })
  }),

  // ─── Phase 2 W2 — Consumer Orders / "User Transaction" (USDX-206) ───
  // sot/api/orders.yaml. Read-only monitoring; auth = semua role backoffice.
  // Week 2 is mint-only — `type=REDEEM` is accepted (union-ready) but matches
  // nothing until W3. Not bearer-gated in the mock for the same reason as the
  // `/api/v1/requests` list above (real BE enforces 401; this keeps Vitest +
  // dev simple). Param `take` per orders.yaml (`limit` accepted as a fallback).
  http.get('/api/v1/orders', ({ request }) => {
    const url = new URL(request.url)
    const page = Math.max(1, Number(url.searchParams.get('page') || '1'))
    const take = Math.min(
      100,
      Math.max(1, Number(url.searchParams.get('take') || url.searchParams.get('limit') || '10')),
    )
    const type = url.searchParams.get('type')
    const status = url.searchParams.get('status')
    const paymentStatus = url.searchParams.get('paymentStatus')
    const safeStatus = url.searchParams.get('safeStatus')
    const userId = url.searchParams.get('userId')

    let rows = [...orderList]
    if (type) rows = rows.filter((r) => r.type === type)
    if (status) rows = rows.filter((r) => r.status === status)
    if (paymentStatus) rows = rows.filter((r) => r.paymentStatus === paymentStatus)
    if (safeStatus) rows = rows.filter((r) => r.safeStatus === safeStatus)
    if (userId) rows = rows.filter((r) => r.userId === userId)

    const start = (page - 1) * take
    const data = rows.slice(start, start + take)

    return HttpResponse.json({
      status: 'success',
      metadata: { page, limit: take, total: rows.length },
      data,
    })
  }),

  http.get('/api/v1/orders/:id', ({ params }) => {
    const detail = orderDetails.get(String(params.id))
    if (!detail) {
      return HttpResponse.json(
        { status: 'error', metadata: null, data: null, error: { code: 'NOT_FOUND', message: 'Order not found' } },
        { status: 404 },
      )
    }
    return HttpResponse.json({ status: 'success', metadata: null, data: detail })
  }),

  // ─── Phase 1 Users — handlers removed in USDX-47 ───
  // /api/v1/users.* are served by the real BE; the browser bypass is set in
  // src/mocks/browser.ts § INTEGRATION_PATHS. Vitest no longer covers users —
  // E2E spec at e2e/usdx-47.spec.ts replaces the old MSW-backed coverage.

  // ─── Phase 1 Mint Submission (sot/openapi.yaml § POST /api/v1/mint) ───
  // Strict bearer auth (sot/openapi.yaml L13-14 global security).
  // Validates body, computes IDR equivalent, picks Safe by threshold,
  // persists as PENDING_APPROVAL, returns the fresh MintRequest detail.
  // 403 (role insufficient) is intentionally not modeled in the mock — Linear
  // AC #6 only verifies the FE displays the message; tests use server.use().
  http.post('/api/v1/mint', async ({ request }) => {
    const operator = authenticatedStaff(request)
    if (!operator) return unauthorized()

    let body: Partial<{
      userId: string
      userAddress: string
      amount: string
      amountCurrency: 'USD' | 'IDR'
      chain: string
      notes: string
    }>
    try {
      body = (await request.json()) as typeof body
    } catch {
      return phaseOneBadRequest('Request body must be valid JSON', 'BAD_REQUEST')
    }

    // sot/api/mint.yaml § CreateMintRequest — required fields.
    const userId = (body.userId ?? '').trim()
    const userAddress = (body.userAddress ?? '').trim()
    const amountRaw = (body.amount ?? '').trim()
    const amountCurrency = body.amountCurrency
    const chain = (body.chain ?? '').trim()
    if (!userId) return phaseOneBadRequest('userId is required')
    if (!userAddress) return phaseOneBadRequest('userAddress is required')
    if (!/^0x[0-9a-fA-F]{40}$/.test(userAddress)) {
      return phaseOneBadRequest('userAddress must match ^0x[0-9a-fA-F]{40}$')
    }
    const amountNum = Number.parseFloat(amountRaw)
    if (!amountRaw) return phaseOneBadRequest('amount is required')
    if (Number.isNaN(amountNum) || amountNum <= 0) {
      return phaseOneBadRequest('amount must be a positive decimal')
    }
    if (amountCurrency !== 'USD' && amountCurrency !== 'IDR') {
      return phaseOneBadRequest('amountCurrency must be USD or IDR')
    }
    if (!chain) return phaseOneBadRequest('chain is required')

    // sot/api/mint.yaml L8: validate user (kyc_status = VERIFIED, suspended = false).
    const matchedIdx = customerStore.findIndex((c) => c.id === userId)
    if (matchedIdx === -1) {
      return phaseOneBadRequest('User not found', 'NOT_FOUND')
    }
    const matched = customerStore[matchedIdx]!
    const phaseOneUser = customerToPhaseOneUser(matched, matchedIdx + 1)
    if (phaseOneUser.kycStatus !== 'VERIFIED' || phaseOneUser.suspended) {
      return HttpResponse.json(
        {
          status: 'error',
          metadata: null,
          data: null,
          error: {
            code: 'FORBIDDEN',
            message: 'User must be VERIFIED and not suspended',
          },
        },
        { status: 403 }
      )
    }

    // sot/phase-1.md L149-154: USD = 1:1 USDX, IDR → divide by rate.
    const RATE_USD_IDR = 16250
    const amountUsdx =
      amountCurrency === 'USD'
        ? amountRaw
        : (amountNum / RATE_USD_IDR).toFixed(6)
    const amountIdr =
      amountCurrency === 'IDR'
        ? Math.round(amountNum)
        : Math.round(amountNum * RATE_USD_IDR)
    const safeType: 'STAFF' | 'MANAGER' =
      amountIdr >= MANAGER_THRESHOLD_IDR ? 'MANAGER' : 'STAFF'

    const user = { id: matched.id, name: `${matched.firstName} ${matched.lastName}`.trim() }

    const pair = createMintFromRequest(
      user,
      operator,
      { userAddress, amount: amountRaw, amountCurrency, chain, notes: body.notes },
      amountIdr,
      amountUsdx,
      safeType
    )
    requestList.unshift(pair.list)
    requestDetails.set(pair.list.id, pair.detail)

    return HttpResponse.json(
      { status: 'success', metadata: null, data: pair.detail },
      { status: 201 }
    )
  }),

  // sot/openapi.yaml § POST /api/v1/burn — submit burn request (OTC).
  // Bearer auth (global `security: [bearerAuth]`); 400 on shape failures;
  // 403 when submitter role can't handle the IDR amount; 201 returns the
  // strict BurnRequest shape (no display extras).
  http.post('/api/v1/burn', async ({ request }) => {
    const staff = authenticatedStaff(request)
    if (!staff) return unauthorized()

    let body: Partial<{
      userId: string
      userAddress: string
      amount: string
      amountCurrency: 'USD' | 'IDR'
      chain: string
      depositTxHash: string
      bankName: string
      bankAccount: string
      notes: string
    }>
    try {
      body = (await request.json()) as typeof body
    } catch {
      return phaseOneBadRequest('Request body must be valid JSON', 'BAD_REQUEST')
    }

    // sot/api/burn.yaml § CreateBurnRequest — required fields.
    const required = ['userId', 'userAddress', 'amount', 'chain', 'depositTxHash', 'bankName', 'bankAccount'] as const
    for (const key of required) {
      const value = body[key]
      if (typeof value !== 'string' || !value.trim()) {
        return phaseOneBadRequest(`${key} is required`)
      }
    }

    const userId = String(body.userId).trim()
    const userAddress = String(body.userAddress).trim()
    const depositTxHash = String(body.depositTxHash).trim()
    const amount = String(body.amount).trim()
    const amountCurrency = body.amountCurrency
    const chain = String(body.chain) as RequestListItem['chain']

    if (amountCurrency !== 'USD' && amountCurrency !== 'IDR') {
      return phaseOneBadRequest('amountCurrency must be USD or IDR')
    }

    if (!isAddress(userAddress)) {
      return phaseOneBadRequest('Invalid userAddress')
    }

    if (!/^0x[a-fA-F0-9]{64}$/.test(depositTxHash)) {
      return phaseOneBadRequest(
        'Invalid depositTxHash (expected 0x + 64 hex chars)'
      )
    }

    const amountNum = Number(amount)
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      return phaseOneBadRequest('amount must be greater than 0')
    }

    // Phase 1 ships polygon-only (sot/phase-1.md § Smart Contract deliverables).
    if (chain !== 'polygon') {
      return phaseOneBadRequest(
        'Unsupported chain (only polygon is enabled in Phase 1)'
      )
    }

    // sot/api/burn.yaml L8: validate user (kyc_status = VERIFIED, suspended = false).
    const matchedIdx = customerStore.findIndex((c) => c.id === userId)
    if (matchedIdx === -1) {
      return phaseOneBadRequest('User not found', 'NOT_FOUND')
    }
    const matchedUser = customerStore[matchedIdx]!
    const phaseOneUser = customerToPhaseOneUser(matchedUser, matchedIdx + 1)
    if (phaseOneUser.kycStatus !== 'VERIFIED' || phaseOneUser.suspended) {
      return HttpResponse.json(
        {
          status: 'error',
          metadata: null,
          data: null,
          error: {
            code: 'FORBIDDEN',
            message: 'User must be VERIFIED and not suspended',
          },
        },
        { status: 403 }
      )
    }

    const { list, detail } = createBurnRequestFromSubmission(
      {
        userName: phaseOneUser.name ?? phaseOneUser.email,
        userAddress,
        amount,
        amountCurrency,
        chain: 'polygon',
        depositTxHash,
        bankName: String(body.bankName),
        bankAccount: String(body.bankAccount),
        notes: typeof body.notes === 'string' ? body.notes : undefined,
      },
      staff,
      matchedUser
    )

    // sot/openapi.yaml L143 — 403 when submitter role is insufficient for
    // the computed IDR amount. Threshold + role mapping live in roleAuth.
    if (!canHandleAmountIdr(staff.role, Number(detail.amountIdr))) {
      return HttpResponse.json(
        {
          status: 'error',
          metadata: null,
          data: null,
          error: { code: 'FORBIDDEN', message: 'Insufficient role for this amount' },
        },
        { status: 403 }
      )
    }

    requestList.unshift(list)
    requestDetails.set(detail.id, detail)

    // Strip code-side discriminator (`type`) and display-only extras
    // (`userName`) so the POST response matches sot/api/burn.yaml §
    // BurnRequest exactly.
    const { userName: _name, type: _type, ...burnRequest } = detail
    void _name
    void _type

    return HttpResponse.json(
      { status: 'success', metadata: null, data: burnRequest },
      { status: 201 }
    )
  }),

]
