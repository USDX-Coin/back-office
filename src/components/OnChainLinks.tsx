import { ExternalLink } from 'lucide-react'
import TruncatedHash from '@/components/TruncatedHash'

// USDX-27: tx hashes are shown via <TruncatedHash> so they shorten on mobile
// and lengthen on ≥md, staying proportional to the (narrow) table cell.
const HASH_MOBILE = { head: 6, tail: 4 }
const HASH_DESKTOP = { head: 10, tail: 6 }

/**
 * Table cell: a short tx hash that links out (block explorer / Safe UI) — the
 * same affordance as the request detail modal, surfaced directly in the list.
 * Renders `—` when there's no hash, and plain dim text when there's a hash but
 * no resolvable link. Clicks stop propagation so they don't open the row modal.
 *
 * Link resolution lives in `@/lib/chainLinks` (`resolveOnChainLinks`).
 */
export function TxHashLink({
  hash,
  href,
  label,
}: {
  hash: string | null | undefined
  href: string | null
  label: string
}) {
  if (!hash) return <span className="text-muted-foreground/40">—</span>
  if (!href) {
    return (
      <span className="font-mono text-[11px] tabular-nums text-muted-foreground" title={hash}>
        <TruncatedHash value={hash} mobile={HASH_MOBILE} desktop={HASH_DESKTOP} />
      </span>
    )
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      title={`${label}: ${hash}`}
      aria-label={`${label} ${hash}`}
      className="inline-flex items-center gap-1 font-mono text-[11px] tabular-nums text-primary transition-colors hover:underline"
    >
      <TruncatedHash value={hash} mobile={HASH_MOBILE} desktop={HASH_DESKTOP} />
      <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
    </a>
  )
}
