import { describe, expect, test } from 'vitest'
import { ApiError } from '../apiFetch'
import {
  buildPgSettingsBody,
  formatIdrDifference,
  isBelowPrefundingLow,
  isPgSettlementStaleError,
  pgSettlementErrorMessage,
  pgSettlementStatusPill,
  validatePgReason,
  validatePrefundingLow,
} from '../pgSettlements'

const current = { mode: 'NET', senderPattern: 'DURIANPAY', prefundingLowIdr: '200000000.00' }

describe('pgSettlements', () => {
  describe('positive', () => {
    test('should label every batch status and keep unknown codes', () => {
      expect(pgSettlementStatusPill('MISMATCH').label).toBe('Tidak cocok')
      expect(pgSettlementStatusPill('NEW').label).toBe('NEW')
    })
    test('should spell the difference in words', () => {
      expect(formatIdrDifference('-150000.00')).toBe('kurang Rp 150.000,00')
      expect(formatIdrDifference('2500.00')).toBe('lebih Rp 2.500,00')
      expect(formatIdrDifference('0.00')).toBe('pas')
    })
    test('should build a PUT body with normalised amount', () => {
      const r = buildPgSettingsBody({ mode: 'GROSS', senderPattern: ' DURIANPAY ', prefundingLowIdr: '150000000', reason: 'kontrak Durianpay GROSS' }, current)
      expect(r).toEqual({
        valid: true,
        unchanged: false,
        body: { mode: 'GROSS', senderPattern: 'DURIANPAY', prefundingLowIdr: '150000000.00', reason: 'kontrak Durianpay GROSS' },
      })
    })
  })
  describe('negative', () => {
    test('should reject invalid values before sending', () => {
      const r = buildPgSettingsBody({ mode: 'X', senderPattern: '  ', prefundingLowIdr: '1.000.000', reason: 'pendek' }, current)
      expect(r.valid).toBe(false)
      if (!r.valid) expect(Object.keys(r.errors).sort()).toEqual(['mode', 'prefundingLowIdr', 'reason', 'senderPattern'])
    })
    test('should require a 10-character reason', () => {
      expect(validatePgReason('123456789').error).toBeTruthy()
      expect(validatePgReason('1234567890').error).toBeNull()
    })
  })
  describe('edge cases', () => {
    test('should treat an empty limit as "no alert" (null)', () => {
      expect(validatePrefundingLow('')).toEqual({ value: null, error: null })
    })
    test('should detect an unchanged form', () => {
      const r = buildPgSettingsBody({ mode: 'NET', senderPattern: 'DURIANPAY', prefundingLowIdr: '200000000', reason: 'tidak ada perubahan' }, current)
      expect(r.unchanged).toBe(true)
    })
    test('should compare balance with the limit only when both are readable', () => {
      expect(isBelowPrefundingLow('100.00', '200.00')).toBe(true)
      expect(isBelowPrefundingLow('300.00', '200.00')).toBe(false)
      expect(isBelowPrefundingLow(null, '200.00')).toBeNull()
      expect(isBelowPrefundingLow('100', null)).toBeNull()
    })
    test('should map 409 codes and mark them stale', () => {
      const e = new ApiError(409, 'CONFLICT', 'CREDIT_ALREADY_LINKED')
      expect(pgSettlementErrorMessage(e)).toContain('batch lain')
      expect(isPgSettlementStaleError(e)).toBe(true)
      expect(isPgSettlementStaleError(new ApiError(400, 'BAD_REQUEST', 'x'))).toBe(false)
    })
  })
})
