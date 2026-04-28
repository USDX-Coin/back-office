import { Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  failed: 'bg-destructive',
}

export default function RecentRequestsList({ items, isLoading }: RecentRequestsListProps) {
  return (
    <Card className="rounded-md shadow-none dark:border-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[13px] font-semibold">
          <Clock className="h-3.5 w-3.5" />
          Recent requests
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recent mints.</p>
        ) : (
          <ul className="divide-y divide-border">
            {items.slice(0, 5).map((item) => (
              <li key={item.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                <span
                  className={cn('mt-1.5 inline-flex h-2 w-2 shrink-0 rounded-full', STATUS_DOT[item.status])}
                  aria-label={item.status}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{item.amount.toLocaleString()} USDX</p>
                  <p className="text-xs text-muted-foreground">
                    {item.network} · {item.customerName}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatRelativeTime(item.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
