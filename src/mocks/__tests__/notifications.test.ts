import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { server } from '@/mocks/server'
import { resetMockData, flushApproval } from '@/mocks/handlers'

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  resetMockData()
})
afterAll(() => server.close())

describe('Notifications via /api/v1/requests', () => {
  describe('GET /api/v1/requests?status=PENDING_APPROVAL', () => {
    test('should return only PENDING_APPROVAL rows in SoT envelope', async () => {
      const res = await fetch('/api/v1/requests?status=PENDING_APPROVAL&limit=200')
      expect(res.ok).toBe(true)
      const body = await res.json()
      expect(body.status).toBe('success')
      expect(body.metadata).toMatchObject({ page: 1, limit: 200 })
      expect(typeof body.metadata.total).toBe('number')
      expect(Array.isArray(body.data)).toBe(true)
      expect(body.data.length).toBeGreaterThan(0)
      // Each row must be in PENDING_APPROVAL with the SoT-mandated fields
      for (const row of body.data) {
        expect(row.status).toBe('PENDING_APPROVAL')
        expect(row.id).toBeTypeOf('string')
        expect(['mint', 'burn']).toContain(row.type)
        expect(row.userName).toBeTypeOf('string')
        expect(row.amount).toBeTypeOf('string')
        expect(['STAFF', 'MANAGER']).toContain(row.safeType)
        expect(row.createdAt).toBeTypeOf('string')
        // The Notifications page needs safeTxHash on the list to deep-link
        // each row to Safe UI without an extra fetch.
        expect(row.safeTxHash).toMatch(/^0x[0-9a-fA-F]+$/)
      }
    })
  })

  describe('flushApproval test hook', () => {
    test('should remove an item from the PENDING_APPROVAL list once executed', async () => {
      const before = await (
        await fetch('/api/v1/requests?status=PENDING_APPROVAL&limit=200')
      ).json()
      const initialCount = before.data.length
      expect(initialCount).toBeGreaterThan(0)
      const target = before.data[0]

      flushApproval(target.id, 'EXECUTED')

      const after = await (
        await fetch('/api/v1/requests?status=PENDING_APPROVAL&limit=200')
      ).json()
      expect(after.data.length).toBe(initialCount - 1)
      const ids = after.data.map((n: { id: string }) => n.id)
      expect(ids).not.toContain(target.id)
    })

    test('should be a no-op for unknown ids', () => {
      expect(() => flushApproval('does-not-exist')).not.toThrow()
    })

    test('should be a no-op for ids that are not PENDING_APPROVAL', async () => {
      const list = await (await fetch('/api/v1/requests?limit=200')).json()
      const nonPending = list.data.find(
        (r: { status: string }) => r.status !== 'PENDING_APPROVAL'
      )
      expect(nonPending).toBeDefined()
      const before = (await (await fetch('/api/v1/requests?status=PENDING_APPROVAL&limit=200')).json()).data.length
      flushApproval(nonPending.id, 'EXECUTED')
      const after = (await (await fetch('/api/v1/requests?status=PENDING_APPROVAL&limit=200')).json()).data.length
      expect(after).toBe(before)
    })
  })
})
