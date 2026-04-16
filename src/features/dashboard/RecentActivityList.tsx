import { Badge } from '@/components/ui/badge'
import Avatar from '@/components/Avatar'
import type { ReportRow } from '@/lib/types'
import { formatRelativeTime } from '@/lib/format'
import { getOtcStatusConfig } from '@/lib/status'
import { cn } from '@/lib/utils'

interface RecentActivityListProps {
  items: ReportRow[]
}

const NETWORK_DOT: Record<string, string> = {
  ethereum: 'bg-slate-400',
  polygon: 'bg-purple-500',
  arbitrum: 'bg-blue-500',
  solana: 'bg-emerald-500',
  base: 'bg-blue-400',
}

const KIND_BADGE: Record<'mint' | 'redeem', string> = {
  mint: 'bg-primary-container/20 text-primary border-primary/30',
  redeem: 'bg-tertiary-container/30 text-tertiary border-tertiary/30',
}

export default function RecentActivityList({ items }: RecentActivityListProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl bg-surface-container-lowest p-6 text-center text-sm text-on-surface-variant shadow-ambient-sm">
        No activity yet.
      </div>
    )
  }

  return (
    <div className="rounded-xl bg-surface-container-lowest p-5 shadow-ambient-sm">
      <h3 className="mb-3 text-sm font-medium text-on-surface">Recent Activity</h3>
      <ul className="divide-y divide-outline-variant/10">
        {items.map((item) => {
          const statusCfg = getOtcStatusConfig(item.status)
          return (
            <li key={item.id} className="flex items-center gap-3 py-3">
              <Avatar name={item.customerName} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={cn('text-[10px] uppercase', KIND_BADGE[item.kind])}>
                    {item.kind}
                  </Badge>
                  <span className="truncate text-sm font-medium text-on-surface">
                    {item.customerName}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-on-surface-variant">
                  <span
                    className={cn(
                      'mr-1.5 inline-block h-1.5 w-1.5 rounded-full',
                      NETWORK_DOT[item.network] ?? 'bg-slate-400'
                    )}
                  />
                  {item.network.charAt(0).toUpperCase() + item.network.slice(1)} ·{' '}
                  {item.amount.toLocaleString()} USDX
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Badge variant="outline" className={cn('text-[10px]', statusCfg.className)}>
                  {statusCfg.label}
                </Badge>
                <span className="text-[10px] text-on-surface-variant">
                  {formatRelativeTime(item.createdAt)}
                </span>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
