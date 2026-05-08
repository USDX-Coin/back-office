import { http, HttpResponse } from 'msw'
import { isAddress } from 'viem'
import { canHandleAmountIdr } from '@/lib/roleAuth'
import type {
  Customer,
  Staff,
  OtcMintTransaction,
  OtcRedeemTransaction,
  OtcStatus,
  RateConfig,
  RateMode,
  UpdateRateConfig,
  RequestDetail,
  RequestListItem,
  ThresholdConfig,
  ThresholdMode,
  UpdateThresholdConfig,
} from '@/lib/types'
import { canManageRate } from '@/lib/types'
import {
  createMockCustomerList,
  createMockStaffList,
  createMockOtcTransactions,
  createMockRequests,
  createCustomer,
  createUserWallet,
  createOtcMintTransaction,
  createOtcRedeemTransaction,
  createBurnRequestFromSubmission,
  computeCustomerSummary,
  createInitialRateHistory,
  createRateConfig,
  computeRateInfo,
  computeUserAnalytics,
  computeUserRecentRequests,
  computeDashboardStats,
  customerToPhaseOneUser,
  createMintFromRequest,
  MANAGER_THRESHOLD_IDR,
} from './data'

// ─── Stores ───
let customerStore: Customer[] = createMockCustomerList()
let staffStore: Staff[] = createMockStaffList()
let otcMintStore: OtcMintTransaction[]
let otcRedeemStore: OtcRedeemTransaction[]
;({ mints: otcMintStore, redeems: otcRedeemStore } = createMockOtcTransactions(customerStore, staffStore))
let rateHistory: RateConfig[] = createInitialRateHistory(staffStore[0]?.id ?? 'seed')
// SoT phase-1.md § Threshold Configuration L81: default mode=IDR, amount=1B IDR.
let thresholdHistory: ThresholdConfig[] = [
  {
    id: 'thr_seed_1',
    mode: 'IDR',
    amount: '1000000000.00',
    updatedBy: staffStore[0]?.id ?? 'seed',
    createdAt: '2026-01-01T00:00:00Z',
  },
]
let requestList: RequestListItem[]
let requestDetails: Map<string, RequestDetail>
;({ list: requestList, details: requestDetails } = createMockRequests(customerStore, staffStore))

const pendingTimers = new Set<ReturnType<typeof setTimeout>>()

export function resetMockData() {
  customerStore = createMockCustomerList()
  staffStore = createMockStaffList()
  ;({ mints: otcMintStore, redeems: otcRedeemStore } = createMockOtcTransactions(customerStore, staffStore))
  rateHistory = createInitialRateHistory(staffStore[0]?.id ?? 'seed')
  thresholdHistory = [
    {
      id: 'thr_seed_1',
      mode: 'IDR',
      amount: '1000000000.00',
      updatedBy: staffStore[0]?.id ?? 'seed',
      createdAt: '2026-01-01T00:00:00Z',
    },
  ]
  ;({ list: requestList, details: requestDetails } = createMockRequests(customerStore, staffStore))
  pendingTimers.forEach(clearTimeout)
  pendingTimers.clear()
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

function applyCommonFilters<T extends { createdAt: string }>(
  items: T[],
  params: URLSearchParams
): T[] {
  let result = [...items]
  const startDate = params.get('startDate')
  const endDate = params.get('endDate')
  const sortBy = params.get('sortBy')
  const sortOrder = params.get('sortOrder') || 'desc'

  if (startDate) result = result.filter((i) => i.createdAt >= startDate)
  if (endDate) result = result.filter((i) => i.createdAt <= endDate)

  if (sortBy) {
    result.sort((a, b) => {
      const aVal = (a as Record<string, unknown>)[sortBy]
      const bVal = (b as Record<string, unknown>)[sortBy]
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal
      }
      return 0
    })
  }
  return result
}

function badRequest(code: string, message: string, details?: Record<string, string>) {
  return HttpResponse.json({ error: { code, message, details } }, { status: 400 })
}

