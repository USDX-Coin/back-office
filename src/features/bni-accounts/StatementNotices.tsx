import { History } from 'lucide-react'

// USDX-692 — sot/bni-integration.md § 16.8.8: what the operator must know about
// the COPY before reading the table under it. Rendered inside the results
// header, i.e. above the table.

interface Props {
  /** "Riwayat tersedia sejak …" — null when the applied range lies inside the history. */
  historyText: string | null
}

export default function StatementNotices({ historyText }: Props) {
  if (!historyText) return null
  return (
    <div className="space-y-2">
      <p
        className="flex items-start gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-[12.5px] text-foreground"
        role="status"
        data-testid="bni-statement-history-notice"
      >
        <History className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <span>{historyText}</span>
      </p>
    </div>
  )
}
