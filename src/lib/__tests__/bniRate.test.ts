import { describe, test, expect } from 'vitest'
import { bniBuyRatePayload, isBniBuyRateStale } from '@/lib/bniRate'

const NOW = new Date('2026-10-13T05:00:00.000Z') // 12.00 WIB

describe('isBniBuyRateStale', () => {
  describe('positive', () => {
    test('should be stale after 25 hours', () => {
      expect(isBniBuyRateStale('2026-10-12T04:00:00.000Z', NOW)).toBe(true)
    })
  })
  describe('negative', () => {
    test('should not be stale after 30 minutes or without a timestamp', () => {
      expect(isBniBuyRateStale('2026-10-13T04:30:00.000Z', NOW)).toBe(false)
      expect(isBniBuyRateStale(null, NOW)).toBe(false)
      expect(isBniBuyRateStale(undefined, NOW)).toBe(false)
    })
  })
  describe('edge cases', () => {
    test('exactly 24 hours is not yet stale, 24 hours + 1 ms is', () => {
      expect(isBniBuyRateStale('2026-10-12T05:00:00.000Z', NOW)).toBe(false)
      expect(isBniBuyRateStale('2026-10-12T04:59:59.999Z', NOW)).toBe(true)
    })
    test('an unparsable timestamp is not guessed as stale', () => {
      expect(isBniBuyRateStale('kemarin', NOW)).toBe(false)
    })
  })
})

// `rate.yaml § UpdateRateConfig.bniBuyRate`: dihilangkan = nilai + jam lama
// dibawa; null = dikosongkan; diisi = angka baru.
describe('bniBuyRatePayload', () => {
  describe('positive', () => {
    test('should send a changed number', () => {
      expect(bniBuyRatePayload('16180.75', '16250.00')).toBe('16180.75')
    })
    test('should send the first number when none was set', () => {
      expect(bniBuyRatePayload(' 16250 ', null)).toBe('16250')
    })
  })
  describe('negative', () => {
    test('should omit an unchanged number, even spelled differently', () => {
      expect(bniBuyRatePayload('16250.00', '16250.00')).toBeUndefined()
      expect(bniBuyRatePayload('16250', '16250.00')).toBeUndefined()
    })
    test('should omit an empty field when nothing was set', () => {
      expect(bniBuyRatePayload('', null)).toBeUndefined()
      expect(bniBuyRatePayload('  ', undefined)).toBeUndefined()
    })
  })
  describe('edge cases', () => {
    test('should send null when an existing rate is cleared', () => {
      expect(bniBuyRatePayload('', '16250.00')).toBeNull()
    })
  })
})
