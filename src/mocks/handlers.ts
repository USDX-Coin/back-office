import { http, HttpResponse } from 'msw'
import type {
  Customer,
  Staff,
  OtcMintTransaction,
  OtcRedeemTransaction,
  OtcStatus,
  RateConfig,
  RateMode,
  UpdateRateConfig,
} from '@/lib/types'
import { canManageRate } from '@/lib/types'
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
  createInitialRateHistory,
  createRateConfig,
  computeRateInfo,
} from './data'

// ─── Stores ───
let customerStore: Customer[] = createMockCustomerList()
let staffStore: Staff[] = createMockStaffList()
let otcMintStore: OtcMintTransaction[]
let otcRedeemStore: OtcRedeemTransaction[]
;({ mints: otcMintStore, redeems: otcRedeemStore } = createMockOtcTransactions(customerStore, staffStore))
let rateHistory: RateConfig[] = createInitialRateHistory(staffStore[0]?.id ?? 'seed')

const pendingTimers = new Set<ReturnType<typeof setTimeout>>()

export function resetMockData() {
  customerStore = createMockCustomerList()
  staffStore = createMockStaffList()
  ;({ mints: otcMintStore, redeems: otcRedeemStore } = createMockOtcTransactions(customerStore, staffStore))
  rateHistory = createInitialRateHistory(staffStore[0]?.id ?? 'seed')
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

  // ─── Rate (sot/openapi.yaml § /api/v1/rate) ───
  http.get('/api/v1/rate', () => HttpResponse.json({ data: computeRateInfo(rateHistory) })),

  http.post('/api/v1/rate', async ({ request }) => {
    const body = (await request.json()) as UpdateRateConfig & {
      operatorStaffId?: string
    }

    // Auth gate mirrors backend 403: ADMIN/MANAGER only. The operatorStaffId
    // is sent by the client (mock auth has no JWT) so the mock can enforce
    // the same role check the backend would. UI gating is the primary
    // defense; this is defense-in-depth so tests can cover the 403 branch.
    const operator = body.operatorStaffId
      ? staffStore.find((s) => s.id === body.operatorStaffId)
      : null
    if (!operator || !canManageRate(operator.role)) {
      return HttpResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Only ADMIN or MANAGER can update rate' } },
        { status: 403 }
      )
    }

    if (body.mode !== 'MANUAL' && body.mode !== 'DYNAMIC') {
      return badRequest('VALIDATION', 'mode must be MANUAL or DYNAMIC')
    }
    if (body.mode === 'MANUAL') {
      const n = Number(body.manualRate)
      if (!body.manualRate || !Number.isFinite(n) || n <= 0) {
        return badRequest('VALIDATION', 'manualRate is required when mode is MANUAL')
      }
    }
    if (body.spreadPct != null) {
      const n = Number(body.spreadPct)
      if (!Number.isFinite(n) || n < 0) {
        return badRequest('VALIDATION', 'spreadPct must be a non-negative number')
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
    return HttpResponse.json({ data: created }, { status: 201 })
  }),
]
