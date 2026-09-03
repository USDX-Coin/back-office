import { describe, test, expect } from 'vitest'
import {
  getSafeTxStatusConfig,
  isSafeTxTerminal,
  isSafeTxSignable,
  isSafeTxCancellable,
  isSafeTxExecutable,
  getActivityLabel,
  isUnknownActivity,
  mostAdvancedSafeTxStatus,
  safeTxStatusOrder,
  SAFE_TX_TABS,
  SAFE_TX_COUNTED_STATUSES,
} from '../status'
import type { SafeTxStatus } from '@/lib/types'

describe('getSafeTxStatusConfig', () => {
  describe('positive', () => {
    test('should map each status to a label + classes', () => {
      const statuses: SafeTxStatus[] = [
        'PENDING_SIGN',
        'READY_TO_EXECUTE',
        'CONFIRMING',
        'EXECUTED',
        'FAILED',
        'CANCELLED',
      ]
      for (const s of statuses) {
        const cfg = getSafeTxStatusConfig(s)
        expect(cfg.label.length).toBeGreaterThan(0)
        expect(cfg.dotClass.length).toBeGreaterThan(0)
      }
    })
  })

  describe('edge cases', () => {
    test('should fall back for an unknown status', () => {
      const cfg = getSafeTxStatusConfig('WEIRD' as SafeTxStatus)
      expect(cfg.label).toBe('WEIRD')
      expect(cfg.dotClass).toBe('bg-muted-foreground')
    })
  })
})

describe('SafeTx status predicates', () => {
  describe('positive', () => {
    test('terminal = EXECUTED / FAILED / CANCELLED', () => {
      expect(isSafeTxTerminal('EXECUTED')).toBe(true)
      expect(isSafeTxTerminal('FAILED')).toBe(true)
      expect(isSafeTxTerminal('CANCELLED')).toBe(true)
    })
    test('signable = PENDING_SIGN / READY_TO_EXECUTE', () => {
      expect(isSafeTxSignable('PENDING_SIGN')).toBe(true)
      expect(isSafeTxSignable('READY_TO_EXECUTE')).toBe(true)
    })
    test('cancellable = PENDING_SIGN / READY_TO_EXECUTE', () => {
      expect(isSafeTxCancellable('PENDING_SIGN')).toBe(true)
      expect(isSafeTxCancellable('READY_TO_EXECUTE')).toBe(true)
    })
    test('executable = READY_TO_EXECUTE only', () => {
      expect(isSafeTxExecutable('READY_TO_EXECUTE')).toBe(true)
    })
  })

  describe('negative', () => {
    test('non-terminal in-flight states', () => {
      expect(isSafeTxTerminal('PENDING_SIGN')).toBe(false)
      expect(isSafeTxTerminal('READY_TO_EXECUTE')).toBe(false)
      expect(isSafeTxTerminal('CONFIRMING')).toBe(false)
    })
    test('CONFIRMING / terminal are not signable / cancellable / executable', () => {
      expect(isSafeTxSignable('CONFIRMING')).toBe(false)
      expect(isSafeTxSignable('EXECUTED')).toBe(false)
      expect(isSafeTxCancellable('CONFIRMING')).toBe(false)
      expect(isSafeTxExecutable('CONFIRMING')).toBe(false)
      expect(isSafeTxExecutable('PENDING_SIGN')).toBe(false)
    })
  })
})

