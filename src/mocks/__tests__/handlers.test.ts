import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { server } from '@/mocks/server'
import { resetMockData } from '@/mocks/handlers'

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
