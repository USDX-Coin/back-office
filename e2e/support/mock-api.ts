import type { Page, Route } from '@playwright/test'

// ─────────────────────────────────────────────────────────────────────────────
// Hermetic mock of the Phase-1 API for E2E.
//
// Playwright intercepts `**/api/v1/**` at the network layer. The dev server runs
// the MSW browser worker, but the paths exercised here (auth, requests, mint,
// burn, users, dashboard, rate, chains, threshold, staff) are all in MSW's
// `INTEGRATION_PATHS` bypass list — MSW lets them hit the network, so these
// routes win. The result is a self-contained suite that runs in CI with no
// backend / credentials and produces zero on-chain side effects (mint/burn
// "submission" is mocked — see USDX-26 PR notes for the rationale).
//
// State is per-`installMockApi` call (i.e. per test). Pass `users` / `requests`
// to pre-seed, or `routes` to force error/edge responses for a single endpoint.
// ─────────────────────────────────────────────────────────────────────────────

export const MOCK_TOKEN = 'mock-e2e-token'

export const ADMIN_STAFF = {
  id: '00000000-0000-7000-8000-0000000000a1',
  name: 'System Admin',
  email: 'admin@usdx.io',
  role: 'ADMIN' as const,
  isActive: true,
  createdAt: '2026-05-01T00:00:00.000Z',
  updatedAt: '2026-05-01T00:00:00.000Z',
}

export const POLYGON_CHAIN = {
  chain: 'polygon',
  chainId: 137,
  name: 'Polygon',
  blockExplorerUrl: 'https://polygonscan.com',
  staffSafeAddress: '0xaA3e70397F3668D6Fd9C25e36a6FB151241EE015',
  managerSafeAddress: '0xbB3e70397F3668D6Fd9C25e36a6FB151241EE015',
  usdxAddress: '0x2702d7043693651BB8A3D2Ec1C296B20692C7426',
}

