import { http, HttpResponse } from 'msw'
import type {
  AuthStaff,
  Customer,
  Staff,
  OtcMintTransaction,
  OtcRedeemTransaction,
  OtcStatus,
  RequestListItem,
} from '@/lib/types'
import {
  createMockCustomerList,
  createMockStaffList,
  createMockOtcTransactions,
  createCustomer,
  createStaff,
  createOtcMintTransaction,
  createOtcRedeemTransaction,
  computeCustomerSummary,
  computeStaffSummary,
  computeReportRows,
  computeReportInsights,
  computeDashboardSnapshot,
} from './data'

// ─── USDX-39: SoT v1 fixtures + helpers (test-only) ───

const TEST_AUTH_STAFF: AuthStaff = {
  id: '00000000-0000-7000-8000-000000000001',
  name: 'Demo Operator',
  email: 'demo@usdx.io',
  role: 'ADMIN',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

export const TEST_VALID_PASSWORD = 'password123'
export const TEST_AUTH_TOKEN = 'test-jwt-token'

export function getTestAuthStaff(): AuthStaff {
  return TEST_AUTH_STAFF
}

const TEST_REQUESTS: RequestListItem[] = [
  {
    id: '00000000-0000-7100-8000-000000000010',
    type: 'mint',
    userId: '00000000-0000-7100-8000-000000000aaa',
    userName: 'Alice',
    userAddress: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
    amount: '1000.00',
    amountIdr: '16250000.00',
    chain: 'polygon',
    safeType: 'STAFF',
    status: 'PENDING_APPROVAL',
    createdBy: TEST_AUTH_STAFF.id,
    createdAt: '2026-05-01T10:00:00.000Z',
  },
  {
    id: '00000000-0000-7100-8000-000000000011',
    type: 'mint',
    userId: '00000000-0000-7100-8000-000000000aab',
    userName: 'Bob',
    userAddress: '0x000000000000000000000000000000000000dEaD',
    amount: '5000.00',
    amountIdr: '81250000.00',
    chain: 'polygon',
    safeType: 'STAFF',
    status: 'EXECUTED',
    createdBy: TEST_AUTH_STAFF.id,
    createdAt: '2026-05-02T11:00:00.000Z',
  },
  {
    id: '00000000-0000-7100-8000-000000000012',
    type: 'burn',
    userId: '00000000-0000-7100-8000-000000000aac',
    userName: 'Carol',
    userAddress: '0x1111111111111111111111111111111111111111',
    amount: '500.00',
    amountIdr: '8125000.00',
    chain: 'polygon',
    safeType: 'STAFF',
    status: 'EXECUTED',
    createdBy: TEST_AUTH_STAFF.id,
    createdAt: '2026-05-03T12:00:00.000Z',
  },
]

export function getTestRequests(): RequestListItem[] {
  return TEST_REQUESTS
}

function v1ErrorResponse(code: string, message: string, status: number) {
  return HttpResponse.json(
    { status: 'error', metadata: null, data: null, error: { code, message } },
    { status },
  )
}

function requireBearer(request: Request) {
  const auth = request.headers.get('Authorization')
  if (!auth || !auth.startsWith('Bearer ')) return false
  return true
}

const v1Handlers = [
  http.post('*/api/v1/auth/login', async ({ request }) => {
    const body = (await request.json()) as { email?: string; password?: string }
    if (!body?.email || body.password !== TEST_VALID_PASSWORD) {
      return v1ErrorResponse('UNAUTHORIZED', 'Invalid credentials', 401)
    }
    return HttpResponse.json({
      status: 'success',
      metadata: null,
      data: { accessToken: TEST_AUTH_TOKEN, staff: TEST_AUTH_STAFF },
    })
  }),

  http.get('*/api/v1/auth/me', ({ request }) => {
    if (!requireBearer(request))
      return v1ErrorResponse('UNAUTHORIZED', 'Missing token', 401)
    return HttpResponse.json({
      status: 'success',
      metadata: null,
      data: TEST_AUTH_STAFF,
    })
  }),

  http.get('*/api/v1/requests', ({ request }) => {
    if (!requireBearer(request))
      return v1ErrorResponse('UNAUTHORIZED', 'Missing token', 401)
    const url = new URL(request.url)
    const type = url.searchParams.get('type')
    const status = url.searchParams.get('status')
    const page = Math.max(1, Number(url.searchParams.get('page') ?? '1') || 1)
    const limit = Math.max(
      1,
      Math.min(100, Number(url.searchParams.get('limit') ?? '10') || 10),
    )
    let rows = TEST_REQUESTS
    if (type) rows = rows.filter((r) => r.type === type)
    if (status) rows = rows.filter((r) => r.status === status)
    const total = rows.length
    const start = (page - 1) * limit
    const slice = rows.slice(start, start + limit)
    return HttpResponse.json({
      status: 'success',
      metadata: { page, limit, total },
      data: slice,
    })
  }),

  http.get('*/api/v1/requests/:id', ({ params, request }) => {
    if (!requireBearer(request))
      return v1ErrorResponse('UNAUTHORIZED', 'Missing token', 401)
    const item = TEST_REQUESTS.find((r) => r.id === params.id)
    if (!item) return v1ErrorResponse('NOT_FOUND', 'Resource not found', 404)
    const detail = {
      ...item,
      idempotencyKey:
        '0x0000000000000000000000000000000001902a3b4c5d7e6f8a9b0c1d2e3f4a5b',
      amountWei: '1000000000',
      rateUsed: '16250.00',
      notes: null,
      safeTxHash: null,
      onChainTxHash: null,
      updatedAt: item.createdAt,
      ...(item.type === 'burn'
        ? {
            depositTxHash: '0xabc123' + '0'.repeat(58),
            bankName: 'BCA',
            bankAccount: '1234567890',
          }
        : {}),
    }
    return HttpResponse.json({
      status: 'success',
      metadata: null,
      data: detail,
    })
  }),
]

// ─── Stores ───
let customerStore: Customer[] = createMockCustomerList()
let staffStore: Staff[] = createMockStaffList()
let otcMintStore: OtcMintTransaction[]
let otcRedeemStore: OtcRedeemTransaction[]
;({ mints: otcMintStore, redeems: otcRedeemStore } = createMockOtcTransactions(customerStore, staffStore))

const pendingTimers = new Set<ReturnType<typeof setTimeout>>()

export function resetMockData() {
  customerStore = createMockCustomerList()
  staffStore = createMockStaffList()
  ;({ mints: otcMintStore, redeems: otcRedeemStore } = createMockOtcTransactions(customerStore, staffStore))
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

// ─── Handlers ───

export const handlers = [
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
          c.email.toLowerCase().includes(search)
      )
    }
    if (type) result = result.filter((c) => c.type === type)
    if (role) result = result.filter((c) => c.role === role)
    result = applyCommonFilters(result, url.searchParams)

    return HttpResponse.json(paginate(result, page, pageSize))
  }),

  http.get('/api/customers/summary', () => HttpResponse.json(computeCustomerSummary(customerStore))),

  http.post('/api/customers', async ({ request }) => {
    const body = (await request.json()) as Partial<Customer>
    if (!body.firstName || !body.lastName || !body.email || !body.type || !body.role) {
      return badRequest('VALIDATION', 'Missing required fields')
    }
    const created = createCustomer(body as Partial<Customer>)
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

  // ─── USDX-39: SoT v1 handlers (test-only; runtime hits real Railway BE) ───
  ...v1Handlers,
]
