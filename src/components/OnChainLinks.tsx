import { ExternalLink, ShieldCheck } from 'lucide-react'
import { buildTxExplorerUrl } from '@/lib/explorerUrl'
import { safeTxUrl } from '@/lib/safeUrl'
import { findChainConfig } from '@/features/chains/hooks'
import type { ChainConfig, RequestListItem } from '@/lib/types'

function IconLink({
  href,
  label,
  children,
}: {
  href: string
  label: string
  children: React.ReactNode
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      title={label}
      aria-label={label}
      className="text-muted-foreground transition-colors hover:text-primary"
    >
      {children}
    </a>
  )
}

/**
 * Compact on-chain link affordance for a Mint/Burn list row:
 *   - Block explorer link from `onChainTxHash` (present once EXECUTED / IDR_TRANSFERRED)
 *   - Safe UI link from `safeTxHash`
 * Each link stops row-click propagation so it doesn't open the detail modal.
 * Renders an em dash when neither hash (or the chain config) is available.
 */
export default function OnChainLinks({
  row,
  chains,
}: {
  row: RequestListItem
  chains: ChainConfig[] | undefined
}) {
  const cfg = findChainConfig(chains, row.chain)
  const explorerHref =
    row.onChainTxHash && cfg ? buildTxExplorerUrl(cfg.blockExplorerUrl, row.onChainTxHash) : null
  const safeHref = safeTxUrl({ chain: cfg, safeType: row.safeType, safeTxHash: row.safeTxHash })

  if (!explorerHref && !safeHref) {
    return <span className="text-muted-foreground/40">—</span>
  }
  return (
    <span className="inline-flex items-center gap-2.5">
      {explorerHref && (
        <IconLink href={explorerHref} label="View transaction on block explorer">
          <ExternalLink className="h-3.5 w-3.5" />
        </IconLink>
      )}
      {safeHref && (
        <IconLink href={safeHref} label="View in Safe">
          <ShieldCheck className="h-3.5 w-3.5" />
        </IconLink>
      )}
    </span>
  )
}
