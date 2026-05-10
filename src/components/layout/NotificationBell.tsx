import { useNavigate } from 'react-router'
import { Bell, ExternalLink } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import {
  usePendingNotifications,
  usePendingNotificationsCount,
} from '@/features/notifications/hooks'
import { formatRelativeTime, formatUsdxAmount } from '@/lib/format'
import { buildSafeUrl } from '@/lib/safeUrl'
import { chainToChainId, resolveSafeAddress } from '@/lib/safeWallet'
import type { RequestListItem } from '@/lib/types'
import { cn } from '@/lib/utils'

// USDX-38: Bell sits left of the ProfileDropdown in the navbar. Clicking the
// trigger opens a popover (top 8 PENDING_APPROVAL mint+burn requests).
// Clicking a row opens the corresponding Safe UI tx in a new tab — that is
// the entire intent of the surface (approver flow per phase-1.md § Mint/Burn
// flows: "Sign via Safe UI ➜ Execute via Safe UI").
//
// Visibility: rendered for every authenticated user. No RoleGuard — read-only,
// matches the existing sidebar (N) badge pattern. See PR Decision-C flag.

const POPOVER_LIMIT = 8

export default function NotificationBell() {
  const navigate = useNavigate()
  const list = usePendingNotifications({ limit: POPOVER_LIMIT })
  const count = usePendingNotificationsCount()
  const total = count.data ?? 0

  function openSafeUi(row: RequestListItem) {
    if (!row.safeTxHash) return
    let url: string
    try {
      const safeAddress = resolveSafeAddress({
        safeType: row.safeType,
        chain: row.chain,
      })
      url = buildSafeUrl({
        chainId: chainToChainId(row.chain),
        safeAddress,
        safeTxHash: row.safeTxHash,
      })
    } catch {
      // Bell is best-effort; fall through to /notifications page where the
      // user can see the row + a clear "Open in Safe" CTA per row.
      navigate('/notifications')
      return
    }
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="relative inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-label={
          total > 0
            ? `Notifications, ${total} pending approval${total === 1 ? '' : 's'}`
            : 'Notifications, none pending'
        }
        data-testid="notification-bell"
      >
        <Bell className="h-4 w-4" />
        {total > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-primary px-1 font-mono text-[10px] font-semibold leading-none text-primary-foreground"
            data-testid="notification-bell-badge"
          >
            {total > 99 ? '99+' : total}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[320px] p-0 bg-card shadow-sm"
      >
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <p className="text-[12.5px] font-semibold text-foreground">
            Notifications
          </p>
          {total > 0 && (
            <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground">
              {total} pending
            </span>
          )}
        </div>

        <div className="max-h-[320px] overflow-y-auto">
          {list.isLoading ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : list.isError ? (
            <p className="px-3 py-4 text-center text-[12px] text-destructive">
              Failed to load notifications.
            </p>
          ) : !list.data || list.data.rows.length === 0 ? (
            <p className="px-3 py-6 text-center text-[12px] text-muted-foreground">
              No pending approvals.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {list.data.rows.map((row) => (
                <NotificationRow key={row.id} row={row} onClick={openSafeUi} />
              ))}
            </ul>
          )}
        </div>

        <button
          type="button"
          onClick={() => navigate('/notifications')}
          className="block w-full border-t border-border px-3 py-2 text-center text-[12px] font-medium text-foreground transition-colors hover:bg-muted/60"
        >
          See all notifications
        </button>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function NotificationRow({
  row,
  onClick,
}: {
  row: RequestListItem
  onClick: (row: RequestListItem) => void
}) {
  const isMint = row.type === 'mint'
  return (
    <li>
      <button
        type="button"
        onClick={() => onClick(row)}
        className="group flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:bg-muted/60"
        data-testid={`notification-row-${row.id}`}
      >
        <span
          className={cn(
            'mt-0.5 inline-flex h-5 items-center rounded-sm px-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.04em]',
            isMint
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200'
              : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-200'
          )}
        >
          {isMint ? 'Mint' : 'Burn'}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate text-[12.5px] font-medium text-foreground">
              {row.userName}
            </p>
            <span className="shrink-0 font-mono text-[10.5px] text-muted-foreground">
              {formatRelativeTime(row.createdAt)}
            </span>
          </div>
          <p className="truncate font-mono text-[11.5px] tabular-nums text-muted-foreground">
            {formatUsdxAmount(Number(row.amount))} · {row.safeType} safe
          </p>
        </div>
        <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground/60 transition-colors group-hover:text-primary" />
      </button>
    </li>
  )
}
