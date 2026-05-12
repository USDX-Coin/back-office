import { ExternalLink } from 'lucide-react'
import { shortHash } from '@/lib/format'

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
        {shortHash(hash)}
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
      {shortHash(hash)}
      <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
    </a>
  )
}
