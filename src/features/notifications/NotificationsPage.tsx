import { ArrowDownToLine, ArrowUpFromLine, ExternalLink, Inbox, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import PageHeader from '@/components/PageHeader'
import { formatRelativeTime } from '@/lib/format'
import { buildSafeUrl } from '@/lib/safeUrl'
import type { Notification } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useNotifications } from './hooks'

const SAFE_TYPE_LABEL: Record<Notification['safeType'], string> = {
  STAFF: 'Staff Safe',
  MANAGER: 'Manager Safe',
}

const SAFE_TYPE_BADGE: Record<Notification['safeType'], string> = {
  STAFF: 'bg-muted text-foreground',
  MANAGER: 'bg-primary/10 text-primary',
}

export default function NotificationsPage() {
  const { data, isLoading, isError } = useNotifications()
  const items = data?.data ?? []
  const count = items.length

  return (
    <div>
      <PageHeader
        eyebrow="Safe multisig"
        title="Notifications"
        italicAccent="pending approvals"
        subtitle={
          isLoading
            ? 'Loading…'
            : count === 0
              ? 'No transactions are waiting for signatures.'
              : `${count} transaction${count === 1 ? '' : 's'} waiting for signers.`
        }
      />

      {isError ? (
        <Card className="rounded-md shadow-none dark:border-0">
          <CardContent className="py-10 text-center text-sm text-destructive">
            Failed to load notifications. Try refreshing.
          </CardContent>
        </Card>
      ) : isLoading && items.length === 0 ? (
        <NotificationListSkeleton />
      ) : items.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="grid gap-2" data-testid="notifications-list">
          {items.map((item) => (
            <NotificationRow key={item.id} item={item} />
          ))}
        </ul>
      )}
    </div>
  )
}

function NotificationRow({ item }: { item: Notification }) {
  const Icon = item.kind === 'mint' ? ArrowUpFromLine : ArrowDownToLine
  const safeUrl = buildSafeUrl({
    chainId: item.chainId,
    safeAddress: item.safeAddress,
    safeTxHash: item.safeTxHash,
  })

  return (
    <li>
      <Card className="rounded-md shadow-none dark:border-0">
        <CardContent className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={cn(
                'mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md',
                item.kind === 'mint' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
              )}
              aria-hidden
            >
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] font-semibold capitalize">{item.kind}</span>
                <span className="text-[13px] font-medium text-foreground">
                  {item.amount.toLocaleString()} USDX
                </span>
                <Badge
                  variant="outline"
                  className={cn('font-mono text-[10.5px]', SAFE_TYPE_BADGE[item.safeType])}
                  data-testid="safe-type-badge"
                >
                  <ShieldCheck className="mr-1 h-3 w-3" />
                  {SAFE_TYPE_LABEL[item.safeType]}
                </Badge>
              </div>
              <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
                <span data-testid="user-name">{item.userName}</span>
                {' · '}
                <span className="capitalize">{item.network}</span>
                {' · '}
                <span data-testid="created-at">{formatRelativeTime(item.createdAt)}</span>
              </p>
            </div>
          </div>
          <div className="flex shrink-0 sm:justify-end">
            <Button asChild size="sm" className="h-7 text-[12px]">
              <a
                href={safeUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Open ${item.kind} in Safe`}
              >
                Open in Safe
                <ExternalLink className="ml-1.5 h-3 w-3" />
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </li>
  )
}

function NotificationListSkeleton() {
  return (
    <div className="grid gap-2" aria-busy="true">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-md" />
      ))}
    </div>
  )
}

function EmptyState() {
  return (
    <Card className="rounded-md shadow-none dark:border-0">
      <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
        <div className="grid h-10 w-10 place-items-center rounded-full bg-muted text-muted-foreground">
          <Inbox className="h-5 w-5" />
        </div>
        <p className="text-[13px] font-semibold">All clear</p>
        <p className="max-w-xs text-[12px] text-muted-foreground">
          No Safe multisig transactions are waiting for signers right now.
        </p>
      </CardContent>
    </Card>
  )
}
