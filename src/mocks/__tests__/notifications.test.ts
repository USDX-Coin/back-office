import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { server } from '@/mocks/server'
import { resetMockData, flushApproval } from '@/mocks/handlers'

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  resetMockData()
})
afterAll(() => server.close())

describe('Notifications endpoints', () => {
  describe('GET /api/notifications', () => {
    test('should return only requests with status pending_approval', async () => {
      const res = await fetch('/api/notifications')
      expect(res.ok).toBe(true)
      const body = await res.json()
      expect(Array.isArray(body.data)).toBe(true)
      expect(body.data.length).toBeGreaterThan(0)
      // Each notification must carry the SoT-mandated fields
      for (const n of body.data) {
        expect(n.id).toBeTypeOf('string')
        expect(['mint', 'redeem']).toContain(n.kind)
        expect(n.userName).toBeTypeOf('string')
        expect(n.amount).toBeTypeOf('number')
        expect(['STAFF', 'MANAGER']).toContain(n.safeType)
        expect(n.safeAddress).toMatch(/^0x[0-9a-fA-F]+$/)
        expect(n.safeTxHash).toMatch(/^0x[0-9a-fA-F]+$/)
        expect(n.chainId).toBeTypeOf('number')
        expect(n.createdAt).toBeTypeOf('string')
      }
    })

    test('should match the count returned by /api/notifications/count', async () => {
      const list = await (await fetch('/api/notifications')).json()
      const count = await (await fetch('/api/notifications/count')).json()
      expect(count.count).toBe(list.data.length)
    })
  })

  describe('flushApproval test hook', () => {
    test('should remove an item from the notifications list once executed', async () => {
      const before = await (await fetch('/api/notifications')).json()
      expect(before.data.length).toBeGreaterThan(0)
      const target = before.data[0]

      flushApproval(target.id, 'completed')

      const after = await (await fetch('/api/notifications')).json()
      const ids = after.data.map((n: { id: string }) => n.id)
      expect(ids).not.toContain(target.id)
      expect(after.data.length).toBe(before.data.length - 1)

      // And the count endpoint reflects the new state
      const count = await (await fetch('/api/notifications/count')).json()
      expect(count.count).toBe(after.data.length)
    })

    test('should be a no-op for unknown ids', () => {
      expect(() => flushApproval('otc_mint_99999')).not.toThrow()
    })

    test('should be a no-op for ids that are not in pending_approval', async () => {
      // Pick a mint tx that is NOT in pending_approval (the OTC list contains
      // all statuses including pending/completed/failed).
      const list = await (await fetch('/api/otc/mint?pageSize=100')).json()
      const nonPending = list.data.find(
        (t: { status: string }) => t.status !== 'pending_approval'
      )
      expect(nonPending).toBeDefined()
      const before = (await (await fetch('/api/notifications')).json()).data.length
      flushApproval(nonPending.id, 'completed')
      const after = (await (await fetch('/api/notifications')).json()).data.length
      expect(after).toBe(before)
    })
  })
})
