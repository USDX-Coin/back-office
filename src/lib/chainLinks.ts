// Pure helpers for resolving on-chain deep-links (block explorer + Safe UI)
// from a request row + the chain config served by GET /api/v1/chains.

import { buildTxExplorerUrl } from './explorerUrl'
import { safeTxUrl } from './safeUrl'
import type { ChainConfig, RequestListItem } from './types'

/** Find the config for a given chain identifier (case-insensitive). */
export function findChainConfig(
  configs: ChainConfig[] | undefined,
  chain: string | undefined
): ChainConfig | undefined {
  if (!configs || !chain) return undefined
  const needle = chain.toLowerCase()
  return configs.find((c) => c.chain.toLowerCase() === needle)
}

/**
 * Resolve the on-chain deep-links for a Mint/Burn list row:
 *   - explorerHref: block explorer link from `onChainTxHash` (set once EXECUTED / IDR_TRANSFERRED)
 *   - safeHref: Safe UI link from `safeTxHash`
 * Either may be `null` (hash absent, chain config not loaded, or chainId Safe
 * doesn't recognise) — the caller then shows the raw hash as plain text or `—`.
 */
export function resolveOnChainLinks(
  row: RequestListItem,
  chains: ChainConfig[] | undefined
): { explorerHref: string | null; safeHref: string | null } {
  const cfg = findChainConfig(chains, row.chain)
  return {
    explorerHref:
      row.onChainTxHash && cfg ? buildTxExplorerUrl(cfg.blockExplorerUrl, row.onChainTxHash) : null,
    safeHref: safeTxUrl({ chain: cfg, safeType: row.safeType, safeTxHash: row.safeTxHash }),
  }
}
