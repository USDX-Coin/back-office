import { describe, test, expect } from 'vitest'
import {
  getOrderStatusConfig,
  getPaymentStatusConfig,
  getSafeStatusConfig,
  isOrderTerminal,
} from '@/lib/status'
import type {
  MintOrderStatus,
  MintPaymentStatus,
  MintSafeStatus,
} from '@/lib/types'

// USDX-206 — consumer order status → UI mapping (sot/api/common.yaml).

describe('getOrderStatusConfig', () => {
  describe('positive', () => {
    test('maps every MintOrderStatus to a label + dot class', () => {
      const all: MintOrderStatus[] = [
        'WAITING_FOR_PAYMENT',
        'WAITING_FOR_APPROVAL',
        'COMPLETED',
        'FAILED',
      ]
      for (const s of all) {
        const cfg = getOrderStatusConfig(s)
        expect(cfg.label.length).toBeGreaterThan(0)
        expect(cfg.dotClass).toMatch(/^bg-/)
      }
    })

    test('COMPLETED reads as a success state', () => {
      expect(getOrderStatusConfig('COMPLETED').className).toContain('success')
    })

    test('FAILED reads as a destructive state', () => {
      expect(getOrderStatusConfig('FAILED').className).toContain('destructive')
    })
  })

  describe('edge cases', () => {
    test('unknown status falls back to a neutral config without throwing', () => {
      const cfg = getOrderStatusConfig('SOMETHING_NEW' as MintOrderStatus)
      expect(cfg.label).toBe('SOMETHING_NEW')
      expect(cfg.dotClass).toBe('bg-muted-foreground')
    })
  })
})

describe('getPaymentStatusConfig', () => {
  describe('positive', () => {
    test('maps every MintPaymentStatus', () => {
      const all: MintPaymentStatus[] = ['REQUESTED', 'WAITING_FOR_PAYMENT', 'PAID', 'EXPIRED']
      for (const s of all) expect(getPaymentStatusConfig(s).label.length).toBeGreaterThan(0)
    })

    test('PAID is a success state, EXPIRED is destructive', () => {
      expect(getPaymentStatusConfig('PAID').className).toContain('success')
      expect(getPaymentStatusConfig('EXPIRED').className).toContain('destructive')
    })
  })
})

describe('getSafeStatusConfig', () => {
  describe('positive', () => {
    test('maps every MintSafeStatus', () => {
      const all: MintSafeStatus[] = [
        'NONE',
        'PENDING_APPROVAL',
        'APPROVED',
        'EXECUTED',
        'REJECTED',
      ]
      for (const s of all) expect(getSafeStatusConfig(s).label.length).toBeGreaterThan(0)
    })

    test('EXECUTED is a success state, REJECTED is destructive', () => {
      expect(getSafeStatusConfig('EXECUTED').className).toContain('success')
      expect(getSafeStatusConfig('REJECTED').className).toContain('destructive')
    })
  })
})

describe('isOrderTerminal', () => {
  describe('positive', () => {
    test('COMPLETED and FAILED are terminal', () => {
      expect(isOrderTerminal('COMPLETED')).toBe(true)
      expect(isOrderTerminal('FAILED')).toBe(true)
    })
  })

  describe('negative', () => {
    test('in-flight states are not terminal', () => {
      expect(isOrderTerminal('WAITING_FOR_PAYMENT')).toBe(false)
      expect(isOrderTerminal('WAITING_FOR_APPROVAL')).toBe(false)
    })
  })
})
