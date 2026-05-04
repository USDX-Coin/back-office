import { http, HttpResponse } from 'msw'
import type {
  Customer,
  Staff,
  OtcMintTransaction,
  OtcRedeemTransaction,
  OtcStatus,
  RequestDetail,
  RequestListItem,
} from '@/lib/types'
import {
  createMockCustomerList,
  createMockStaffList,
  createMockOtcTransactions,
  createMockRequests,
  createCustomer,
  createStaff,
  createUserWallet,
  createOtcMintTransaction,
  createOtcRedeemTransaction,
  computeCustomerSummary,
  computeStaffSummary,
  computeReportRows,
  computeReportInsights,
  computeDashboardSnapshot,
  computeUserAnalytics,
  computeUserRecentRequests,
} from './data'

// ─── Stores ───
let customerStore: Customer[] = createMockCustomerList()
let staffStore: Staff[] = createMockStaffList()
let otcMintStore: OtcMintTransaction[]
let otcRedeemStore: OtcRedeemTransaction[]
;({ mints: otcMintStore, redeems: otcRedeemStore } = createMockOtcTransactions(customerStore, staffStore))
let requestList: RequestListItem[]
let requestDetails: Map<string, RequestDetail>
;({ list: requestList, details: requestDetails } = createMockRequests(customerStore, staffStore))

const pendingTimers = new Set<ReturnType<typeof setTimeout>>()

export function resetMockData() {
  customerStore = createMockCustomerList()
  staffStore = createMockStaffList()
  ;({ mints: otcMintStore, redeems: otcRedeemStore } = createMockOtcTransactions(customerStore, staffStore))
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

// Browser dev hook for the E2E smoke spec
if (typeof window !== 'undefined') {
  ;(window as unknown as { __mswFlushSettlement?: typeof flushSettlement }).__mswFlushSettlement =
    flushSettlement
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

  // ─── Staff ───
  http.get('/api/staff', ({ request }) => {
    const url = new URL(request.url)
    const page = Number(url.searchParams.get('page') || '1')
    const pageSize = Number(url.searchParams.get('pageSize') || '10')
    const search = url.searchParams.get('search')?.toLowerCase()
    const role = url.searchParams.get('role')

    let result = [...staffStore]
    if (search) {
      result = result.filter(
        (s) =>
          s.firstName.toLowerCase().includes(search) ||
          s.lastName.toLowerCase().includes(search) ||
          s.email.toLowerCase().includes(search)
      )
    }
    if (role) result = result.filter((s) => s.role === role)
    result = applyCommonFilters(result, url.searchParams)

    return HttpResponse.json(paginate(result, page, pageSize))
  }),

  http.get('/api/staff/summary', () => HttpResponse.json(computeStaffSummary(staffStore))),

  http.post('/api/staff', async ({ request }) => {
    const body = (await request.json()) as Partial<Staff>
    if (!body.firstName || !body.lastName || !body.email || !body.role) {
      return badRequest('VALIDATION', 'Missing required fields')
    }
    const created = createStaff(body as Partial<Staff>)
    staffStore.unshift(created)
    return HttpResponse.json(created, { status: 201 })
  }),

  http.patch('/api/staff/:id', async ({ params, request }) => {
    const tx = staffStore.find((s) => s.id === params.id)
    if (!tx) return notFound()
    const body = (await request.json()) as Partial<Staff>
    Object.assign(tx, body, { id: tx.id })
    return HttpResponse.json(tx)
  }),

  http.delete('/api/staff/:id', ({ params }) => {
    const idx = staffStore.findIndex((s) => s.id === params.id)
    if (idx < 0) return notFound()
    staffStore.splice(idx, 1)
    return new HttpResponse(null, { status: 204 })
  }),

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

  // ─── Dashboard (derived OTC snapshot — used by redesigned DashboardPage in Unit 13) ───
  http.get('/api/dashboard/snapshot', () =>
    HttpResponse.json(computeDashboardSnapshot(customerStore, otcMintStore, otcRedeemStore))
  ),

  // ─── Report (derived union) ───
  http.get('/api/report', ({ request }) => {
    const url = new URL(request.url)
    const page = Number(url.searchParams.get('page') || '1')
    const pageSize = Number(url.searchParams.get('pageSize') || '10')
    const type = url.searchParams.get('type')
    const status = url.searchParams.get('status')
    const customerId = url.searchParams.get('customerId')
    const search = url.searchParams.get('search')?.toLowerCase()
    const startDate = url.searchParams.get('startDate')
    const endDate = url.searchParams.get('endDate')

    let rows = computeReportRows(otcMintStore, otcRedeemStore)
    if (type === 'mint' || type === 'redeem') rows = rows.filter((r) => r.kind === type)
    if (status) rows = rows.filter((r) => r.status === status)
    if (customerId) rows = rows.filter((r) => r.customerId === customerId)
    if (search) {
      rows = rows.filter(
        (r) =>
          r.txHash.toLowerCase().includes(search) ||
          r.customerName.toLowerCase().includes(search)
      )
    }
    if (startDate) rows = rows.filter((r) => r.createdAt >= startDate)
    if (endDate) rows = rows.filter((r) => r.createdAt <= endDate)

    return HttpResponse.json(paginate(rows, page, pageSize))
  }),

  http.get('/api/report/insights', ({ request }) => {
    const url = new URL(request.url)
    const type = url.searchParams.get('type')
    const status = url.searchParams.get('status')
    const customerId = url.searchParams.get('customerId')
    const startDate = url.searchParams.get('startDate')
    const endDate = url.searchParams.get('endDate')

    let rows = computeReportRows(otcMintStore, otcRedeemStore)
    if (type === 'mint' || type === 'redeem') rows = rows.filter((r) => r.kind === type)
    if (status) rows = rows.filter((r) => r.status === status)
    if (customerId) rows = rows.filter((r) => r.customerId === customerId)
    if (startDate) rows = rows.filter((r) => r.createdAt >= startDate)
    if (endDate) rows = rows.filter((r) => r.createdAt <= endDate)

    return HttpResponse.json(computeReportInsights(rows))
  }),

  // ─── Profile (returns the demo "logged-in" staff + recent activity) ───
  http.get('/api/profile/:id', ({ params }) => {
    const staff = staffStore.find((s) => s.id === params.id)
    if (!staff) return notFound()
    const all = [...otcMintStore, ...otcRedeemStore]
      .filter((t) => t.operatorStaffId === staff.id)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, 3)
    return HttpResponse.json({ staff, recentActivity: all })
  }),

  http.patch('/api/profile/:id', async ({ params, request }) => {
    const staff = staffStore.find((s) => s.id === params.id)
    if (!staff) return notFound()
    const body = (await request.json()) as Partial<Staff>
    Object.assign(staff, body, { id: staff.id, email: staff.email })
    if (body.firstName || body.lastName) {
      staff.displayName = `${staff.firstName} ${staff.lastName}`.trim()
    }
    return HttpResponse.json(staff)
  }),

  // ─── Notifications (cosmetic-only, static count per Q4 plan decision) ───
  http.get('/api/notifications/count', () => HttpResponse.json({ count: 3 })),

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
]
