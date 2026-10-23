import { describe, test, expect } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { BACKOFFICE_TRANSACTIONS_KEY } from '@/features/transactions/hooks'
import { QUEUE_COUNTS_KEY } from '@/features/queue-counts/hooks'
import { invalidateMoneyFlowViews, MONEY_FLOW_STALE_TIME, MONEY_FLOW_VIEW_KEYS } from '../moneyFlowViews'

// Satu kejadian uang (tanda tangan / eksekusi Safe, resolve, approve…) harus
// membuat SEMUA layar yang merender order itu basi — dan tidak lebih.

function seeded(keys: unknown[][]) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 60_000 } } })
  for (const key of keys) qc.setQueryData(key, { seeded: true })
  return qc
}

const invalidated = (qc: QueryClient, key: unknown[]) => qc.getQueryState(key)?.isInvalidated

describe('invalidateMoneyFlowViews', () => {
  describe('positive', () => {
    test('should mark every money-flow view stale', () => {
      const views = [
        ['multisig', 'list', { page: 1 }],
        ['multisig', 'list', 'otc-queue'],
        ['multisig', 'count', 'PENDING_SIGN'],
        ['orders', 'list', {}],
        [...BACKOFFICE_TRANSACTIONS_KEY, { needsAction: true }],
        ['requests', 'otc', { statuses: ['APPROVED'] }],
        ['requests', 'detail', 'req_1'],
        ['requests', 'otc-action-count', 'mint'],
        [...QUEUE_COUNTS_KEY],
      ]
      const qc = seeded(views)
      invalidateMoneyFlowViews(qc)
      for (const key of views) expect(invalidated(qc, key), JSON.stringify(key)).toBe(true)
    })
  })

  describe('positive — orderId', () => {
    test('should mark ONLY the affected order detail stale', () => {
      const qc = seeded([
        ['orders', 'detail', 'ord_hit'],
        ['orders', 'detail', 'ord_other'],
      ])
      invalidateMoneyFlowViews(qc, { orderId: 'ord_hit' })
      expect(invalidated(qc, ['orders', 'detail', 'ord_hit'])).toBe(true)
      expect(invalidated(qc, ['orders', 'detail', 'ord_other'])).toBe(false)
    })

    test('a null orderId (e.g. governance Safe tx) should touch no order detail', () => {
      const qc = seeded([['orders', 'detail', 'ord_1']])
      invalidateMoneyFlowViews(qc, { orderId: null })
      expect(invalidated(qc, ['orders', 'detail', 'ord_1'])).toBe(false)
    })
  })

  describe('negative', () => {
    test('should NOT touch detail queries that write pii_access_audit, nor slow Safe meta', () => {
      // Menyapu ini akan mencatat "staf membuka rekening / berkas" yang tidak
      // dilakukan siapa pun — tiap fitur menyegarkan detail id-nya sendiri.
      const untouched = [
        ['kyc', 'detail', 'kyc_1'],
        ['kyb', 'detail', 'kyb_1'],
        ['payout-failures', 'detail', 'po_1'],
        ['redeem-approvals', 'detail', 'ra_1'],
        ['held-credits', 'detail', 'hc_1'],
        // Rincian order redeem = satu baris audit per tarikan.
        ['orders', 'detail', 'ord_1'],
        ['multisig', 'safes', 'all'],
        ['multisig', 'detail', 'tx_1'],
      ]
      const qc = seeded(untouched)
      invalidateMoneyFlowViews(qc)
      for (const key of untouched) expect(invalidated(qc, key), JSON.stringify(key)).toBe(false)
    })
  })

  describe('edge cases', () => {
    test('raw keys should stay in sync with the constants the features own', () => {
      const keys = MONEY_FLOW_VIEW_KEYS.map((k) => JSON.stringify(k))
      expect(keys).toContain(JSON.stringify(BACKOFFICE_TRANSACTIONS_KEY))
      expect(keys).toContain(JSON.stringify(QUEUE_COUNTS_KEY))
    })

    test('should be a no-op on an empty cache', () => {
      const qc = seeded([])
      expect(() => invalidateMoneyFlowViews(qc)).not.toThrow()
      expect(qc.getQueryCache().getAll()).toHaveLength(0)
    })

    test('live views should always count as stale', () => {
      expect(MONEY_FLOW_STALE_TIME).toBe(0)
    })
  })
})
