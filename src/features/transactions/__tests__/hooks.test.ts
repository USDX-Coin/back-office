import { describe, test, expect } from 'vitest'
import { POLL_ACTIVE_MS, POLL_LIST_MS } from '@/lib/queryConfig'
import { orderDetailPollInterval, orderListPollInterval } from '../hooks'
import type { OrderStatus } from '@/lib/types'

// The User Transaction views have to reflect a mint that is still moving without
// the operator refreshing — and equally, they have to STOP once the money has
// settled. "Live" is a budget, not an unbounded poll (src/lib/queryConfig.ts).

describe('orderListPollInterval', () => {
  describe('positive', () => {
    test('polls while any row is still moving through payment / Safe', () => {
      expect(orderListPollInterval([{ status: 'WAITING_FOR_PAYMENT' }])).toBe(POLL_LIST_MS)
      expect(orderListPollInterval([{ status: 'PROCESSING' as OrderStatus }])).toBe(
        POLL_LIST_MS,
      )
    })

    test('one unsettled row among settled ones is enough to keep polling', () => {
      expect(
        orderListPollInterval([
          { status: 'COMPLETED' },
          { status: 'PAYOUT_COMPLETE' },
          { status: 'WAITING_FOR_PAYMENT' },
        ]),
      ).toBe(POLL_LIST_MS)
    })
  })

  describe('negative', () => {
    test('stops once every row is terminal', () => {
      expect(
        orderListPollInterval([
          { status: 'COMPLETED' },
          { status: 'FAILED' },
          { status: 'PAYOUT_COMPLETE' },
          { status: 'EXPIRED' },
        ]),
      ).toBe(false)
    })
  })

  describe('edge cases', () => {
    test('an empty page or a not-yet-loaded list does not poll', () => {
      expect(orderListPollInterval([])).toBe(false)
      expect(orderListPollInterval(undefined)).toBe(false)
    })
  })
})

describe('orderDetailPollInterval', () => {
  describe('positive', () => {
    test('an open modal on a live order polls at the active cadence', () => {
      expect(orderDetailPollInterval('WAITING_FOR_PAYMENT')).toBe(POLL_ACTIVE_MS)
      expect(orderDetailPollInterval('BURNED' as OrderStatus)).toBe(POLL_ACTIVE_MS)
    })
  })

  describe('negative', () => {
    test('a settled order stops polling', () => {
      expect(orderDetailPollInterval('COMPLETED')).toBe(false)
      expect(orderDetailPollInterval('FAILED')).toBe(false)
      expect(orderDetailPollInterval('PAYOUT_COMPLETE')).toBe(false)
      expect(orderDetailPollInterval('EXPIRED')).toBe(false)
    })
  })

  describe('edge cases', () => {
    test('no detail loaded yet → no poll', () => {
      expect(orderDetailPollInterval(undefined)).toBe(false)
    })
  })
})
