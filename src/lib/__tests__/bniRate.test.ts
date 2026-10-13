import { describe, test, expect } from 'vitest'
import {
  bniBuyRatePayload,
  bniBuyRateRange,
  gatewayMarkupPayload,
  isBniBuyRateOutOfRange,
  isBniBuyRateUnchanged,
  isBniBuyRateStale,
} from '@/lib/bniRate'

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
    test('should re-send the same number only when re-checked in wondr (so the time moves)', () => {
      expect(bniBuyRatePayload('16250', '16250.00', { reconfirmed: true })).toBe('16250')
      expect(bniBuyRatePayload('16250', '16250.00', { reconfirmed: false })).toBeUndefined()
    })
  })
})

// Keputusan PM 13 Okt 2026 (backend USDX-749): ±10% inklusif dari kurs dasar.
describe('bniBuyRateRange / isBniBuyRateOutOfRange', () => {
  describe('positive', () => {
    test('should give base ±10%', () => {
      const r = bniBuyRateRange('16200.00')!
      expect(r.min).toBeCloseTo(14580)
      expect(r.max).toBeCloseTo(17820)
    })
    test('should flag a one-digit typo', () => {
      expect(isBniBuyRateOutOfRange('1625', bniBuyRateRange(16250))).toBe(true)
    })
  })
  describe('negative', () => {
    test('should not flag a value inside, nor guess without a base', () => {
      expect(isBniBuyRateOutOfRange('16000', bniBuyRateRange(16200))).toBe(false)
      expect(isBniBuyRateOutOfRange('1625', null)).toBe(false)
      expect(bniBuyRateRange(null)).toBeNull()
      expect(bniBuyRateRange('abc')).toBeNull()
      expect(bniBuyRateRange(0)).toBeNull()
    })
  })
  describe('edge cases', () => {
    test('the bounds themselves are accepted (inclusive), an empty field is not flagged', () => {
      expect(isBniBuyRateOutOfRange('9000', bniBuyRateRange(10000))).toBe(false)
      expect(isBniBuyRateOutOfRange('11000', bniBuyRateRange(10000))).toBe(false)
      expect(isBniBuyRateOutOfRange('11000.01', bniBuyRateRange(10000))).toBe(true)
      expect(isBniBuyRateOutOfRange('', bniBuyRateRange(10000))).toBe(false)
    })
  })
})

// Backend USDX-749: gatewayMarkupPct yang tidak dikirim = tidak diubah.
describe('gatewayMarkupPayload / isBniBuyRateUnchanged', () => {
  describe('positive', () => {
    test('should send a changed markup, and 0 for an emptied one', () => {
      expect(gatewayMarkupPayload('2', '1')).toBe('2')
      expect(gatewayMarkupPayload('', '1')).toBe('0')
    })
  })
  describe('negative', () => {
    test('should omit an unchanged markup, however spelled', () => {
      expect(gatewayMarkupPayload('1', '1.0000')).toBeUndefined()
      expect(gatewayMarkupPayload('', '0')).toBeUndefined()
    })
  })
  describe('edge cases', () => {
    test('should send the markup when the server never reported one (old backend)', () => {
      expect(gatewayMarkupPayload('1', undefined)).toBe('1')
    })
    test('unchanged BNI rate only when both sides hold the same number', () => {
      expect(isBniBuyRateUnchanged('16250', '16250.00')).toBe(true)
      expect(isBniBuyRateUnchanged('', '16250.00')).toBe(false)
      expect(isBniBuyRateUnchanged('16250', null)).toBe(false)
    })
  })
})
