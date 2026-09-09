import { describe, test, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { server } from '@/mocks/server'
import { resetMockData, issueMockJwt, getDefaultStaff } from '@/mocks/handlers'
import { BNI_MOCK_ACCOUNTS, createBniStatementRows } from '@/mocks/data'
import type { BniBalances, BniStatement } from '@/lib/types'

// USDX-631 — MSW mirror of sot/api/bni-accounts.yaml (three endpoints).

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  resetMockData()
  vi.useRealTimers()
})
afterAll(() => server.close())

function authHeaders(): HeadersInit {
  const staff = getDefaultStaff()!
  return { Authorization: `Bearer ${issueMockJwt(staff)}` }
}

const NP = '108098391'

describe('GET /api/v1/bni-accounts', () => {
  describe('positive', () => {
    test('returns the three configured accounts in COLLECTION → NP → USD order', async () => {
      const res = await fetch('/api/v1/bni-accounts', { headers: authHeaders() })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.map((a: { role: string }) => a.role)).toEqual([
        'COLLECTION',
        'TREASURY_NP',
        'TREASURY_USD',
      ])
    })
  })

  describe('negative', () => {
    test('401 without a session', async () => {
      const res = await fetch('/api/v1/bni-accounts')
      expect(res.status).toBe(401)
    })
  })
})

describe('GET /api/v1/bni-accounts/balances', () => {
  describe('positive', () => {
    test('returns one card per configured account with both balances', async () => {
      const res = await fetch('/api/v1/bni-accounts/balances', { headers: authHeaders() })
      expect(res.status).toBe(200)
      const { data } = (await res.json()) as { data: BniBalances }
      expect(data.accounts).toHaveLength(BNI_MOCK_ACCOUNTS.length)
      expect(data.pullId).toMatch(/^[0-9a-f-]{36}$/)
      expect(data.inquiredAtBank).toMatch(/^\d{12}$/)
      for (const card of data.accounts) {
        expect(card.status).toBe('OK')
        expect(card.effectiveBalance).not.toBeNull()
        expect(card.endingBalance).not.toBeNull()
      }
      expect(data.accounts[2]!.currency).toBe('USD')
    })
  })

  describe('negative', () => {
    test('401 without a session', async () => {
      const res = await fetch('/api/v1/bni-accounts/balances')
      expect(res.status).toBe(401)
    })
  })
})

describe('GET /api/v1/bni-accounts/:accountNo/statement', () => {
  const today = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10)

  function get(accountNo: string, query: Record<string, string>) {
    const sp = new URLSearchParams(query).toString()
    return fetch(`/api/v1/bni-accounts/${accountNo}/statement?${sp}`, {
      headers: authHeaders(),
    })
  }

  describe('positive', () => {
    test('same-day range today returns rows sorted newest first with the applied params', async () => {
      const res = await get(NP, { startDate: today, endDate: today, type: 'ALL' })
      expect(res.status).toBe(200)
      const { data } = (await res.json()) as { data: BniStatement }
      expect(data.applied).toMatchObject({ accountNo: NP, startDate: today, endDate: today, type: 'ALL' })
      expect(data.rows.length).toBeGreaterThan(0)
      expect(data.summary.rowCount).toBe(data.rows.length)
      const dates = data.rows.map((r) => r.postDate!)
      expect([...dates].sort().reverse()).toEqual(dates)
    })

    test('type=DEBIT only returns D rows (backend re-filters by flag)', async () => {
      const res = await get(NP, { startDate: today, endDate: today, type: 'DEBIT' })
      const { data } = (await res.json()) as { data: BniStatement }
      expect(data.rows.length).toBeGreaterThan(0)
      expect(data.rows.every((r) => r.flag === 'D')).toBe(true)
    })
  })

  describe('negative', () => {
    test('422 BNI_ACCOUNT_NOT_ALLOWED for a well-formed number outside the configured list', async () => {
      const res = await get('999999999', { startDate: today, endDate: today })
      expect(res.status).toBe(422)
      expect((await res.json()).error.code).toBe('BNI_ACCOUNT_NOT_ALLOWED')
    })

    test('422 VALIDATION_ERROR for a range longer than 31 days', async () => {
      const res = await get(NP, { startDate: '2026-08-01', endDate: '2026-09-01' })
      expect(res.status).toBe(422)
      expect((await res.json()).error.code).toBe('VALIDATION_ERROR')
    })

    test('422 VALIDATION_ERROR for an end date in the future (WIB)', async () => {
      const res = await get(NP, { startDate: today, endDate: '2999-01-01' })
      expect(res.status).toBe(422)
    })

    test('422 VALIDATION_ERROR for an unknown type', async () => {
      const res = await get(NP, { startDate: today, endDate: today, type: 'Cr' })
      expect(res.status).toBe(422)
    })

    test('401 without a session', async () => {
      const res = await fetch(`/api/v1/bni-accounts/${NP}/statement?startDate=${today}&endDate=${today}`)
      expect(res.status).toBe(401)
    })
  })

  describe('edge cases', () => {
    test('2026-02-30 is rejected as not a real calendar date', async () => {
      const res = await get(NP, { startDate: '2026-02-30', endDate: '2026-03-01' })
      expect(res.status).toBe(422)
    })

    test('factory rows stay inside the requested window', () => {
      const rows = createBniStatementRows(40, '2026-08-01', '2026-08-31')
      for (const r of rows) {
        expect(r.postDate!.slice(0, 8) >= '20260801').toBe(true)
        expect(r.postDate!.slice(0, 8) <= '20260831').toBe(true)
      }
    })
  })
})
