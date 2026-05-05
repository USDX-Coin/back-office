import { describe, test, expect } from 'vitest'
import { buildSafeUrl, CHAIN_PREFIX_BY_ID, SAFE_APP_BASE_URL } from '../safeUrl'

describe('buildSafeUrl', () => {
  describe('positive', () => {
    test('should build a Polygon mainnet Safe tx URL with the matic prefix', () => {
      const url = buildSafeUrl({
        chainId: 137,
        safeAddress: '0x1111111111111111111111111111111111111111',
        safeTxHash: '0xabc',
      })
      expect(url.startsWith(SAFE_APP_BASE_URL)).toBe(true)
      expect(url).toContain('safe=matic%3A0x1111111111111111111111111111111111111111')
      expect(url).toContain(
        'id=multisig_0x1111111111111111111111111111111111111111_0xabc'
      )
    })

    test('should use the pol prefix for Polygon Amoy testnet', () => {
      const url = buildSafeUrl({
        chainId: 80002,
        safeAddress: '0x2222222222222222222222222222222222222222',
        safeTxHash: '0xdef',
      })
      expect(url).toContain('safe=pol%3A0x2222222222222222222222222222222222222222')
    })

    test('should use the eth prefix for Ethereum mainnet', () => {
      const url = buildSafeUrl({
        chainId: 1,
        safeAddress: '0x3333333333333333333333333333333333333333',
        safeTxHash: '0x99',
      })
      expect(url).toContain('safe=eth%3A0x3333333333333333333333333333333333333333')
    })

    test('should be parseable back into the expected query params', () => {
      const url = buildSafeUrl({
        chainId: 137,
        safeAddress: '0x4444444444444444444444444444444444444444',
        safeTxHash: '0xaabb',
      })
      const parsed = new URL(url)
      expect(parsed.searchParams.get('safe')).toBe(
        'matic:0x4444444444444444444444444444444444444444'
      )
      expect(parsed.searchParams.get('id')).toBe(
        'multisig_0x4444444444444444444444444444444444444444_0xaabb'
      )
    })
  })

  describe('negative', () => {
    test('should throw when chainId is unknown', () => {
      expect(() =>
        buildSafeUrl({
          chainId: 9999,
          safeAddress: '0xabc',
          safeTxHash: '0xdef',
        })
      ).toThrow(/Unsupported Safe chainId/)
    })

    test('should throw when safeAddress is empty', () => {
      expect(() =>
        buildSafeUrl({ chainId: 137, safeAddress: '', safeTxHash: '0xdef' })
      ).toThrow(/safeAddress/)
    })

    test('should throw when safeTxHash is empty', () => {
      expect(() =>
        buildSafeUrl({ chainId: 137, safeAddress: '0xabc', safeTxHash: '' })
      ).toThrow(/safeTxHash/)
    })
  })

  describe('edge cases', () => {
    test('should expose all 5 chain prefixes the Network enum may target', () => {
      // Phase 1 targets Polygon, but we list parity with the Network enum.
      expect(Object.keys(CHAIN_PREFIX_BY_ID).length).toBeGreaterThanOrEqual(5)
    })
  })
})
