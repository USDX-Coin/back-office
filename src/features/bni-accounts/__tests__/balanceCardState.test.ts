import { describe, test, expect } from 'vitest'
import { ApiError } from '@/lib/apiFetch'
import { BNI_MOCK_ACCOUNTS, createBniBalances } from '@/mocks/data'
import { resolveBalanceCardStates } from '../balanceCardState'

// USDX-631 — sot/bni-integration.md § 16.4 "Kartu saldo" state table.

const [COLLECTION, NP, USD] = BNI_MOCK_ACCOUNTS as [
  (typeof BNI_MOCK_ACCOUNTS)[number],
  (typeof BNI_MOCK_ACCOUNTS)[number],
  (typeof BNI_MOCK_ACCOUNTS)[number],
]

describe('resolveBalanceCardStates', () => {
  describe('positive', () => {
    test('all OK → three ok cards carrying the bank data', () => {
      const states = resolveBalanceCardStates(BNI_MOCK_ACCOUNTS, createBniBalances(), null, false)
      expect(states.map((s) => s.kind)).toEqual(['ok', 'ok', 'ok'])
    })

    test('one REJECTED card → that card shows the bank reason, the others stay ok', () => {
      const balances = createBniBalances(BNI_MOCK_ACCOUNTS, {
        [NP.accountNo]: { status: 'REJECTED', errorReason: 'Account not authorized', effectiveBalance: null, endingBalance: null },
      })
      const states = resolveBalanceCardStates(BNI_MOCK_ACCOUNTS, balances, null, false)
      expect(states[0]!.kind).toBe('ok')
      expect(states[1]).toMatchObject({ kind: 'bank-rejected', text: 'Account not authorized' })
      expect(states[2]!.kind).toBe('ok')
    })
  })

  describe('negative', () => {
    test('a query error → every card unavailable with the SAME § 16.3 text (503 → belum aktif)', () => {
      const states = resolveBalanceCardStates(
        BNI_MOCK_ACCOUNTS,
        undefined,
        new ApiError(503, 'BNI_SERVICE_UNCONFIGURED', 'x'),
        false
      )
      expect(states).toHaveLength(3)
      for (const s of states) {
        expect(s.kind).toBe('unavailable')
        if (s.kind === 'unavailable') expect(s.error.kind).toBe('unconfigured')
      }
    })

    test('pending with no data → loading, never a phantom "ok"', () => {
      const states = resolveBalanceCardStates(BNI_MOCK_ACCOUNTS, undefined, null, true)
      expect(states.map((s) => s.kind)).toEqual(['loading', 'loading', 'loading'])
    })
  })

  describe('edge cases', () => {
    test('BLOCKED / MISSING / NOT_ALLOWED without errorReason fall back to the § 16.3 texts', () => {
      const balances = createBniBalances(BNI_MOCK_ACCOUNTS, {
        [COLLECTION.accountNo]: { status: 'BLOCKED', errorReason: null },
        [NP.accountNo]: { status: 'MISSING', errorReason: null },
        [USD.accountNo]: { status: 'NOT_ALLOWED', errorReason: null },
      })
      const states = resolveBalanceCardStates(BNI_MOCK_ACCOUNTS, balances, null, false)
      expect(states[0]).toMatchObject({ kind: 'bank-rejected', text: expect.stringContaining('HTTP 400') })
      expect(states[1]).toMatchObject({ kind: 'bank-rejected', text: expect.stringContaining('tidak mengembalikan') })
      expect(states[2]).toMatchObject({ kind: 'bank-rejected', text: expect.stringContaining('periksa konfigurasi') })
    })

    test('an unknown status (open enum) still resolves to bank-rejected showing the raw value', () => {
      const balances = createBniBalances(BNI_MOCK_ACCOUNTS, {
        [NP.accountNo]: { status: 'SUSPENDED' as never, errorReason: null },
      })
      const states = resolveBalanceCardStates(BNI_MOCK_ACCOUNTS, balances, null, false)
      expect(states[1]).toMatchObject({ kind: 'bank-rejected', text: 'Status bank: SUSPENDED.' })
    })

    test('an account absent from the bank reply is treated as MISSING', () => {
      const balances = createBniBalances([COLLECTION, USD])
      const states = resolveBalanceCardStates(BNI_MOCK_ACCOUNTS, balances, null, false)
      expect(states[1]).toMatchObject({ kind: 'bank-rejected', card: { status: 'MISSING' } })
    })

    test('the error wins over stale data (a failed re-pull must not keep showing old figures as ok)', () => {
      const states = resolveBalanceCardStates(
        BNI_MOCK_ACCOUNTS,
        createBniBalances(),
        new ApiError(502, 'BNI_SERVICE_UNAVAILABLE', 'x'),
        false
      )
      expect(states.every((s) => s.kind === 'unavailable')).toBe(true)
    })
  })
})