describe('mostAdvancedSafeTxStatus', () => {
  describe('positive', () => {
    test('takes the queue row when it is ahead of the detail payload', () => {
      // The reported bug: the list already showed Confirming while the drawer
      // still held the PENDING_SIGN snapshot and offered Sign.
      expect(mostAdvancedSafeTxStatus('PENDING_SIGN', 'CONFIRMING')).toBe('CONFIRMING')
      expect(mostAdvancedSafeTxStatus('PENDING_SIGN', 'READY_TO_EXECUTE')).toBe(
        'READY_TO_EXECUTE',
      )
      expect(mostAdvancedSafeTxStatus('READY_TO_EXECUTE', 'EXECUTED')).toBe('EXECUTED')
    })

    test('takes the detail payload when IT is the one ahead', () => {
      expect(mostAdvancedSafeTxStatus('CONFIRMING', 'PENDING_SIGN')).toBe('CONFIRMING')
      expect(mostAdvancedSafeTxStatus('EXECUTED', 'READY_TO_EXECUTE')).toBe('EXECUTED')
    })

    test('orders the lifecycle strictly forward', () => {
      expect(safeTxStatusOrder('PENDING_SIGN')).toBeLessThan(
        safeTxStatusOrder('READY_TO_EXECUTE'),
      )
      expect(safeTxStatusOrder('READY_TO_EXECUTE')).toBeLessThan(
        safeTxStatusOrder('CONFIRMING'),
      )
      expect(safeTxStatusOrder('CONFIRMING')).toBeLessThan(safeTxStatusOrder('EXECUTED'))
    })
  })

  describe('negative', () => {
    test('never walks a transaction backwards', () => {
      // A stale second opinion must not undo progress the detail already knows.
      expect(mostAdvancedSafeTxStatus('EXECUTED', 'PENDING_SIGN')).toBe('EXECUTED')
      expect(mostAdvancedSafeTxStatus('CONFIRMING', 'READY_TO_EXECUTE')).toBe('CONFIRMING')
    })

    test('a missing second opinion changes nothing', () => {
      expect(mostAdvancedSafeTxStatus('PENDING_SIGN', undefined)).toBe('PENDING_SIGN')
      expect(mostAdvancedSafeTxStatus('PENDING_SIGN', null)).toBe('PENDING_SIGN')
    })
  })

  describe('edge cases', () => {
    test('identical statuses keep the primary', () => {
      expect(mostAdvancedSafeTxStatus('CONFIRMING', 'CONFIRMING')).toBe('CONFIRMING')
    })

    test('the three terminals share a rank, so neither overrides the other', () => {
      // FAILED and CANCELLED are different endings, not different distances —
      // whichever view holds the full payload (the detail) keeps its own.
      expect(safeTxStatusOrder('EXECUTED')).toBe(safeTxStatusOrder('FAILED'))
      expect(safeTxStatusOrder('FAILED')).toBe(safeTxStatusOrder('CANCELLED'))
      expect(mostAdvancedSafeTxStatus('FAILED', 'EXECUTED')).toBe('FAILED')
      expect(mostAdvancedSafeTxStatus('CANCELLED', 'FAILED')).toBe('CANCELLED')
    })

    test('an unrecognised status ranks lowest and never displaces a known one', () => {
      expect(safeTxStatusOrder('WEIRD' as SafeTxStatus)).toBe(0)
      expect(mostAdvancedSafeTxStatus('CONFIRMING', 'WEIRD' as SafeTxStatus)).toBe(
        'CONFIRMING',
      )
    })
  })
})

describe('SAFE_TX_TABS', () => {
  describe('positive', () => {
    test('should start with All and include the six reference tabs', () => {
      expect(SAFE_TX_TABS[0]).toEqual({ value: '', label: 'All', showCount: false })
      expect(SAFE_TX_TABS.map((t) => t.value)).toEqual([
        '',
        'PENDING_SIGN',
        'READY_TO_EXECUTE',
        'CONFIRMING',
        'EXECUTED',
        'FAILED',
      ])
    })
    test('counted statuses are the three in-flight tabs', () => {
      expect(SAFE_TX_COUNTED_STATUSES).toEqual([
        'PENDING_SIGN',
        'READY_TO_EXECUTE',
        'CONFIRMING',
      ])
    })
  })
})

describe('getActivityLabel / isUnknownActivity', () => {
  describe('positive', () => {
    test('maps known activities to readable labels', () => {
      expect(getActivityLabel('MINT')).toBe('Mint')
      expect(getActivityLabel('ADD_BLACKLIST')).toBe('Add to blacklist')
      expect(getActivityLabel('SET_SUPPORTED_CHAIN')).toBe('Set supported chain')
    })
    test('flags UNKNOWN for the blind-sign guard', () => {
      expect(isUnknownActivity('UNKNOWN')).toBe(true)
      expect(isUnknownActivity('MINT')).toBe(false)
    })
  })
})
