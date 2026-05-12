import { describe, test, expect } from 'vitest'
import { findChainConfig } from '../hooks'
import type { ChainConfig } from '@/lib/types'

const polygon: ChainConfig = {
  chain: 'polygon',
  chainId: 137,
  name: 'Polygon',
  blockExplorerUrl: 'https://polygonscan.com',
  staffSafeAddress: '0x1111111111111111111111111111111111111111',
  managerSafeAddress: '0x2222222222222222222222222222222222222222',
  usdxAddress: '0x3333333333333333333333333333333333333333',
}

describe('findChainConfig', () => {
  describe('positive', () => {
    test('matches by chain identifier', () => {
      expect(findChainConfig([polygon], 'polygon')).toBe(polygon)
    })

    test('matches case-insensitively', () => {
      expect(findChainConfig([polygon], 'POLYGON')).toBe(polygon)
    })
  })

  describe('edge cases', () => {
    test('returns undefined for an unknown chain', () => {
      expect(findChainConfig([polygon], 'base')).toBeUndefined()
    })

    test('returns undefined when configs is undefined', () => {
      expect(findChainConfig(undefined, 'polygon')).toBeUndefined()
    })

    test('returns undefined when chain is undefined', () => {
      expect(findChainConfig([polygon], undefined)).toBeUndefined()
    })
  })
})
