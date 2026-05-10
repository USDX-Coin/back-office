import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { chainToChainId, resolveSafeAddress } from '../safeWallet'

beforeEach(() => {
  vi.unstubAllEnvs()
})
afterEach(() => {
  vi.unstubAllEnvs()
})

describe('resolveSafeAddress', () => {
  describe('positive', () => {
    test('should return the staff address for STAFF on polygon', () => {
      vi.stubEnv('VITE_POLYGON_STAFF_SAFE_ADDRESS', '0xstaff')
      vi.stubEnv('VITE_POLYGON_MANAGER_SAFE_ADDRESS', '0xmgr')
      expect(resolveSafeAddress({ safeType: 'STAFF', chain: 'polygon' })).toBe(
        '0xstaff'
      )
    })

    test('should return the manager address for MANAGER on polygon', () => {
      vi.stubEnv('VITE_POLYGON_STAFF_SAFE_ADDRESS', '0xstaff')
      vi.stubEnv('VITE_POLYGON_MANAGER_SAFE_ADDRESS', '0xmgr')
      expect(
        resolveSafeAddress({ safeType: 'MANAGER', chain: 'polygon' })
      ).toBe('0xmgr')
    })

    test('should accept mixed-case chain strings', () => {
      vi.stubEnv('VITE_POLYGON_STAFF_SAFE_ADDRESS', '0xstaff')
      vi.stubEnv('VITE_POLYGON_MANAGER_SAFE_ADDRESS', '0xmgr')
      expect(resolveSafeAddress({ safeType: 'STAFF', chain: 'Polygon' })).toBe(
        '0xstaff'
      )
      expect(resolveSafeAddress({ safeType: 'STAFF', chain: 'POLYGON' })).toBe(
        '0xstaff'
      )
    })
  })

  describe('negative', () => {
    test('should throw when chain is not polygon', () => {
      expect(() =>
        resolveSafeAddress({ safeType: 'STAFF', chain: 'ethereum' })
      ).toThrow(/Safe address not configured for chain "ethereum"/)
    })

    test('should throw when STAFF env var is missing', () => {
      vi.stubEnv('VITE_POLYGON_STAFF_SAFE_ADDRESS', '')
      vi.stubEnv('VITE_POLYGON_MANAGER_SAFE_ADDRESS', '0xmgr')
      expect(() =>
        resolveSafeAddress({ safeType: 'STAFF', chain: 'polygon' })
      ).toThrow(/VITE_POLYGON_STAFF_SAFE_ADDRESS/)
    })

    test('should throw when MANAGER env var is missing', () => {
      vi.stubEnv('VITE_POLYGON_STAFF_SAFE_ADDRESS', '0xstaff')
      vi.stubEnv('VITE_POLYGON_MANAGER_SAFE_ADDRESS', '')
      expect(() =>
        resolveSafeAddress({ safeType: 'MANAGER', chain: 'polygon' })
      ).toThrow(/VITE_POLYGON_MANAGER_SAFE_ADDRESS/)
    })
  })
})

describe('chainToChainId', () => {
  describe('positive', () => {
    test('should map polygon to 137', () => {
      expect(chainToChainId('polygon')).toBe(137)
    })

    test('should map ethereum to 1', () => {
      expect(chainToChainId('ethereum')).toBe(1)
    })

    test('should be case-insensitive', () => {
      expect(chainToChainId('Polygon')).toBe(137)
      expect(chainToChainId('POLYGON')).toBe(137)
    })
  })

  describe('edge cases', () => {
    test('should fall back to VITE_SAFE_CHAIN_ID for unknown chain strings', () => {
      vi.stubEnv('VITE_SAFE_CHAIN_ID', '80002')
      expect(chainToChainId('mystery-net')).toBe(80002)
    })

    test('should default chainId to 137 when VITE_SAFE_CHAIN_ID is empty', () => {
      vi.stubEnv('VITE_SAFE_CHAIN_ID', '')
      expect(chainToChainId('mystery-net')).toBe(137)
    })
  })
})
