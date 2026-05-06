import { ArrowUpCircle, ArrowDownCircle, Clock } from 'lucide-react'
import type { OtcMintTransaction, OtcRedeemTransaction } from '@/lib/types'
import { formatRelativeTime } from '@/lib/format'

interface RecentActivityTimelineProps {
  items: Array<OtcMintTransaction | OtcRedeemTransaction>
}

function isMint(tx: OtcMintTransaction | OtcRedeemTransaction): tx is OtcMintTransaction {
  return 'destinationAddress' in tx
}

export default function RecentActivityTimeline({ items }: RecentActivityTimelineProps) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No recent activity.</p>
    )
  }

  return (
    <ol className="relative space-y-4">
      <span
        aria-hidden="true"
        className="absolute left-[14px] top-2 bottom-2 w-px bg-border/30"
      />
      {items.slice(0, 3).map((tx) => {
        const mint = isMint(tx)
        return (
          <li key={tx.id} className="relative flex items-start gap-3 pl-8">
            <span
              className="absolute left-0 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-card shadow-sm ring-2 ring-background"
              aria-hidden="true"
            >
              {mint ? (
                <ArrowUpCircle className="h-4 w-4 text-primary" />
              ) : (
                <ArrowDownCircle className="h-4 w-4 text-warning" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                {mint ? 'Submitted OTC Mint' : 'Submitted OTC Redemption'}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {tx.amount.toLocaleString()} USDX · {tx.network} · {tx.customerName}
              </p>
              <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                <Clock className="h-3 w-3" />
                {formatRelativeTime(tx.createdAt)}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
