import { describe, test, expect } from 'vitest'
import { findChainConfig, resolveOnChainLinks } from '@/lib/chainLinks'
import type { ChainConfig, RequestListItem } from '@/lib/types'

const STAFF_SAFE = '0x1111111111111111111111111111111111111111'
const MANAGER_SAFE = '0x2222222222222222222222222222222222222222'

const polygon: ChainConfig = {
  chain: 'polygon',
  chainId: 137,
  name: 'Polygon',
  blockExplorerUrl: 'https://polygonscan.com',
  staffSafeAddress: STAFF_SAFE,
  managerSafeAddress: MANAGER_SAFE,
  usdxAddress: '0x3333333333333333333333333333333333333333',
}

const ON_CHAIN = '0x' + 'a'.repeat(64)
const SAFE_TX = '0x' + 'b'.repeat(64)

function row(overrides: Partial<RequestListItem> = {}): RequestListItem {
  return {
    id: 'r1',
    type: 'mint',
    userId: 'u1',
    userName: 'Alice',
    userAddress: STAFF_SAFE,
    amount: '100.00',
    amountIdr: '1625000',
    chain: 'polygon',
    safeType: 'STAFF',
    status: 'EXECUTED',
    safeTxHash: SAFE_TX,
    onChainTxHash: ON_CHAIN,
    createdBy: 's1',
    createdByName: 'Sam Operator',
    createdAt: '2026-05-01T00:00:00Z',
    ...overrides,
  }
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

describe('resolveOnChainLinks', () => {
  describe('positive', () => {
    test('builds explorer + Safe hrefs from the chain config', () => {
      const { explorerHref, safeHref } = resolveOnChainLinks(row(), [polygon])
      expect(explorerHref).toBe(`https://polygonscan.com/tx/${ON_CHAIN}`)
      expect(safeHref).toContain(`matic%3A${STAFF_SAFE}`)
      expect(safeHref).toContain(`multisig_${STAFF_SAFE}_${SAFE_TX}`)
    })

    test('uses the MANAGER safe address for safeType MANAGER', () => {
      const { safeHref } = resolveOnChainLinks(row({ safeType: 'MANAGER' }), [polygon])
      expect(safeHref).toContain(`matic%3A${MANAGER_SAFE}`)
    })
  })

  describe('edge cases', () => {
    test('returns nulls when chain config is unavailable', () => {
      expect(resolveOnChainLinks(row(), undefined)).toEqual({ explorerHref: null, safeHref: null })
    })

    test('explorerHref is null when onChainTxHash is null', () => {
      expect(resolveOnChainLinks(row({ onChainTxHash: null }), [polygon]).explorerHref).toBeNull()
    })

    test('safeHref is null when safeTxHash is null', () => {
      expect(resolveOnChainLinks(row({ safeTxHash: null }), [polygon]).safeHref).toBeNull()
    })

    test('returns nulls when the row chain is not in the config list', () => {
      expect(resolveOnChainLinks(row({ chain: 'arbitrum' }), [polygon])).toEqual({
        explorerHref: null,
        safeHref: null,
      })
    })
  })
})