export const VERIFIED_USER = {
  id: '00000000-0000-7000-8000-0000000000d1',
  name: 'Robert Deon',
  email: 'robert.deon@example.com',
  entityType: 'INDIVIDUAL' as const,
  kycStatus: 'VERIFIED' as const,
  suspended: false,
  notes: null as string | null,
  wallets: [
    {
      id: 'wal_polygon_d1',
      chain: 'polygon',
      address: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const RATE_INFO = { rate: '16250.0000', mode: 'MANUAL' as const, spreadPct: '0', updatedAt: '2026-05-01T00:00:00.000Z' }
const THRESHOLD = { id: 'thr_1', mode: 'IDR' as const, amount: '1000000000', updatedBy: ADMIN_STAFF.id, createdAt: '2026-05-01T00:00:00.000Z' }
const DASHBOARD_STATS = {
  totalSupply: '1000000.00',
  totalMinted: '1200000.00',
  totalBurned: '200000.00',
  pendingRequests: 2,
  requestsByStatus: { PENDING_APPROVAL: 2, APPROVED: 1, EXECUTED: 4, REJECTED: 1 },
  safeBalances: { staff: '750000.00', manager: '5250000.00' },
  currentRate: '16250.00',
}

const HEX64 = (c: string) => '0x' + c.repeat(64)

interface MockRequest {
  id: string
  type: 'mint' | 'burn'
  userId: string
  userName: string
  userAddress: string
  amount: string
  amountWei: string
  amountIdr: string
  inputCurrency: 'USD' | 'IDR'
  rateUsed: string
  chain: string
  notes: string | null
  safeType: 'STAFF' | 'MANAGER'
  status: string
  safeTxHash: string | null
  onChainTxHash: string | null
  depositTxHash?: string
  bankName?: string
  bankAccount?: string
  createdBy: string
  createdAt: string
  updatedAt: string
  idempotencyKey: string
}

function listItem(r: MockRequest) {
  return {
    id: r.id, type: r.type, userId: r.userId, userName: r.userName, userAddress: r.userAddress,
    amount: r.amount, amountIdr: r.amountIdr, inputCurrency: r.inputCurrency, chain: r.chain,
    safeType: r.safeType, status: r.status, safeTxHash: r.safeTxHash, onChainTxHash: r.onChainTxHash,
    createdBy: r.createdBy, createdAt: r.createdAt,
  }
}

function detailItem(r: MockRequest) {
  const base = {
    id: r.id, type: r.type, idempotencyKey: r.idempotencyKey, userId: r.userId, userName: r.userName,
    userAddress: r.userAddress, amount: r.amount, amountWei: r.amountWei, amountIdr: r.amountIdr,
    inputCurrency: r.inputCurrency, rateUsed: r.rateUsed, chain: r.chain, notes: r.notes,
    safeType: r.safeType, status: r.status, safeTxHash: r.safeTxHash, onChainTxHash: r.onChainTxHash,
    createdBy: r.createdBy, createdAt: r.createdAt, updatedAt: r.updatedAt,
  }
  return r.type === 'burn'
    ? { ...base, depositTxHash: r.depositTxHash, bankName: r.bankName, bankAccount: r.bankAccount }
    : base
}

function seedRequests(): MockRequest[] {
  const mk = (over: Partial<MockRequest>): MockRequest => ({
    id: over.id!, type: 'mint', userId: VERIFIED_USER.id, userName: VERIFIED_USER.name,
    userAddress: VERIFIED_USER.wallets[0].address, amount: '100.000000', amountWei: '100000000',
    amountIdr: '1625000.00', inputCurrency: 'USD', rateUsed: '16250.0000', chain: 'polygon',
    notes: null, safeType: 'STAFF', status: 'EXECUTED', safeTxHash: HEX64('a'), onChainTxHash: HEX64('b'),
    createdBy: ADMIN_STAFF.id, createdAt: '2026-05-10T10:00:00.000Z', updatedAt: '2026-05-10T10:00:00.000Z',
    idempotencyKey: HEX64('0'), ...over,
  })
  return [
    mk({ id: 'req_mint_executed', amount: '1000.000000', amountIdr: '16250000.00' }),
    mk({ id: 'req_mint_pending', status: 'PENDING_APPROVAL', onChainTxHash: null, createdAt: '2026-05-11T09:00:00.000Z' }),
    mk({ id: 'req_mint_rejected', status: 'REJECTED', safeTxHash: null, onChainTxHash: null, createdAt: '2026-05-09T08:00:00.000Z' }),
    mk({ id: 'req_burn_executed', type: 'burn', status: 'IDR_TRANSFERRED', amount: '50.000000', amountIdr: '812500.00', safeType: 'MANAGER', depositTxHash: HEX64('c'), bankName: 'BCA', bankAccount: '1234567890', createdAt: '2026-05-11T11:00:00.000Z' }),
    mk({ id: 'req_burn_pending', type: 'burn', status: 'PENDING_APPROVAL', onChainTxHash: null, amount: '10.000000', amountIdr: '162500.00', depositTxHash: HEX64('d'), bankName: 'Mandiri', bankAccount: '9876543210', createdAt: '2026-05-11T07:30:00.000Z' }),
  ]
}

type RouteOverride = (route: Route, url: URL) => Promise<boolean | void> | boolean | void

export interface MockApiOptions {
  /** Pre-seed extra users into the directory. */
  users?: (typeof VERIFIED_USER)[]
  /** Replace the seeded request list. */
  requests?: MockRequest[]
  /** Override a single endpoint, keyed by `"METHOD /api/v1/path"`. Return `true` if handled. */
  routes?: Record<string, RouteOverride>
}

export interface MockApiState {
  users: (typeof VERIFIED_USER)[]
  requests: MockRequest[]
}

export async function installMockApi(page: Page, opts: MockApiOptions = {}): Promise<MockApiState> {
  const state: MockApiState = {
    users: [VERIFIED_USER, ...(opts.users ?? [])],
    requests: opts.requests ?? seedRequests(),
  }

  const envelope = (route: Route, data: unknown, status = 200) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ status: 'success', metadata: null, data }) })
  const paginated = (route: Route, items: unknown[], pageNum: number, limit: number) =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ status: 'success', metadata: { page: pageNum, limit, total: items.length }, data: items.slice((pageNum - 1) * limit, pageNum * limit) }),
    })
  const error = (route: Route, code: string, message: string, status: number) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ status: 'error', metadata: null, data: null, error: { code, message } }) })
  const noContent = (route: Route) => route.fulfill({ status: 204, body: '' })

  await page.route(
    (u) => u.pathname.startsWith('/api/v1/'),
    async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const path = url.pathname
    const method = req.method()
    const key = `${method} ${path}`
    const body = () => { try { return JSON.parse(req.postData() ?? '{}') } catch { return {} } }

    const override = opts.routes?.[key]
    if (override) { const handled = await override(route, url); if (handled === true) return }

    // ── Auth ──────────────────────────────────────────────────────────────
    if (key === 'POST /api/v1/auth/login') {
      const b = body()
      if (!b.email || !b.password) return error(route, 'VALIDATION_ERROR', 'Email and password are required', 400)
      if (b.password !== 'admin123456' && b.password !== MOCK_TOKEN) return error(route, 'UNAUTHORIZED', 'Invalid credentials', 401)
      return envelope(route, { accessToken: MOCK_TOKEN, staff: { ...ADMIN_STAFF, email: b.email } })
    }
    if (key === 'GET /api/v1/auth/me') {
      const auth = req.headers()['authorization'] ?? ''
      if (!auth.startsWith('Bearer ')) return error(route, 'UNAUTHORIZED', 'UNAUTHORIZED', 401)
      return envelope(route, ADMIN_STAFF)
    }
    if (key === 'POST /api/v1/auth/logout') return noContent(route)

    // ── Dashboard / rate / chains / threshold ─────────────────────────────
    if (key === 'GET /api/v1/dashboard/stats') return envelope(route, DASHBOARD_STATS)
    if (key === 'GET /api/v1/rate') return envelope(route, RATE_INFO)
    if (key === 'GET /api/v1/chains') return envelope(route, [POLYGON_CHAIN])
    if (key === 'GET /api/v1/threshold') return envelope(route, THRESHOLD)
    if (key === 'GET /api/v1/staff') return paginated(route, [ADMIN_STAFF], 1, 50)

    // ── Users ─────────────────────────────────────────────────────────────
    if (method === 'GET' && path === '/api/v1/users') {
      const search = url.searchParams.get('search')?.toLowerCase()
      const kyc = url.searchParams.get('kycStatus')
      const entity = url.searchParams.get('entityType')
      let list = [...state.users]
      if (search) list = list.filter((u) => u.name.toLowerCase().includes(search) || u.email.toLowerCase().includes(search))
      if (kyc) list = list.filter((u) => u.kycStatus === kyc)
      if (entity) list = list.filter((u) => u.entityType === entity)
      return paginated(route, list, Number(url.searchParams.get('page') ?? '1'), Number(url.searchParams.get('limit') ?? '20'))
    }
    if (key === 'POST /api/v1/users') {
      const b = body()
      if (state.users.some((u) => u.email.toLowerCase() === String(b.email ?? '').toLowerCase())) return error(route, 'CONFLICT', 'A user with this email already exists', 409)
      const created = {
        id: `usr_${Date.now()}`, name: b.name, email: b.email, entityType: b.entityType ?? 'INDIVIDUAL',
        kycStatus: 'UNVERIFIED' as const, suspended: false, notes: b.notes ?? null, wallets: [],
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      }
      state.users.unshift(created as never)
      return envelope(route, { ...created, password: 'Temp1234-Pass9876' }, 201)
    }
    const userIdMatch = path.match(/^\/api\/v1\/users\/([^/]+)$/)
    if (userIdMatch) {
      const id = userIdMatch[1]
      const idx = state.users.findIndex((u) => u.id === id)
      if (method === 'GET') {
        if (idx < 0) return error(route, 'NOT_FOUND', 'User not found', 404)
        return envelope(route, { ...state.users[idx], analytics: { totalMinted: '0', totalBurned: '0', totalTransactions: 0 }, recentRequests: [] })
      }
      if (method === 'PATCH') {
        if (idx < 0) return error(route, 'NOT_FOUND', 'User not found', 404)
        state.users[idx] = { ...state.users[idx], ...body(), updatedAt: new Date().toISOString() }
        return envelope(route, state.users[idx])
      }
      if (method === 'DELETE') {
        state.users = state.users.filter((u) => u.id !== id)
        return noContent(route)
      }
    }

    // ── Requests list / detail ────────────────────────────────────────────
    if (method === 'GET' && path === '/api/v1/requests') {
      const type = url.searchParams.get('type')
      const status = url.searchParams.get('status')
      const chain = url.searchParams.get('chain')
      const safeType = url.searchParams.get('safeType')
      const search = url.searchParams.get('search')?.toLowerCase()
      let list = [...state.requests]
      if (type === 'mint' || type === 'burn') list = list.filter((r) => r.type === type)
      if (status) list = list.filter((r) => r.status === status)
      if (chain) list = list.filter((r) => r.chain === chain)
      if (safeType === 'STAFF' || safeType === 'MANAGER') list = list.filter((r) => r.safeType === safeType)
      if (search) list = list.filter((r) => r.userName.toLowerCase().includes(search) || r.userAddress.toLowerCase().includes(search))
      list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      return paginated(route, list.map(listItem), Number(url.searchParams.get('page') ?? '1'), Number(url.searchParams.get('limit') ?? '20'))
    }
    const reqIdMatch = path.match(/^\/api\/v1\/requests\/([^/]+)$/)
    if (method === 'GET' && reqIdMatch) {
      const r = state.requests.find((x) => x.id === reqIdMatch[1])
      if (!r) return error(route, 'NOT_FOUND', 'Request not found', 404)
      return envelope(route, detailItem(r))
    }

    // ── Mint / burn submission ────────────────────────────────────────────
    if (key === 'POST /api/v1/mint' || key === 'POST /api/v1/burn') {
      const b = body()
      const type = key.endsWith('mint') ? 'mint' : 'burn'
      const id = `${type}_${Date.now()}`
      const usdx = b.amountCurrency === 'IDR'
        ? (Number.parseFloat(b.amount) / Number.parseFloat(RATE_INFO.rate)).toFixed(6)
        : Number.parseFloat(b.amount).toFixed(6)
      const idr = b.amountCurrency === 'IDR'
        ? Number.parseFloat(b.amount).toFixed(2)
        : (Number.parseFloat(usdx) * Number.parseFloat(RATE_INFO.rate)).toFixed(2)
      const u = state.users.find((x) => x.id === b.userId)
      const created: MockRequest = {
        id, type, idempotencyKey: HEX64('1'), userId: b.userId, userName: u?.name ?? 'Unknown',
        userAddress: b.userAddress, amount: usdx, amountWei: String(Math.round(Number.parseFloat(usdx) * 1e6)),
        amountIdr: idr, inputCurrency: b.amountCurrency, rateUsed: RATE_INFO.rate, chain: b.chain,
        notes: b.notes ?? null, safeType: Number(idr) >= 1_000_000_000 ? 'MANAGER' : 'STAFF', status: 'PENDING_APPROVAL',
        safeTxHash: HEX64('e'), onChainTxHash: null, createdBy: ADMIN_STAFF.id,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        ...(type === 'burn' ? { depositTxHash: b.depositTxHash, bankName: b.bankName, bankAccount: b.bankAccount } : {}),
      }
      state.requests.unshift(created)
      return envelope(route, detailItem(created), 201)
    }

    // ── Fallback ──────────────────────────────────────────────────────────
    return error(route, 'NOT_IMPLEMENTED', `mock-api: unhandled ${key}`, 501)
  })

  return state
}
