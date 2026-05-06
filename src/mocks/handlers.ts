import { http, HttpResponse } from 'msw'
import type {
  Customer,
  Staff,
  OtcMintTransaction,
  OtcRedeemTransaction,
  OtcStatus,
} from '@/lib/types'
import {
  createMockCustomerList,
  createMockStaffList,
  createMockOtcTransactions,
  createCustomer,
  createOtcMintTransaction,
  createOtcRedeemTransaction,
  computeCustomerSummary,
  computeDashboardSnapshot,
} from './data'

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

  // USDX-41: /api/staff/* mock removed. StaffPage now hits real GET /api/v1/staff.

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

  // USDX-41: /api/profile/* mock removed. ProfilePage now uses useAuth().user
  // (sourced from real GET /api/v1/auth/me).

  // ─── Notifications (cosmetic-only, static count per Q4 plan decision) ───
  http.get('/api/notifications/count', () => HttpResponse.json({ count: 3 })),

  // USDX-39: NO MSW handlers for /api/v1/* — this feature is integration-only,
  // dev/prod/tests must all hit the real BE.
]
