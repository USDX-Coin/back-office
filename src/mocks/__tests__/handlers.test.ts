import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { server } from '@/mocks/server'
import { resetMockData, flushSettlement } from '@/mocks/handlers'

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  resetMockData()
})
afterAll(() => server.close())

describe('MSW handlers', () => {
  describe('positive', () => {
    test('should return dashboard stats', async () => {
      const res = await fetch('/api/dashboard')
      expect(res.ok).toBe(true)
      const data = await res.json()
      expect(data.minting).toBeDefined()
      expect(data.redeem).toBeDefined()
      expect(data.recentActivity).toBeInstanceOf(Array)
    })

    test('should return paginated minting list', async () => {
      const res = await fetch('/api/minting?page=1&pageSize=5')
      expect(res.ok).toBe(true)
      const data = await res.json()
      expect(data.data).toHaveLength(5)
      expect(data.meta.page).toBe(1)
      expect(data.meta.pageSize).toBe(5)
      expect(data.meta.total).toBe(25)
    })

    test('should return paginated redeem list', async () => {
      const res = await fetch('/api/redeem?page=1&pageSize=10')
      expect(res.ok).toBe(true)
      const data = await res.json()
      expect(data.data).toHaveLength(10)
      expect(data.meta.total).toBe(20)
    })
  })

  describe('negative', () => {
    test('should return 404 for non-existent minting', async () => {
      const res = await fetch('/api/minting/999')
      expect(res.status).toBe(404)
    })

    test('should reject approval of non-pending minting', async () => {
      // Item 3 has status 'approved' (index 2 % 7 = 2 = approved)
      const res = await fetch('/api/minting/3/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      expect(res.status).toBe(400)
    })

    test('should require notes when rejecting', async () => {
      const res = await fetch('/api/minting/1/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error.code).toBe('NOTES_REQUIRED')
    })
  })

  describe('edge cases', () => {
    test('should filter minting by status', async () => {
      const res = await fetch('/api/minting?status=pending&page=1&pageSize=100')
      const data = await res.json()
      expect(data.data.every((item: { status: string }) => item.status === 'pending')).toBe(true)
    })

    test('should filter minting by search term', async () => {
      const res = await fetch('/api/minting?search=Siti&page=1&pageSize=100')
      const data = await res.json()
      expect(data.data.length).toBeGreaterThan(0)
    })
  })
})

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
