import { describe, test, expect } from 'vitest'
import { buildTxExplorerUrl, buildAddressExplorerUrl } from '../explorerUrl'

describe('buildTxExplorerUrl', () => {
  describe('positive', () => {
    test('should build {base}/tx/{hash}', () => {
      expect(buildTxExplorerUrl('https://polygonscan.com', '0xabc123')).toBe(
        'https://polygonscan.com/tx/0xabc123'
      )
    })

    test('should work for the Amoy testnet explorer', () => {
      expect(buildTxExplorerUrl('https://amoy.polygonscan.com', '0xdeadbeef')).toBe(
        'https://amoy.polygonscan.com/tx/0xdeadbeef'
      )
    })
  })

  describe('edge cases', () => {
    test('should strip a single trailing slash from the base URL', () => {
      expect(buildTxExplorerUrl('https://polygonscan.com/', '0xabc')).toBe(
        'https://polygonscan.com/tx/0xabc'
      )
    })

    test('should strip multiple trailing slashes from the base URL', () => {
      expect(buildTxExplorerUrl('https://polygonscan.com///', '0xabc')).toBe(
        'https://polygonscan.com/tx/0xabc'
      )
    })
  })
})

describe('buildAddressExplorerUrl', () => {
  describe('positive', () => {
    test('should build {base}/address/{address}', () => {
      expect(
        buildAddressExplorerUrl('https://polygonscan.com', '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed')
      ).toBe('https://polygonscan.com/address/0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed')
    })
  })

  describe('edge cases', () => {
    test('should strip a trailing slash from the base URL', () => {
      expect(buildAddressExplorerUrl('https://polygonscan.com/', '0xabc')).toBe(
        'https://polygonscan.com/address/0xabc'
      )
    })
  })
})
