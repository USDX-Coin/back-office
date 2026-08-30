import { describe, test, expect, beforeAll, afterAll, afterEach, beforeEach } from 'vitest'
import { server } from '@/mocks/server'
import {
  handlers,
  resetMockData,
  clearActiveRequestsForTests,
  flushSettlement,
  issueMockJwt,
  getDefaultStaff,
  findStaffById,
} from '@/mocks/handlers'
import type { Staff } from '@/lib/types'

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  resetMockData()
})
afterAll(() => server.close())

// USDX-23: /api/customers/* tests removed — handlers gone (SoT /api/v1/users
// replaced legacy mock domain in USDX-37 + USDX-47).
// USDX-41: /api/staff/* mock endpoints removed; staff list now hits real BE.

describe('OTC endpoints', () => {
  // USDX-23: customer store is still seeded by createMockCustomerList(); the
  // first seeded customer's id is stable (cus_1). Hardcoding avoids a
  // round-trip through the removed /api/customers list endpoint.
  function newCustomerAndOperator(): { customerId: string; operatorStaffId: string } {
    return { customerId: 'cus_1', operatorStaffId: 'stf_1' }
  }

  describe('positive', () => {
    test('POST /api/otc/mint creates pending tx that flushes to completed', async () => {
      const { customerId, operatorStaffId } = newCustomerAndOperator()
      const submit = await fetch('/api/otc/mint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          operatorStaffId,
          network: 'ethereum',
          amount: 50000,
          destinationAddress: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
        }),
      })
      expect(submit.status).toBe(201)
      const created = await submit.json()
      expect(created.status).toBe('pending')

      flushSettlement(created.id, 'completed')
      const list = await (await fetch('/api/otc/mint?pageSize=100')).json()
      const found = list.data.find((t: { id: string; status: string }) => t.id === created.id)
      expect(found.status).toBe('completed')
    })

    test('POST /api/otc/redeem creates pending tx', async () => {
      const { customerId, operatorStaffId } = newCustomerAndOperator()
      const submit = await fetch('/api/otc/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          operatorStaffId,
          network: 'polygon',
          amount: 10000,
        }),
      })
      expect(submit.status).toBe(201)
      const created = await submit.json()
      expect(created.status).toBe('pending')
    })
  })

  describe('negative', () => {
    test('POST mint with unknown customer returns 400', async () => {
      const res = await fetch('/api/otc/mint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: 'cus_99999',
          operatorStaffId: 'stf_1',
          network: 'ethereum',
          amount: 1000,
          destinationAddress: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
        }),
      })
      expect(res.status).toBe(400)
    })
  })

  describe('settlement edge cases', () => {
    test('flushSettlement on non-existent id is a no-op', () => {
      expect(() => flushSettlement('otc_mint_99999', 'completed')).not.toThrow()
    })
  })
})

// USDX-37: removed `Dashboard snapshot endpoint` describe — /api/dashboard/snapshot
// is gone. Coverage now lives in `Dashboard stats endpoint (USDX-16)` below.

describe('Dashboard stats endpoint (USDX-16)', () => {
  describe('positive', () => {
    test('returns SoT envelope with all DashboardStats fields', async () => {
      const res = await fetch('/api/v1/dashboard/stats')
      const body = await res.json()
      expect(body.status).toBe('success')
      expect(body.data).toBeDefined()
      const data = body.data
      expect(typeof data.totalSupply).toBe('string')
      expect(typeof data.totalMinted).toBe('string')
      expect(typeof data.totalBurned).toBe('string')
      expect(typeof data.pendingRequests).toBe('number')
      expect(data.requestsByStatus).toEqual(
        expect.objectContaining({
          PENDING_APPROVAL: expect.any(Number),
          APPROVED: expect.any(Number),
          EXECUTED: expect.any(Number),
          REJECTED: expect.any(Number),
        })
      )
      expect(typeof data.safeBalances.staff).toBe('string')
      expect(typeof data.safeBalances.manager).toBe('string')
      expect(typeof data.currentRate).toBe('string')
    })

    test('pendingRequests matches /api/v1/requests?status=PENDING_APPROVAL count', async () => {
      const stats = (await (await fetch('/api/v1/dashboard/stats')).json()).data
      const list = await (
        await fetch('/api/v1/requests?status=PENDING_APPROVAL&limit=100')
      ).json()
      expect(stats.pendingRequests).toBe(list.metadata.total)
      expect(stats.requestsByStatus.PENDING_APPROVAL).toBe(list.metadata.total)
    })
  })

  describe('edge cases', () => {
    test('decimal strings are well-formed (no NaN, two-decimal precision)', async () => {
      const data = (await (await fetch('/api/v1/dashboard/stats')).json()).data
      const decimal = /^-?\d+\.\d{2}$/
      expect(data.totalSupply).toMatch(decimal)
      expect(data.totalMinted).toMatch(decimal)
      expect(data.totalBurned).toMatch(decimal)
      expect(data.safeBalances.staff).toMatch(decimal)
      expect(data.safeBalances.manager).toMatch(decimal)
    })
  })
})

