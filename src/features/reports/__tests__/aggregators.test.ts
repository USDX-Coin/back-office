import { describe, expect, test } from 'vitest'
import {
  aggregateByUser,
  aggregateDailyBurn,
  aggregateDailyMint,
} from '@/mocks/data'
import type { Customer, RequestListItem } from '@/lib/types'

function mintRow(
  partial: Partial<RequestListItem> & Pick<RequestListItem, 'createdAt' | 'status'>
): RequestListItem {
  return {
    id: 'id',
    type: 'mint',
    userId: 'u1',
    userName: 'Alice',
    userAddress: '0xabc',
    amount: '100',
    amountIdr: '1500000',
    chain: 'polygon',
    safeType: 'STAFF',
    safeTxHash: null,
    onChainTxHash: null,
    createdBy: 'staff-1',
    createdByName: 'Operator',
    ...partial,
  }
}

function burnRow(
  partial: Partial<RequestListItem> & Pick<RequestListItem, 'createdAt' | 'status'>
): RequestListItem {
  return mintRow({ type: 'burn', ...partial })
}

// 2026-05-12 10:00 UTC = 2026-05-12 17:00 Jakarta → bucket "2026-05-12".
// 2026-05-12 18:00 UTC = 2026-05-13 01:00 Jakarta → bucket "2026-05-13".
const DAY_12_UTC = '2026-05-12T10:00:00Z'
const DAY_13_UTC = '2026-05-12T18:00:00Z'

describe('aggregateDailyMint', () => {
  describe('positive', () => {
    test('groups mint rows by Asia/Jakarta date and sums amounts', () => {
      const requests = [
        mintRow({ createdAt: DAY_12_UTC, status: 'EXECUTED', amount: '100', amountIdr: '1500000' }),
        mintRow({ createdAt: DAY_12_UTC, status: 'PENDING_APPROVAL', amount: '50', amountIdr: '750000' }),
        mintRow({ createdAt: DAY_13_UTC, status: 'EXECUTED', amount: '200', amountIdr: '3000000' }),
      ]
      const result = aggregateDailyMint(requests, {
        startDate: '2026-05-12',
        endDate: '2026-05-13',
      })
      expect(result).toHaveLength(2)
      expect(result[0]!.date).toBe('2026-05-12')
      expect(result[0]!.totalCount).toBe(2)
      expect(result[0]!.totalAmountUsdx).toBe('150.000000')
      expect(result[0]!.totalAmountIdr).toBe('2250000.00')
      expect(result[0]!.countExecuted).toBe(1)
      expect(result[0]!.countPendingApproval).toBe(1)
      expect(result[1]!.date).toBe('2026-05-13')
    })

    test('filters by status when provided', () => {
      const requests = [
        mintRow({ createdAt: DAY_12_UTC, status: 'EXECUTED', amount: '100', amountIdr: '0' }),
        mintRow({ createdAt: DAY_12_UTC, status: 'PENDING_APPROVAL', amount: '50', amountIdr: '0' }),
      ]
      const result = aggregateDailyMint(requests, {
        startDate: '2026-05-12',
        endDate: '2026-05-12',
        status: 'EXECUTED',
      })
      expect(result).toHaveLength(1)
      expect(result[0]!.totalCount).toBe(1)
      expect(result[0]!.countExecuted).toBe(1)
      expect(result[0]!.countPendingApproval).toBe(0)
    })

    test('excludes burn rows', () => {
      const requests = [
        mintRow({ createdAt: DAY_12_UTC, status: 'EXECUTED' }),
        burnRow({ createdAt: DAY_12_UTC, status: 'EXECUTED' }),
      ]
      const result = aggregateDailyMint(requests, {
        startDate: '2026-05-12',
        endDate: '2026-05-12',
      })
      expect(result[0]!.totalCount).toBe(1)
    })

    test('sorts results by date ascending (BE default)', () => {
      const requests = [
        mintRow({ createdAt: DAY_13_UTC, status: 'EXECUTED' }),
        mintRow({ createdAt: DAY_12_UTC, status: 'EXECUTED' }),
      ]
      const result = aggregateDailyMint(requests, {
        startDate: '2026-05-12',
        endDate: '2026-05-13',
      })
      expect(result.map((r) => r.date)).toEqual(['2026-05-12', '2026-05-13'])
    })
  })

  describe('edge cases', () => {
    test('returns empty array when no rows match', () => {
      expect(
        aggregateDailyMint([], { startDate: '2026-05-12', endDate: '2026-05-12' })
      ).toEqual([])
    })
  })
})