function notFound() {
  return new HttpResponse(null, { status: 404 })
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

  // ─── Customers (User menu) ───
  http.get('/api/customers', ({ request }) => {
    const url = new URL(request.url)
    const page = Number(url.searchParams.get('page') || '1')
    const pageSize = Number(url.searchParams.get('pageSize') || '10')
    const search = url.searchParams.get('search')?.toLowerCase()
    const type = url.searchParams.get('type')
    const role = url.searchParams.get('role')

    let result = [...customerStore]
    if (search) {
      result = result.filter(
        (c) =>
          c.firstName.toLowerCase().includes(search) ||
          c.lastName.toLowerCase().includes(search) ||
          c.email.toLowerCase().includes(search) ||
          c.wallets.some((w) => w.address.toLowerCase().includes(search))
      )
    }
    if (type) result = result.filter((c) => c.type === type)
    if (role) result = result.filter((c) => c.role === role)
    result = applyCommonFilters(result, url.searchParams)

    return HttpResponse.json(paginate(result, page, pageSize))
  }),

  http.get('/api/customers/summary', () => HttpResponse.json(computeCustomerSummary(customerStore))),

  http.get('/api/customers/:id', ({ params }) => {
    const customer = customerStore.find((c) => c.id === params.id)
    if (!customer) return notFound()
    const analytics = computeUserAnalytics(customer.id, otcMintStore, otcRedeemStore)
    const recentRequests = computeUserRecentRequests(customer.id, otcMintStore, otcRedeemStore)
    return HttpResponse.json({ ...customer, analytics, recentRequests })
  }),

  http.post('/api/customers/:id/wallets', async ({ params, request }) => {
    const customer = customerStore.find((c) => c.id === params.id)
    if (!customer) return notFound()
    const body = (await request.json()) as { chain?: string; address?: string }
    if (!body.chain || !body.address) {
      return badRequest('VALIDATION', 'Chain and address are required')
    }
    const duplicate = customer.wallets.some(
      (w) => w.chain === body.chain && w.address.toLowerCase() === body.address!.toLowerCase()
    )
    if (duplicate) {
      return HttpResponse.json(
        { error: { code: 'CONFLICT', message: 'Wallet already exists for this user' } },
        { status: 409 }
      )
    }
    const wallet = createUserWallet({
      chain: body.chain as Customer['wallets'][number]['chain'],
      address: body.address,
      createdAt: new Date().toISOString(),
    })
    customer.wallets.push(wallet)
    return HttpResponse.json(wallet, { status: 201 })
  }),

  http.delete('/api/customers/:id/wallets/:walletId', ({ params }) => {
    const customer = customerStore.find((c) => c.id === params.id)
    if (!customer) return notFound()
    const idx = customer.wallets.findIndex((w) => w.id === params.walletId)
    if (idx < 0) return notFound()
    customer.wallets.splice(idx, 1)
    return new HttpResponse(null, { status: 204 })
  }),

  http.post('/api/customers', async ({ request }) => {
    const body = (await request.json()) as Partial<Customer>
    if (!body.firstName || !body.lastName || !body.email || !body.type || !body.role) {
      return badRequest('VALIDATION', 'Missing required fields')
    }
    const created = createCustomer({ ...(body as Partial<Customer>), wallets: body.wallets ?? [] })
    customerStore.unshift(created)
    return HttpResponse.json(created, { status: 201 })
  }),

  http.patch('/api/customers/:id', async ({ params, request }) => {
    const tx = customerStore.find((c) => c.id === params.id)
    if (!tx) return notFound()
    const body = (await request.json()) as Partial<Customer>
    Object.assign(tx, body, { id: tx.id })
    return HttpResponse.json(tx)
  }),

  http.delete('/api/customers/:id', ({ params }) => {
    const idx = customerStore.findIndex((c) => c.id === params.id)
    if (idx < 0) return notFound()
    customerStore.splice(idx, 1)
    return new HttpResponse(null, { status: 204 })
  }),

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
          error: { code: 'FORBIDDEN', message: 'Only ADMIN or MANAGER can update rate' },
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
    if (body.spreadPct != null) {
      const n = Number(body.spreadPct)
      if (!Number.isFinite(n) || n < 0) {
        return rateBadRequest('spreadPct must be a non-negative number')
      }
    }

    const created = createRateConfig({
      mode: body.mode as RateMode,
      manualRate: body.mode === 'MANUAL' ? (body.manualRate ?? null) : null,
      spreadPct: body.spreadPct ?? '0',
      updatedBy: operator.id,
      createdAt: new Date().toISOString(),
    })
    rateHistory.push(created)
    return HttpResponse.json(
      { status: 'success', metadata: null, data: created },
      { status: 201 }
    )
  }),

  // ─── Threshold (sot/api/threshold.yaml § /api/v1/threshold) ───
  // GET intentionally not Bearer-gated for the same reason as /api/v1/rate
  // (avoids 401 on AuthProvider boot before apiFetch is wired).
  http.get('/api/v1/threshold', () => {
    const current = thresholdHistory[thresholdHistory.length - 1]
    return HttpResponse.json({
      status: 'success',
      metadata: null,
      data: current,
    })
  }),

  http.post('/api/v1/threshold', async ({ request }) => {
    const operator = authenticatedStaff(request)
    if (!operator) return unauthorized()
    // SoT phase-1.md § Threshold Configuration L78 — only Admin can update.
    if (operator.role !== 'ADMIN') {
      return HttpResponse.json(
        {
          status: 'error',
          metadata: null,
          data: null,
          error: { code: 'FORBIDDEN', message: 'Only ADMIN can update threshold' },
        },
        { status: 403 }
      )
    }

    const body = (await request.json()) as UpdateThresholdConfig

    function thresholdBadRequest(message: string) {
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

    if (body.mode !== 'USD' && body.mode !== 'IDR') {
      return thresholdBadRequest('mode must be USD or IDR')
    }
    const amountNum = Number(body.amount)
    if (!body.amount || !Number.isFinite(amountNum) || amountNum <= 0) {
      return thresholdBadRequest('amount must be a positive number')
    }

    const created: ThresholdConfig = {
      id: `thr_${Date.now()}`,
      mode: body.mode as ThresholdMode,
      amount: body.amount,
      updatedBy: operator.id,
      createdAt: new Date().toISOString(),
    }
    thresholdHistory.push(created)
    return HttpResponse.json(
      { status: 'success', metadata: null, data: created },
      { status: 201 }
    )
  }),

  // ─── Phase 1 Requests (mint/burn approval lifecycle) — see sot/openapi.yaml ───
  http.get('/api/v1/requests', ({ request }) => {
    const url = new URL(request.url)
    const page = Math.max(1, Number(url.searchParams.get('page') || '1'))
    const limit = Math.max(1, Number(url.searchParams.get('limit') || '10'))
    const type = url.searchParams.get('type')
    const status = url.searchParams.get('status')
    const chain = url.searchParams.get('chain')
    const safeType = url.searchParams.get('safeType')

    let rows = [...requestList]
    if (type === 'mint' || type === 'burn') rows = rows.filter((r) => r.type === type)
    if (status) rows = rows.filter((r) => r.status === status)
    if (chain) rows = rows.filter((r) => r.chain === chain)
    if (safeType === 'STAFF' || safeType === 'MANAGER') {
      rows = rows.filter((r) => r.safeType === safeType)
    }

    const start = (page - 1) * limit
    const data = rows.slice(start, start + limit)

    return HttpResponse.json({
      status: 'success',
      metadata: { page, limit, total: rows.length },
      data,
    })
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

  // ─── Phase 1 Users (sot/openapi.yaml § /api/v1/users) ───
  // Strict bearer auth (sot/openapi.yaml L13-14 global security).
  // Returns Phase-1 User entities for the userName autocomplete in the mint
  // and burn request forms.
  // Bearer is not enforced in the mock (matches the /api/v1/rate convention)
  // so React Query's first fetch from a freshly mounted page doesn't 401
  // before AuthProvider wires bindings. Real BE enforces auth — UI handles
  // that path via apiFetch.onUnauthorized.
  http.get('/api/v1/users', ({ request }) => {
    const url = new URL(request.url)
    const search = url.searchParams.get('search')?.trim().toLowerCase() ?? ''
    const kycStatus = url.searchParams.get('kycStatus')
    const entityType = url.searchParams.get('entityType')
    const page = Math.max(1, Number(url.searchParams.get('page') || '1'))
    const limit = Math.max(1, Number(url.searchParams.get('limit') || '10'))

    let users = customerStore.map((c, i) => customerToPhaseOneUser(c, i + 1))
    // sot/api/users.yaml § GET /users — server-side filters: kycStatus, entityType.
    if (kycStatus) users = users.filter((u) => u.kycStatus === kycStatus)
    if (entityType) users = users.filter((u) => u.entityType === entityType)
    // sot/api/users.yaml L9: search by name, email, or wallet address.
    if (search) {
      users = users.filter(
        (u) =>
          u.name.toLowerCase().includes(search) ||
          u.email.toLowerCase().includes(search) ||
          u.wallets.some((w) => w.address.toLowerCase().includes(search))
      )
    }
    const start = (page - 1) * limit
    const data = users.slice(start, start + limit)
    return HttpResponse.json({
      status: 'success',
      metadata: { page, limit, total: users.length },
      data,
    })
  }),

  // GET /api/v1/users/:id — user detail with analytics + recent requests
  // (sot/openapi.yaml § UserDetail). Browser bypasses via INTEGRATION_PATHS;
  // this handler exists only to back vitest-driven UI tests. Bearer is not
  // enforced in the mock (matches the /api/v1/rate convention) so that React
  // Query's first fetch doesn't 401 before AuthProvider wires bindings.
  http.get('/api/v1/users/:id', ({ params }) => {
    const customerIndex = customerStore.findIndex((c) => c.id === String(params.id))
    if (customerIndex === -1) {
      return HttpResponse.json(
        { status: 'error', metadata: null, data: null, error: { code: 'NOT_FOUND', message: 'User not found' } },
        { status: 404 }
      )
    }
    const customer = customerStore[customerIndex]!
    const user = customerToPhaseOneUser(customer, customerIndex + 1)
    const analytics = computeUserAnalytics(customer.id, otcMintStore, otcRedeemStore)
    const recentRequests = requestList
      .filter((r) => r.userName === user.name)
      .slice(0, 5)
    return HttpResponse.json({
      status: 'success',
      metadata: null,
      data: { ...user, analytics, recentRequests },
    })
  }),

  // POST /api/v1/users — create user (sot/openapi.yaml § CreateUser).
  http.post('/api/v1/users', async ({ request }) => {
    if (!authenticatedStaff(request)) return unauthorized()
    const body = (await request.json()) as { name?: string; notes?: string; wallets?: Array<{ chain: string; address: string }> }
    if (!body.name?.trim()) {
      return HttpResponse.json(
        { status: 'error', metadata: null, data: null, error: { code: 'INVALID_INPUT', message: 'Name is required' } },
        { status: 400 }
      )
    }
    const created = createCustomer({
      firstName: body.name.split(' ')[0] ?? body.name,
      lastName: body.name.split(' ').slice(1).join(' '),
      notes: body.notes,
      wallets: (body.wallets ?? []).map((w) =>
        createUserWallet({ chain: w.chain as Customer['wallets'][number]['chain'], address: w.address })
      ),
    })
    customerStore.unshift(created)
    const user = customerToPhaseOneUser(created, customerStore.length)
    return HttpResponse.json(
      { status: 'success', metadata: null, data: user },
      { status: 201 }
    )
  }),

  // PATCH /api/v1/users/:id — update user (sot/openapi.yaml § UpdateUser:
  // only `name` and `notes` are mutable).
  http.patch('/api/v1/users/:id', async ({ params, request }) => {
    if (!authenticatedStaff(request)) return unauthorized()
    const idx = customerStore.findIndex((c) => c.id === String(params.id))
    if (idx === -1) {
      return HttpResponse.json(
        { status: 'error', metadata: null, data: null, error: { code: 'NOT_FOUND', message: 'User not found' } },
        { status: 404 }
      )
    }
    const patch = (await request.json()) as { name?: string; notes?: string }
    const customer = customerStore[idx]!
    if (typeof patch.name === 'string' && patch.name.trim()) {
      const [first, ...rest] = patch.name.trim().split(/\s+/)
      customer.firstName = first ?? customer.firstName
      customer.lastName = rest.join(' ')
    }
    if (typeof patch.notes !== 'undefined') {
      customer.notes = patch.notes
    }
    const user = customerToPhaseOneUser(customer, idx + 1)
    return HttpResponse.json({ status: 'success', metadata: null, data: user })
  }),

  // DELETE /api/v1/users/:id
  http.delete('/api/v1/users/:id', ({ params, request }) => {
    if (!authenticatedStaff(request)) return unauthorized()
    const idx = customerStore.findIndex((c) => c.id === String(params.id))
    if (idx === -1) {
      return HttpResponse.json(
        { status: 'error', metadata: null, data: null, error: { code: 'NOT_FOUND', message: 'User not found' } },
        { status: 404 }
      )
    }
    customerStore.splice(idx, 1)
    return HttpResponse.json({ status: 'success', metadata: null, data: null })
  }),

  // POST /api/v1/users/:id/wallets — add wallet (sot/openapi.yaml).
  // 409 returned when (chain, address) already exists for this user.
  http.post('/api/v1/users/:id/wallets', async ({ params, request }) => {
    if (!authenticatedStaff(request)) return unauthorized()
    const idx = customerStore.findIndex((c) => c.id === String(params.id))
    if (idx === -1) {
      return HttpResponse.json(
        { status: 'error', metadata: null, data: null, error: { code: 'NOT_FOUND', message: 'User not found' } },
        { status: 404 }
      )
    }
    const body = (await request.json()) as { chain?: string; address?: string }
    if (!body.chain || !body.address) {
      return HttpResponse.json(
        { status: 'error', metadata: null, data: null, error: { code: 'INVALID_INPUT', message: 'chain and address are required' } },
        { status: 400 }
      )
    }
    const customer = customerStore[idx]!
    const duplicate = customer.wallets.find(
      (w) => w.chain === body.chain && w.address.toLowerCase() === body.address!.toLowerCase()
    )
    if (duplicate) {
      return HttpResponse.json(
        { status: 'error', metadata: null, data: null, error: { code: 'CONFLICT', message: 'Wallet already exists' } },
        { status: 409 }
      )
    }
    const wallet = createUserWallet({
      chain: body.chain as Customer['wallets'][number]['chain'],
      address: body.address,
    })
    customer.wallets.push(wallet)
    return HttpResponse.json(
      { status: 'success', metadata: null, data: wallet },
      { status: 201 }
    )
  }),

  // DELETE /api/v1/users/:id/wallets/:walletId
  http.delete('/api/v1/users/:id/wallets/:walletId', ({ params, request }) => {
    if (!authenticatedStaff(request)) return unauthorized()
    const idx = customerStore.findIndex((c) => c.id === String(params.id))
    if (idx === -1) {
      return HttpResponse.json(
        { status: 'error', metadata: null, data: null, error: { code: 'NOT_FOUND', message: 'User not found' } },
        { status: 404 }
      )
    }
    const customer = customerStore[idx]!
    const before = customer.wallets.length
    customer.wallets = customer.wallets.filter((w) => w.id !== String(params.walletId))
    if (customer.wallets.length === before) {
      return HttpResponse.json(
        { status: 'error', metadata: null, data: null, error: { code: 'NOT_FOUND', message: 'Wallet not found' } },
        { status: 404 }
      )
    }
    return HttpResponse.json({ status: 'success', metadata: null, data: null })
  }),

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
        userName: phaseOneUser.name,
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
