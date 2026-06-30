import { describe, test, expect } from 'vitest'
import {
  getSafeTxStatusConfig,
  isSafeTxTerminal,
  isSafeTxSignable,
  isSafeTxCancellable,
  isSafeTxExecutable,
  getActivityLabel,
  isUnknownActivity,
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
