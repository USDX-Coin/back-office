import { describe, test, expect } from 'vitest'
import { gatewayMarkupPayload } from '@/lib/rateForm'

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
