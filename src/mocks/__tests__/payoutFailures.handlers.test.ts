import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { server } from '@/mocks/server'
import {
  configurePayoutsEnabledForTests,
  findStaffById,
  issueMockJwt,
  resetMockData,
  upsertPayoutFailureForTests,
} from '@/mocks/handlers'
import { createMockPayoutFailures, PAYOUT_FAILURE_MOCK_IDS as IDS } from '@/mocks/data'
import type { PayoutFailureDetail, PayoutFailureListItem } from '@/lib/types'

// USDX-662 — MSW mirror of sot/api/payout-failures.yaml (three endpoints).
// Peran: stf_1 ADMIN · stf_2 MANAGER · stf_3 DEVELOPER · stf_4 STAFF.

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  resetMockData()
})
afterAll(() => server.close())

function asStaff(staffId: string): HeadersInit {
  return { Authorization: `Bearer ${issueMockJwt(findStaffById(staffId)!)}` }
}

async function list(query = ''): Promise<{ total: number; rows: PayoutFailureListItem[] }> {
  const body = await (await fetch(`/api/v1/payout-failures${query}`)).json()
  return { total: body.metadata.total, rows: body.data }
}

function resolve(id: string, payload: Record<string, unknown>, staffId = 'stf_2') {
  return fetch(`/api/v1/payout-failures/${id}/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...asStaff(staffId) },
    body: JSON.stringify(payload),
  })
}

const REASON = 'Ditransfer treasury lewat BNIdirect'

describe('GET /api/v1/payout-failures', () => {
  describe('positive', () => {
    test('returns the open queue oldest-first with list-item fields only', async () => {
      const { total, rows } = await list()
      expect(total).toBe(5)
      expect(rows[0]!.id).toBe(IDS.failedRejected)
      expect(rows.map((r) => r.issueAt)).toEqual([...rows.map((r) => r.issueAt)].sort())
      expect(rows[0]).not.toHaveProperty('submissions')
    })
    test('filters on issueKind', async () => {
      const { rows } = await list('?issueKind=BURN_REJECTED')
      expect(rows.map((r) => r.id)).toEqual([IDS.burnRejected])
    })
  })
  describe('negative', () => {
    test('an unknown issueKind is a 400, not an empty page', async () => {
      const res = await fetch('/api/v1/payout-failures?issueKind=NOPE')
      expect(res.status).toBe(400)
    })
  })
  describe('edge cases', () => {
    test('take pages the queue while total stays the whole queue', async () => {
      const body = await (await fetch('/api/v1/payout-failures?take=2&page=3')).json()
      expect(body.metadata).toEqual({ page: 3, limit: 2, total: 5 })
      expect(body.data).toHaveLength(1)
    })
  })
})

describe('GET /api/v1/payout-failures/:id', () => {
  describe('positive', () => {
    test('carries every submission and past review', async () => {
      const body = await (await fetch(`/api/v1/payout-failures/${IDS.failedAfterResend}`)).json()
      const detail = body.data as PayoutFailureDetail
      expect(detail.submissions).toHaveLength(2)
      expect(detail.reviews.map((r) => r.action)).toEqual(['RESENT'])
      expect(detail.resolution).toBeNull()
    })
  })
  describe('negative', () => {
    test('unknown id → 404 with the name in message (Nest filter shape)', async () => {
      const res = await fetch('/api/v1/payout-failures/019f0000-0000-7000-8000-000000000000')
      expect(res.status).toBe(404)
      expect((await res.json()).error).toEqual({ code: 'NOT_FOUND', message: 'PAYOUT_FAILURE_NOT_FOUND' })
    })
  })
})

describe('POST /api/v1/payout-failures/:id/resolve', () => {
  describe('positive', () => {
    test('SETTLED_MANUAL completes the order, leaves the queue and stays readable with its trail', async () => {
      const res = await resolve(IDS.failedRejected, {
        action: 'SETTLED_MANUAL',
        reason: REASON,
        externalRef: 'TRX-778812',
      })
      expect(res.status).toBe(200)
      expect((await res.json()).data).toMatchObject({ status: 'PAYOUT_COMPLETE', newPartnerReferenceNo: null })

      expect((await list()).rows.map((r) => r.id)).not.toContain(IDS.failedRejected)
      const detail = (await (await fetch(`/api/v1/payout-failures/${IDS.failedRejected}`)).json())
        .data as PayoutFailureDetail
      expect(detail.resolution).toBe('SETTLED_MANUAL')
      expect(detail.reviews.at(-1)).toMatchObject({ externalRef: 'TRX-778812', actorStaffName: 'Linda Chen' })
    })
    test('RESENT issues a new reference and clears payoutRef', async () => {
      const res = await resolve(IDS.failedAfterResend, { action: 'RESENT', reason: REASON })
      const data = (await res.json()).data
      expect(data.status).toBe('PROCESSING_PAYOUT')
      expect(data.newPartnerReferenceNo).toMatch(/^RDM/)
    })
    test('CLOSED keeps the status as it was', async () => {
      const res = await resolve(IDS.burnRejected, { action: 'CLOSED', reason: 'Nasabah setuju tidak dibayar' })
      expect((await res.json()).data.status).toBe('EXPIRED')
    })
  })

  describe('negative', () => {
    test('STAFF and DEVELOPER are refused with 403', async () => {
      expect((await resolve(IDS.failedRejected, { action: 'CLOSED', reason: REASON }, 'stf_4')).status).toBe(403)
      expect((await resolve(IDS.failedRejected, { action: 'CLOSED', reason: REASON }, 'stf_3')).status).toBe(403)
    })
    test('reason under 10 characters → 400', async () => {
      expect((await resolve(IDS.failedRejected, { action: 'CLOSED', reason: 'singkat' })).status).toBe(400)
    })
    test('SETTLED_MANUAL without externalRef → 400 EXTERNAL_REF_REQUIRED', async () => {
      const res = await resolve(IDS.failedRejected, { action: 'SETTLED_MANUAL', reason: REASON })
      expect(res.status).toBe(400)
      expect((await res.json()).error.message).toBe('EXTERNAL_REF_REQUIRED')
    })
    test('a second resolve → 409 ALREADY_RESOLVED', async () => {
      await resolve(IDS.failedRejected, { action: 'CLOSED', reason: REASON })
      const res = await resolve(IDS.failedRejected, { action: 'CLOSED', reason: REASON })
      expect(res.status).toBe(409)
      expect((await res.json()).error).toEqual({ code: 'CONFLICT', message: 'ALREADY_RESOLVED' })
    })
    test('RESENT on BURN_REJECTED and anything on PAYOUT_STUCK → 409 ACTION_NOT_ALLOWED_FOR_KIND', async () => {
      for (const [id, action] of [
        [IDS.burnRejected, 'RESENT'],
        [IDS.stuck, 'CLOSED'],
      ] as const) {
        const res = await resolve(id, { action, reason: REASON })
        expect(res.status).toBe(409)
        expect((await res.json()).error.message).toBe('ACTION_NOT_ALLOWED_FOR_KIND')
      }
    })
    test('RESENT while the payout brake is pulled → 409 PAYOUT_DISABLED; CLOSED still works', async () => {
      configurePayoutsEnabledForTests(false)
      const res = await resolve(IDS.failedRejected, { action: 'RESENT', reason: REASON })
      expect((await res.json()).error.message).toBe('PAYOUT_DISABLED')
      expect((await resolve(IDS.failedRejected, { action: 'CLOSED', reason: REASON })).status).toBe(200)
    })
  })

  describe('edge cases', () => {
    test('a last submission without rejectedAt → 409 SUBMISSION_NOT_FINAL, but CLOSED is allowed', async () => {
      const base = createMockPayoutFailures().get(IDS.failedRejected)!
      upsertPayoutFailureForTests({
        ...base,
        submissions: [{ ...base.submissions[0]!, rejectedAt: null, rejectionReason: null }],
      })
      const res = await resolve(IDS.failedRejected, { action: 'RESENT', reason: REASON })
      expect((await res.json()).error.message).toBe('SUBMISSION_NOT_FINAL')
      expect((await resolve(IDS.failedRejected, { action: 'CLOSED', reason: REASON })).status).toBe(200)
    })
    test('bankAccountId: with CLOSED → 400, with RESENT → 409 BANK_ACCOUNT_NOT_OWNED (no address book in the mock)', async () => {
      const bankAccountId = '019f0000-0000-7000-8000-00000000abcd'
      const closed = await resolve(IDS.failedRejected, { action: 'CLOSED', reason: REASON, bankAccountId })
      expect((await closed.json()).error.message).toBe('BANK_ACCOUNT_NOT_ALLOWED_FOR_ACTION')
      const resent = await resolve(IDS.failedRejected, { action: 'RESENT', reason: REASON, bankAccountId })
      expect((await resent.json()).error.message).toBe('BANK_ACCOUNT_NOT_OWNED')
    })
    test('without a mock session the role gate is skipped — the dev browser session is invisible to MSW', async () => {
      const res = await fetch(`/api/v1/payout-failures/${IDS.failedRejected}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'CLOSED', reason: REASON }),
      })
      expect(res.status).toBe(200)
    })
  })
})
