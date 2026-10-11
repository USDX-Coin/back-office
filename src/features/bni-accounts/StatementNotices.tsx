import { History, TriangleAlert } from 'lucide-react'
import type { BniStatementGap } from '@/lib/types'
import { gapNoticeText } from './statementCopy'

// USDX-692 — sot/bni-integration.md § 16.8.8: what the operator must know about
// the COPY before reading the table under it. Rendered inside the results
// header, i.e. above the table.
//
// Gap warnings carry NO dismiss / ignore control on purpose (K15): a gap closes
// only when the row that reconnects the balance chain is stored. Phase 2
// (§ 16.8.11) adds an upload button here — not before.

interface Props {
  /** "Riwayat tersedia sejak …" — null when the applied range lies inside the history. */
  historyText: string | null
  gaps: readonly BniStatementGap[]
  /** Account currency — the gap difference is money of THIS account (`IDR` → Rp, `USD` → $). */
  currency: string | null | undefined
}

export default function StatementNotices({ historyText, gaps, currency }: Props) {
  if (!historyText && gaps.length === 0) return null
  return (
    <div className="space-y-2">
      {historyText && (
        <p
          className="flex items-start gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-foreground"
          role="status"
          data-testid="bni-statement-history-notice"
        >
          <History className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <span>{historyText}</span>
        </p>
      )}
      {gaps.length > 0 && (
        <ul className="space-y-2" aria-label="Mutasi yang tidak terekam">
          {gaps.map((gap, i) => (
            <li
              // A gap has no id; its bracketing points identify it within one response.
              key={`${gap.afterAt ?? ''}-${gap.beforeAt}-${i}`}
              className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-foreground"
              data-testid="bni-statement-gap"
            >
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
              <span>{gapNoticeText(gap, currency)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