describe('aggregateDailyBurn', () => {
  describe('positive', () => {
    test('counts IDR_TRANSFERRED separately from EXECUTED', () => {
      const requests = [
        burnRow({ createdAt: DAY_12_UTC, status: 'EXECUTED' }),
        burnRow({ createdAt: DAY_12_UTC, status: 'IDR_TRANSFERRED' }),
      ]
      const result = aggregateDailyBurn(requests, {
        startDate: '2026-05-12',
        endDate: '2026-05-12',
      })
      expect(result[0]!.countExecuted).toBe(1)
      expect(result[0]!.countIdrTransferred).toBe(1)
    })
  })
})

describe('aggregateByUser', () => {
  // aggregateByUser reads only `id` and `email` from each Customer record;
  // the rest of the Customer shape (KYC, wallets, …) is irrelevant for this
  // aggregation. Build slim records and cast via `unknown` to avoid coupling
  // the test to fields the aggregator never touches.
  const customers = [
    { id: 'u1', email: 'alice@example.com' },
    { id: 'u2', email: 'bob@example.com' },
  ] as unknown as Customer[]

  describe('positive', () => {
    test('aggregates per user and joins email from customer store', () => {
      const requests = [
        mintRow({ createdAt: DAY_12_UTC, status: 'EXECUTED', userId: 'u1', userName: 'Alice', amount: '100', amountIdr: '1500000' }),
        mintRow({ createdAt: DAY_12_UTC, status: 'EXECUTED', userId: 'u2', userName: 'Bob', amount: '300', amountIdr: '4500000' }),
        mintRow({ createdAt: DAY_12_UTC, status: 'EXECUTED', userId: 'u1', userName: 'Alice', amount: '50', amountIdr: '750000' }),
      ]
      const result = aggregateByUser(requests, customers, 'mint', {
        startDate: '2026-05-12',
        endDate: '2026-05-12',
      })
      expect(result).toHaveLength(2)
      // Sorted by totalAmountUsdx descending — Bob (300) first, Alice (150) second.
      expect(result[0]!.userId).toBe('u2')
      expect(result[0]!.userEmail).toBe('bob@example.com')
      expect(result[0]!.totalAmountUsdx).toBe('300.000000')
      expect(result[1]!.userId).toBe('u1')
      expect(result[1]!.totalCount).toBe(2)
      expect(result[1]!.totalAmountUsdx).toBe('150.000000')
    })

    test('filters by userId', () => {
      const requests = [
        mintRow({ createdAt: DAY_12_UTC, status: 'EXECUTED', userId: 'u1' }),
        mintRow({ createdAt: DAY_12_UTC, status: 'EXECUTED', userId: 'u2' }),
      ]
      const result = aggregateByUser(requests, customers, 'mint', {
        startDate: '2026-05-12',
        endDate: '2026-05-12',
        userId: 'u1',
      })
      expect(result).toHaveLength(1)
      expect(result[0]!.userId).toBe('u1')
    })

    test('returns blank email when customer is not in the store', () => {
      const requests = [
        mintRow({ createdAt: DAY_12_UTC, status: 'EXECUTED', userId: 'ghost', userName: 'Ghost' }),
      ]
      const result = aggregateByUser(requests, customers, 'mint', {
        startDate: '2026-05-12',
        endDate: '2026-05-12',
      })
      expect(result[0]!.userEmail).toBe('')
    })
  })
})
