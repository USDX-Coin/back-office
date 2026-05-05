import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { server } from '@/mocks/server'
import {
  resetMockData,
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

describe('Customer endpoints', () => {
  describe('positive', () => {
    test('GET /api/customers returns paginated list', async () => {
      const res = await fetch('/api/customers?page=1&pageSize=5')
      const data = await res.json()
      expect(data.data).toHaveLength(5)
      expect(data.meta.total).toBe(30)
    })

    test('POST /api/customers creates new customer', async () => {
      const before = await (await fetch('/api/customers/summary')).json()
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: 'Test',
          lastName: 'Customer',
          email: 'test@example.com',
          phone: '+15551234567',
          type: 'personal',
          role: 'member',
        }),
      })
      expect(res.status).toBe(201)
      const after = await (await fetch('/api/customers/summary')).json()
      expect(after.total).toBe(before.total + 1)
    })

    test('DELETE /api/customers/:id removes customer', async () => {
      const list = await (await fetch('/api/customers?pageSize=100')).json()
      const target = list.data[0].id
      const res = await fetch(`/api/customers/${target}`, { method: 'DELETE' })
      expect(res.status).toBe(204)
      const after = await (await fetch('/api/customers/summary')).json()
      expect(after.total).toBe(list.meta.total - 1)
    })
  })

  describe('negative', () => {
    test('POST without required fields returns 400', async () => {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName: 'Solo' }),
      })
      expect(res.status).toBe(400)
    })

    test('DELETE non-existent returns 404', async () => {
      const res = await fetch('/api/customers/cus_99999', { method: 'DELETE' })
      expect(res.status).toBe(404)
    })
  })

  describe('filter by type', () => {
    test('returns only personal customers', async () => {
      const res = await fetch('/api/customers?type=personal&pageSize=100')
      const data = await res.json()
      expect(data.data.every((c: { type: string }) => c.type === 'personal')).toBe(true)
    })
  })
})

describe('Staff endpoints', () => {
  describe('positive', () => {
    test('GET /api/staff returns staff list with summary', async () => {
      const list = await (await fetch('/api/staff?pageSize=100')).json()
      expect(list.data.length).toBeGreaterThan(0)
      const summary = await (await fetch('/api/staff/summary')).json()
      expect(summary.total).toBe(list.data.length)
    })

    test('POST /api/staff creates staff and increments summary', async () => {
      const before = await (await fetch('/api/staff/summary')).json()
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: 'New',
          lastName: 'Member',
          email: 'new.member@usdx.io',
          phone: '+15551234567',
          role: 'support',
        }),
      })
      expect(res.status).toBe(201)
      const after = await (await fetch('/api/staff/summary')).json()
      expect(after.total).toBe(before.total + 1)
    })
  })

  describe('filter by role', () => {
    test('returns only super_admin staff', async () => {
      const res = await fetch('/api/staff?role=super_admin&pageSize=100')
      const data = await res.json()
      expect(data.data.every((s: { role: string }) => s.role === 'super_admin')).toBe(true)
    })
  })
})

describe('OTC endpoints', () => {
  async function newCustomerAndOperator(): Promise<{ customerId: string; operatorStaffId: string }> {
    const customers = await (await fetch('/api/customers?pageSize=1')).json()
    const staff = await (await fetch('/api/staff?pageSize=1')).json()
    return { customerId: customers.data[0].id, operatorStaffId: staff.data[0].id }
  }

  describe('positive', () => {
    test('POST /api/otc/mint creates pending tx that flushes to completed', async () => {
      const { customerId, operatorStaffId } = await newCustomerAndOperator()
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
      const { customerId, operatorStaffId } = await newCustomerAndOperator()
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

describe('Dashboard snapshot endpoint', () => {
  test('returns OTC-derived KPIs and 30d trend', async () => {
    const res = await fetch('/api/dashboard/snapshot')
    const data = await res.json()
    expect(data.kpis).toBeDefined()
    expect(data.kpis.totalMintVolume30d).toBeTypeOf('number')
    expect(data.volumeTrend).toBeInstanceOf(Array)
    expect(data.volumeTrend.length).toBe(30)
    expect(data.recentActivity).toBeInstanceOf(Array)
    expect(data.networkDistribution).toBeInstanceOf(Array)
  })
})

describe('Report endpoint', () => {
  test('returns paginated report rows', async () => {
    const res = await fetch('/api/report?pageSize=10')
    const data = await res.json()
    expect(data.data.length).toBe(10)
    expect(data.meta.total).toBeGreaterThan(0)
  })

  test('filters by type=mint', async () => {
    const res = await fetch('/api/report?type=mint&pageSize=100')
    const data = await res.json()
    expect(data.data.every((r: { kind: string }) => r.kind === 'mint')).toBe(true)
  })

  test('filters by status=failed', async () => {
    const res = await fetch('/api/report?status=failed&pageSize=100')
    const data = await res.json()
    expect(data.data.every((r: { status: string }) => r.status === 'failed')).toBe(true)
  })

  test('insights endpoint returns derived metrics', async () => {
    const res = await fetch('/api/report/insights')
    const data = await res.json()
    expect(data.totalVolume).toBeTypeOf('number')
    expect(data.activeMinters).toBeTypeOf('number')
    expect(data.flagged).toBeTypeOf('number')
  })
})

describe('POST /api/v1/burn @ sot/openapi.yaml + sot/conventions.md', () => {
  const validBody = {
    userName: 'Alice User',
    userAddress: '0x' + 'a'.repeat(40),
    amount: '500.00',
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
        safeTxHash: null,
        onChainTxHash: null,
      })
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
