import { describe, expect, test } from 'vitest'
import { formatPgMdr, isPgMdrChanged, isPgMdrMissing, validatePgMdr } from '../paymentMethods'

const va = { pgMdrType: null, pgMdrValue: null, requiresFxSwap: true }

describe('tarif kontrak PG (D29)', () => {
  describe('positive', () => {
    test('should format flat and percent contract rates', () => {
      expect(formatPgMdr({ pgMdrType: 'FLAT_IDR', pgMdrValue: '4000.00' })).toBe('Rp 4.000,00')
      expect(formatPgMdr({ pgMdrType: 'PERCENT', pgMdrValue: '0.7000' })).toBe('0,7%')
    })
    test('should accept a valid pair', () => {
      expect(validatePgMdr(va, 'FLAT_IDR', '4000')).toBeNull()
    })
  })
  describe('negative', () => {
    test('should flag (not block) a missing rate on a method that needs a swap', () => {
      expect(isPgMdrMissing(va)).toBe(true)
      expect(validatePgMdr(va, '', '')).toBeNull()
    })
    test('should reject a value without a type, and a bad percent', () => {
      expect(validatePgMdr(va, '', '4000')).toBeTruthy()
      expect(validatePgMdr(va, 'PERCENT', '120')).toBeTruthy()
    })
  })
  describe('edge cases', () => {
    test('should allow leaving it empty when no swap is needed', () => {
      expect(validatePgMdr({ ...va, requiresFxSwap: false }, '', '')).toBeNull()
      expect(formatPgMdr({ pgMdrType: null, pgMdrValue: null })).toBeNull()
    })
    test('should compare as numbers, not spelling', () => {
      const m = { pgMdrType: 'FLAT_IDR', pgMdrValue: '4000.00' }
      expect(isPgMdrChanged(m, 'FLAT_IDR', '4000')).toBe(false)
      expect(isPgMdrChanged(m, 'FLAT_IDR', '4500')).toBe(true)
      expect(isPgMdrChanged(m, '', '')).toBe(false)
    })
  })
})