describe('POST /api/v1/burn @ sot/api/burn.yaml + sot/conventions.md', () => {
  // USDX-84: seed data carries demo PENDING_APPROVAL/APPROVED requests for
  // both Safes which collide with the SoT § Safe Propose Queue invariant the
  // POST handler now enforces. Clear before each test so the happy-path
  // submissions in this block don't get rejected with 409.
  beforeEach(() => clearActiveRequestsForTests())

  // USDX-46: form submits userId (uuid) + amountCurrency. cus_3 is seeded
  // in `customerStore` with kycStatus=VERIFIED + suspended=false (see
  // deriveKycStatus / deriveSuspended in src/mocks/data.ts).
  const VERIFIED_USER_ID = 'cus_3'
  const validBody = {
    userId: VERIFIED_USER_ID,
    userAddress: '0x' + 'a'.repeat(40),
    amount: '500.00',
    amountCurrency: 'USD' as const,
    chain: 'polygon',
    depositTxHash: '0x' + 'b'.repeat(64),
    bankName: 'BCA',
    bankAccount: '1234567890',
    notes: 'IDR via BCA',
  }

  function bearerHeaders(staff: Staff) {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${issueMockJwt(staff)}`,
    }
  }

  function defaultHeaders() {
    return bearerHeaders(getDefaultStaff()!)
  }

  describe('positive', () => {
    test('returns 201 with SoT SuccessResponse envelope wrapping BurnRequest', async () => {
      const res = await fetch('/api/v1/burn', {
        method: 'POST',
        headers: defaultHeaders(),
        body: JSON.stringify(validBody),
      })
      expect(res.status).toBe(201)
      const payload = await res.json()
      expect(payload.status).toBe('success')
      expect(payload.metadata).toBeNull()
      expect(payload.data).toMatchObject({
        status: 'PENDING_APPROVAL',
        userAddress: validBody.userAddress,
        depositTxHash: validBody.depositTxHash,
        bankName: 'BCA',
        bankAccount: '1234567890',
        chain: 'polygon',
        amount: '500.00',
        rateUsed: '16250',
        notes: 'IDR via BCA',
        // safeTxHash is populated as soon as the backend proposes the Safe TX
        // (sot/phase-1.md § Burn flow steps 5–8). USDX-19 surfaces this on
        // the Notifications page, so the burn factory now sets it on
        // creation rather than leaving it null.
        onChainTxHash: null,
      })
      expect(payload.data.safeTxHash).toMatch(/^0x[0-9a-fA-F]+$/)
    })

    test('response shape matches sot/openapi.yaml § BurnRequest exactly (no userName / display extras)', async () => {
      const res = await fetch('/api/v1/burn', {
        method: 'POST',
        headers: defaultHeaders(),
        body: JSON.stringify(validBody),
      })
      const payload = await res.json()
      const sotFields = [
        'id',
        'idempotencyKey',
        'userId',
        'userAddress',
        'amount',
        'amountWei',
        'amountIdr',
        'rateUsed',
        'chain',
        'depositTxHash',
        'bankName',
        'bankAccount',
        'notes',
        'safeType',
        'status',
        'safeTxHash',
        'onChainTxHash',
        'createdBy',
        'createdAt',
        'updatedAt',
      ]
      for (const f of sotFields) {
        expect(payload.data).toHaveProperty(f)
      }
      expect(payload.data).not.toHaveProperty('userName')
      expect(payload.data).not.toHaveProperty('type')
    })

    test('idempotencyKey is a 0x-prefixed bytes32 (66 chars)', async () => {
      const res = await fetch('/api/v1/burn', {
        method: 'POST',
        headers: defaultHeaders(),
        body: JSON.stringify(validBody),
      })
      const payload = await res.json()
      expect(payload.data.idempotencyKey).toMatch(/^0x[0-9a-fA-F]{64}$/)
      expect(payload.data.idempotencyKey).toHaveLength(66)
    })

    test('amountWei follows USDX 6-decimal convention (sot/conventions.md L30)', async () => {
      const res = await fetch('/api/v1/burn', {
        method: 'POST',
        headers: defaultHeaders(),
        body: JSON.stringify({ ...validBody, amount: '500.00' }),
      })
      const payload = await res.json()
      // 500.00 USDX × 1_000_000 wei/USDX = 500_000_000 wei
      expect(payload.data.amountWei).toBe('500000000')
    })

    test('amountWei handles fractional amount per 6-decimal convention', async () => {
      const res = await fetch('/api/v1/burn', {
        method: 'POST',
        headers: defaultHeaders(),
        body: JSON.stringify({ ...validBody, amount: '100.50' }),
      })
      const payload = await res.json()
      // 100.50 USDX → 100_500_000 wei
      expect(payload.data.amountWei).toBe('100500000')
    })

    test('safeType routes to STAFF below 1B IDR threshold (phase-1.md L17)', async () => {
      // amount 500 USDX × rate 16250 = 8,125,000 IDR (well under 1B)
      const res = await fetch('/api/v1/burn', {
        method: 'POST',
        headers: defaultHeaders(),
        body: JSON.stringify(validBody),
      })
      const payload = await res.json()
      expect(payload.data.safeType).toBe('STAFF')
    })

    test('safeType routes to MANAGER at or above 1B IDR threshold', async () => {
      // 100_000 USDX × 16_250 = 1,625,000,000 IDR ≥ 1B; super_admin staff
      // can authorize the Manager-level routing.
      const res = await fetch('/api/v1/burn', {
        method: 'POST',
        headers: defaultHeaders(),
        body: JSON.stringify({ ...validBody, amount: '100000' }),
      })
      const payload = await res.json()
      expect(payload.data.safeType).toBe('MANAGER')
    })

    test('newly created burn appears in /api/v1/requests list', async () => {
      const before = await (await fetch('/api/v1/requests?type=burn')).json()
      const beforeTotal = before.metadata.total

      await fetch('/api/v1/burn', {
        method: 'POST',
        headers: defaultHeaders(),
        body: JSON.stringify(validBody),
      })

      const after = await (await fetch('/api/v1/requests?type=burn')).json()
      expect(after.metadata.total).toBe(beforeTotal + 1)
    })
  })

  describe('negative', () => {
    test('returns 401 when Authorization header is missing (sot/openapi.yaml security)', async () => {
      const res = await fetch('/api/v1/burn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validBody),
      })
      expect(res.status).toBe(401)
      const payload = await res.json()
      expect(payload.error.code).toBe('UNAUTHORIZED')
    })

    test('returns 401 when bearer token is invalid', async () => {
      const res = await fetch('/api/v1/burn', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer not-a-real-jwt',
        },
        body: JSON.stringify(validBody),
      })
      expect(res.status).toBe(401)
    })

    test('returns 403 FORBIDDEN when role cannot handle the IDR amount (sot/openapi.yaml L143)', async () => {
      // Pick any non-super_admin staff — per the interim role mapping in
      // src/lib/roleAuth.ts only super_admin maps to Manager-equivalent.
      const staffStaff = findStaffById('stf_3')
      expect(staffStaff?.role).not.toBe('super_admin')

      // 100_000 USDX × 16_250 = 1.625B IDR ≥ 1B threshold → role check fails.
      const res = await fetch('/api/v1/burn', {
        method: 'POST',
        headers: bearerHeaders(staffStaff!),
        body: JSON.stringify({ ...validBody, amount: '100000' }),
      })
      expect(res.status).toBe(403)
      const payload = await res.json()
      expect(payload.error.code).toBe('FORBIDDEN')
    })

    test('does NOT 403 when same Staff-role submits below the threshold', async () => {
      const staffStaff = findStaffById('stf_3')
      expect(staffStaff?.role).not.toBe('super_admin')
      const res = await fetch('/api/v1/burn', {
        method: 'POST',
        headers: bearerHeaders(staffStaff!),
        body: JSON.stringify(validBody), // ~8M IDR
      })
      expect(res.status).toBe(201)
    })

    test('returns 400 VALIDATION_ERROR when a required field is missing', async () => {
      const { bankAccount: _o, ...missing } = validBody
      void _o
      const res = await fetch('/api/v1/burn', {
        method: 'POST',
        headers: defaultHeaders(),
        body: JSON.stringify(missing),
      })
      expect(res.status).toBe(400)
      const payload = await res.json()
      expect(payload.status).toBe('error')
      expect(payload.error.code).toBe('VALIDATION_ERROR')
    })

    test('returns 400 when userAddress is not a valid EVM address (viem)', async () => {
      const res = await fetch('/api/v1/burn', {
        method: 'POST',
        headers: defaultHeaders(),
        body: JSON.stringify({ ...validBody, userAddress: '0xnope' }),
      })
      expect(res.status).toBe(400)
    })

    test('returns 400 when depositTxHash fails the 0x+64 hex pattern', async () => {
      const res = await fetch('/api/v1/burn', {
        method: 'POST',
        headers: defaultHeaders(),
        body: JSON.stringify({ ...validBody, depositTxHash: '0x' + 'a'.repeat(63) }),
      })
      expect(res.status).toBe(400)
    })

    test('returns 400 when chain is anything other than polygon (Phase 1 scope)', async () => {
      const res = await fetch('/api/v1/burn', {
        method: 'POST',
        headers: defaultHeaders(),
        body: JSON.stringify({ ...validBody, chain: 'ethereum' }),
      })
      expect(res.status).toBe(400)
    })
  })
})

// USDX-392 (WSTG-CLNT-12): the mock authenticates via the httpOnly `usdx_session`
// cookie (in addition to the legacy Bearer path), POST /auth/login sets it, and
// POST /auth/logout exists to revoke it server-side. Cookies are seeded via
// `document.cookie`; jsdom sends them on same-origin requests (Set-Cookie is a
// forbidden response header, so we don't assert on it directly here).
describe('Auth via session cookie (USDX-392)', () => {
  function clearCookies() {
    for (const pair of document.cookie.split(';')) {
      const name = pair.split('=')[0].trim()
      if (name) document.cookie = `${name}=; Path=/; Max-Age=0`
    }
  }
  beforeEach(clearCookies)

  test('POST /api/v1/auth/login returns staff + backward-compat accessToken', async () => {
    const res = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'demo@usdx.io', password: 'anything' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.staff).toBeDefined()
    expect(typeof body.data.accessToken).toBe('string')
  })

  test('GET /api/v1/auth/me authenticates via the session cookie (no Bearer)', async () => {
    const staff = getDefaultStaff()!
    document.cookie = `usdx_session=${issueMockJwt(staff)}; Path=/`
    const res = await fetch('/api/v1/auth/me', { credentials: 'include' })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.id).toBe(staff.id)
  })

  // Note: the mock's 401-without-auth path is covered in auth.test.tsx
  // (/auth/me 401 clears the session) and RatePage.test.tsx (POST /rate 401
  // without a token). We don't re-assert it here because MSW's node cookie
  // store persists the login Set-Cookie across tests in this file, which would
  // make an in-file "no cookie" assertion order-dependent.

  test('a gated write (POST /api/v1/rate) authenticates via the session cookie', async () => {
    const staff = getDefaultStaff()! // demo@usdx.io → super_admin (can manage rate)
    document.cookie = `usdx_session=${issueMockJwt(staff)}; Path=/`
    const res = await fetch('/api/v1/rate', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'DYNAMIC', spreadPct: '0.5' }),
    })
    expect(res.status).not.toBe(401)
  })

  test('POST /api/v1/auth/logout responds success', async () => {
    const res = await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include' })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('success')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// USDX-546 — the KYB screen has ONE source of truth: the real backend.
//
// This is the runtime-effective half of that decision. `INTEGRATION_PATHS` in
// `browser.ts` only filters handlers OUT of the browser worker — it has no effect
// under Vitest and none at all once a handler no longer exists. What actually
// guarantees no mock can answer for `/api/v1/kyb*`, in the browser or in a test,
// is that the handlers were deleted. Assert that, not the documentation.
//
// The failure this closes is specific: with a stale mock still registered, a
// reviewer opening /kyb in dev sees eleven convincing seeded records and cannot
// tell that the backend was never called.
// ─────────────────────────────────────────────────────────────────────────────
describe('KYB is served by the real backend, not by MSW', () => {
  describe('negative', () => {
    test('no handler is registered for any /api/v1/kyb path', () => {
      const kybHandlers = handlers
        .map((h) => (h as { info?: { path?: unknown; method?: unknown } }).info)
        .filter((info) => typeof info?.path === 'string' && info.path.startsWith('/api/v1/kyb'))
        .map((info) => `${String(info?.method)} ${String(info?.path)}`)

      expect(kybHandlers).toEqual([])
    })
  })

  describe('positive', () => {
    test('the KYC handlers ARE still registered — this is not a blanket deletion', () => {
      // Guards the assertion above from passing for the wrong reason (a broken
      // `info` shape, an empty handler list). KYC is also live on the real
      // backend but deliberately KEEPS its handlers for Vitest coverage.
      const kycPaths = handlers
        .map((h) => (h as { info?: { path?: unknown } }).info?.path)
        .filter((path): path is string => typeof path === 'string')
        .filter((path) => path.startsWith('/api/v1/kyc'))

      expect(kycPaths.length).toBeGreaterThan(0)
    })
  })
})
