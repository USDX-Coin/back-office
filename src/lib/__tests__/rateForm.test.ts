import { describe, test, expect } from 'vitest'
import { ApiError } from '@/lib/apiFetch'
import { bniDeviationPayload, gatewayMarkupPayload, rateSourceUnavailableMessage } from '@/lib/rateForm'

// Backend USDX-749: gatewayMarkupPct yang tidak dikirim = tidak diubah.
describe('gatewayMarkupPayload', () => {
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
  })
})

// D28 — X: dihilangkan dari body = X aktif dibawa (rate.yaml § UpdateRateConfig).
describe('bniDeviationPayload', () => {
  describe('positive', () => {
    test('should send a filled X as typed, even when equal to the active X', () => {
      expect(bniDeviationPayload('3')).toBe('3')
      expect(bniDeviationPayload(' 5.5 ')).toBe('5.5')
    })
  })
  describe('negative', () => {
    test('should omit an emptied X so the server keeps the active one', () => {
      expect(bniDeviationPayload('')).toBeUndefined()
    })
  })
  describe('edge cases', () => {
    test('should treat whitespace-only as empty', () => {
      expect(bniDeviationPayload('   ')).toBeUndefined()
    })
  })
})

// D28-i / §20.4 rev-31: 422 RATE_SOURCE_UNAVAILABLE + error.details.reason.
describe('rateSourceUnavailableMessage', () => {
  const rejected = (details: unknown) =>
    new ApiError(422, 'RATE_SOURCE_UNAVAILABLE', 'Kurs BNI sedang tidak bisa diambil', details)

  describe('positive', () => {
    test('should advise raising X when the guard rejected the rate', () => {
      expect(rateSourceUnavailableMessage(rejected({ reason: 'BNI_DEVIATION' }))).toBe(
        'Kurs BNI ditolak pengaman pergeseran — naikkan batas pergeseran (X) lalu coba lagi dalam ±2 menit.',
      )
    })
    test('should say the rate cannot be fetched for the other reasons', () => {
      for (const reason of ['BNI_UNREACHABLE', 'BNI_MALFORMED']) {
        expect(rateSourceUnavailableMessage(rejected({ reason }))).toBe(
          'Kurs BNI sedang tidak bisa diambil, mode BNI belum bisa dipilih.',
        )
      }
    })
  })
  describe('negative', () => {
    test('should leave other errors to the generic form message', () => {
      expect(rateSourceUnavailableMessage(new ApiError(422, 'VALIDATION_ERROR', 'x'))).toBeNull()
      expect(rateSourceUnavailableMessage(new ApiError(403, 'FORBIDDEN', 'x'))).toBeNull()
      expect(rateSourceUnavailableMessage(new Error('network'))).toBeNull()
    })
  })
  describe('edge cases', () => {
    test('should fall back to "cannot be fetched" when details or reason is missing', () => {
      const fetchFail = 'Kurs BNI sedang tidak bisa diambil, mode BNI belum bisa dipilih.'
      expect(rateSourceUnavailableMessage(rejected(undefined))).toBe(fetchFail)
      expect(rateSourceUnavailableMessage(rejected(null))).toBe(fetchFail)
      expect(rateSourceUnavailableMessage(rejected({ reason: 'SOMETHING_NEW' }))).toBe(fetchFail)
    })
  })
})
