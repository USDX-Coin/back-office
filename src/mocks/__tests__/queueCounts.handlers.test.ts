import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { server } from '@/mocks/server'
import {
  configureRedeemApprovalControlsForTests,
  findStaffById,
  issueMockJwt,
  resetMockData,
} from '@/mocks/handlers'
import { PAYOUT_FAILURE_MOCK_IDS as IDS } from '@/mocks/data'
import type { QueueCounts } from '@/lib/types'

// USDX-678 — MSW mirror of sot/api/queue-counts.yaml. Kontraknya menuntut tiap angka
// SAMA dengan `metadata.total` list-nya, jadi test membandingkan keduanya alih-alih
// menyalin jumlah seed — seed boleh berubah, kesamaannya tidak.
// Peran: stf_2 MANAGER.

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  resetMockData()
})
afterAll(() => server.close())

const AS_MANAGER: HeadersInit = { Authorization: `Bearer ${issueMockJwt(findStaffById('stf_2')!)}` }
const REASON = 'Ditransfer treasury lewat BNIdirect'

async function counts(): Promise<{ status: number; body: { data: QueueCounts } }> {
  const res = await fetch('/api/v1/queue-counts', { headers: AS_MANAGER })
  return { status: res.status, body: await res.json() }
}

async function listTotal(path: string): Promise<number> {
  const body = await (await fetch(`${path}?take=1`, { headers: AS_MANAGER })).json()
  return body.metadata.total
}

describe('GET /api/v1/queue-counts', () => {
  describe('positive', () => {
    test('returns both open-queue counts equal to each list metadata.total', async () => {
      const { status, body } = await counts()
      expect(status).toBe(200)
      expect(body.data).toEqual({
        payoutFailuresOpen: await listTotal('/api/v1/payout-failures'),
        redeemApprovalsOpen: await listTotal('/api/v1/redeem-approvals'),
      })
      expect(body.data.payoutFailuresOpen).toBeGreaterThan(0)
      expect(body.data.redeemApprovalsOpen).toBeGreaterThan(0)
    })

    test('carries no PII — only the two integer counts', async () => {
      const { body } = await counts()
      expect(Object.keys(body.data).sort()).toEqual(['payoutFailuresOpen', 'redeemApprovalsOpen'])
    })
  })

  describe('negative', () => {
    test('a resolved payout failure no longer counts', async () => {
      const before = (await counts()).body.data.payoutFailuresOpen
      const res = await fetch(`/api/v1/payout-failures/${IDS.burnRejected}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AS_MANAGER },
        body: JSON.stringify({ action: 'CLOSED', reason: REASON }),
      })
      expect(res.status).toBe(200)
      const after = (await counts()).body.data.payoutFailuresOpen
      expect(after).toBe(before - 1)
      expect(after).toBe(await listTotal('/api/v1/payout-failures'))
    })
  })

  describe('edge cases', () => {
    test('an active threshold filters redeemApprovalsOpen exactly like the list does', async () => {
      configureRedeemApprovalControlsForTests({
        approvalThresholdIdr: '999999999999.00',
        updatedAt: null,
        updatedByName: null,
      })
      const { body } = await counts()
      expect(body.data.redeemApprovalsOpen).toBe(0)
      expect(body.data.redeemApprovalsOpen).toBe(await listTotal('/api/v1/redeem-approvals'))
    })
  })
})
