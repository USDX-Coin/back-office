// Safe Wallet UI URL builder.
//
// Format used by app.safe.global:
//   https://app.safe.global/transactions/tx
//     ?safe=<chainPrefix>:<safeAddress>
//     &id=multisig_<safeAddress>_<safeTxHash>
//
// Chain prefixes match what Safe expects in its `safe` query param. Phase 1
// targets Polygon (mainnet `matic`, Amoy testnet `pol`); the rest are listed
// for parity with the Network enum.

export const SAFE_APP_BASE_URL = 'https://app.safe.global'

export const CHAIN_PREFIX_BY_ID: Record<number, string> = {
  1: 'eth', // Ethereum mainnet
  137: 'matic', // Polygon mainnet
  80002: 'pol', // Polygon Amoy testnet
  8453: 'base', // Base mainnet
  42161: 'arb1', // Arbitrum One
}

export interface SafeUrlInput {
  chainId: number
  safeAddress: string
  safeTxHash: string
}

/**
 * Build a Safe UI deep-link to the multisig transaction detail view.
 * Throws when chainId is unknown — callers should pre-validate.
 */
export function buildSafeUrl({ chainId, safeAddress, safeTxHash }: SafeUrlInput): string {
  const prefix = CHAIN_PREFIX_BY_ID[chainId]
  if (!prefix) {
    throw new Error(`Unsupported Safe chainId: ${chainId}`)
  }
  if (!safeAddress) throw new Error('Missing safeAddress')
  if (!safeTxHash) throw new Error('Missing safeTxHash')

  const params = new URLSearchParams({
    safe: `${prefix}:${safeAddress}`,
    id: `multisig_${safeAddress}_${safeTxHash}`,
  })
  return `${SAFE_APP_BASE_URL}/transactions/tx?${params.toString()}`
}

/** Minimal slice of ChainConfig (sot/api/chains.yaml) needed to build a Safe link. */
export interface SafeChainConfig {
  chainId: number
  staffSafeAddress: string
  managerSafeAddress: string
}

/**
 * Resolve a Safe UI deep-link for a request row/detail. Returns `null` when the
 * chain config is unavailable, the safeTxHash is missing, or the chainId is not
 * one Safe supports — callers fall back to plain copyable text in that case.
 */
export function safeTxUrl(params: {
  chain: SafeChainConfig | undefined
  safeType: 'STAFF' | 'MANAGER'
  safeTxHash: string | null | undefined
}): string | null {
  const { chain, safeType, safeTxHash } = params
  if (!chain || !safeTxHash) return null
  const safeAddress = safeType === 'STAFF' ? chain.staffSafeAddress : chain.managerSafeAddress
  if (!safeAddress) return null
  try {
    return buildSafeUrl({ chainId: chain.chainId, safeAddress, safeTxHash })
  } catch {
    return null
  }
}
