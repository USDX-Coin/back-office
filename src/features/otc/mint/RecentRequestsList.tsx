import { Clock } from 'lucide-react'
import type { OtcMintTransaction } from '@/lib/types'
import { formatRelativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'

interface RecentRequestsListProps {
  items: OtcMintTransaction[]
  isLoading: boolean
}

const STATUS_DOT: Record<OtcMintTransaction['status'], string> = {
  pending: 'bg-warning animate-pulse-dot',
  completed: 'bg-success',
  failed: 'bg-error',
}

export default function RecentRequestsList({ items, isLoading }: RecentRequestsListProps) {
  return (
    <div className="rounded-xl bg-surface-container-lowest p-4 shadow-ambient-sm">
      <h3 className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-on-surface-variant">
        <Clock className="h-3.5 w-3.5" />
        Recent Requests
      </h3>
      {isLoading && items.length === 0 ? (
        <p className="text-sm text-on-surface-variant">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-on-surface-variant">No recent mints.</p>
      ) : (
        <ul className="divide-y divide-outline-variant/10">
          {items.slice(0, 5).map((item) => (
            <li key={item.id} className="flex items-start gap-3 py-2.5">
              <span
                className={cn(
                  'mt-1.5 inline-flex h-2 w-2 shrink-0 rounded-full',
                  STATUS_DOT[item.status]
                )}
                aria-label={item.status}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-on-surface">
                  {item.amount.toLocaleString()} USDX
                </p>
                <p className="text-xs text-on-surface-variant">
                  {item.network} · {item.customerName}
                </p>
              </div>
              <span className="shrink-0 text-xs text-on-surface-variant">
                {formatRelativeTime(item.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
