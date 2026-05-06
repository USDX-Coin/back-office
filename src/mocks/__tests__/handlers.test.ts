import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { server } from '@/mocks/server'
import { resetMockData, flushSettlement } from '@/mocks/handlers'

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

// USDX-41: /api/staff/* mock endpoints removed; staff list now hits real BE.

describe('OTC endpoints', () => {
  async function newCustomerAndOperator(): Promise<{ customerId: string; operatorStaffId: string }> {
    const customers = await (await fetch('/api/customers?pageSize=1')).json()
    // staff factory seeds deterministic IDs starting at stf_1
    return { customerId: customers.data[0].id, operatorStaffId: 'stf_1' }
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

