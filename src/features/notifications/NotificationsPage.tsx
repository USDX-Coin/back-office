import { type ColumnDef } from '@tanstack/react-table'
import { Bell, ExternalLink } from 'lucide-react'
import DataTable from '@/components/DataTable'
import PageHeader from '@/components/PageHeader'
import TableEmptyState from '@/components/TableEmptyState'
import { useDataTableParams } from '@/components/useDataTableParams'
import Avatar from '@/components/Avatar'
import { formatRelativeTime, formatUsdxAmount } from '@/lib/format'
import { buildSafeUrl } from '@/lib/safeUrl'
import { chainToChainId, resolveSafeAddress } from '@/lib/safeWallet'
import type { RequestChain, RequestListItem, SafeType } from '@/lib/types'
import { cn } from '@/lib/utils'
import { usePendingNotifications } from './hooks'

// USDX-38 / USDX-19: Full-page list of PENDING_APPROVAL mint+burn requests.
// Each row has an "Open in Safe" action that deep-links to the Safe UI tx
// page (sot/phase-1.md § Mint/Burn flow: "Sign via Safe UI ➜ Execute via
// Safe UI"). Reachable from the navbar bell popover's "See all" footer —
// not present in the sidebar (per SoT § Sidebar). See PR Decision-D flag.

const PAGE_SIZE = 20

const SAFE_LABEL: Record<SafeType, string> = {
  STAFF: 'Staff',
  MANAGER: 'Manager',
}

const CHAIN_LABEL: Record<RequestChain, string> = {
  ethereum: 'Ethereum',
  polygon: 'Polygon',
  arbitrum: 'Arbitrum',
  base: 'Base',
}

function safeUiUrl(row: RequestListItem): string | null {
  if (!row.safeTxHash) return null
  try {
    const safeAddress = resolveSafeAddress({
      safeType: row.safeType,
      chain: row.chain,
    })
    return buildSafeUrl({
      chainId: chainToChainId(row.chain),
      safeAddress,
      safeTxHash: row.safeTxHash,
    })
  } catch {
    return null
  }
}

function shortHash(hash: string, head = 8, tail = 6): string {
  if (hash.length < head + tail + 2) return hash
  return `${hash.slice(0, head)}…${hash.slice(-tail)}`
}

export default function NotificationsPage() {
  const params = useDataTableParams()
  const list = usePendingNotifications({
    page: params.page,
    limit: PAGE_SIZE,
  })

  const rows = list.data?.rows ?? []
  const total = list.data?.total ?? 0

  const columns: ColumnDef<RequestListItem>[] = [
    {
      accessorKey: 'createdAt',
      header: 'Submitted',
      cell: ({ getValue }) => (
        <span className="font-mono text-[11.5px] tabular-nums text-muted-foreground">
          {formatRelativeTime(getValue() as string)}
        </span>
      ),
    },
    {
      accessorKey: 'type',
      header: 'Type',
      cell: ({ getValue }) => {
        const t = getValue() as RequestListItem['type']
        const isMint = t === 'mint'
        return (
          <span
            className={cn(
              'inline-flex h-5 items-center rounded-sm px-1.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.04em]',
              isMint
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200'
                : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-200'
            )}
          >
            {isMint ? 'Mint' : 'Burn'}
          </span>
        )
      },
    },
    {
      id: 'user',
      header: 'User',
      cell: ({ row }) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={row.original.userName} size="sm" />
          <span className="font-medium">{row.original.userName}</span>
        </div>
      ),
    },
    {
      accessorKey: 'amount',
      header: 'Amount',
      cell: ({ row }) => (
        <div className="flex flex-col leading-tight">
          <span className="font-mono font-medium tabular-nums">
            {formatUsdxAmount(Number(row.original.amount))}
          </span>
          <span className="font-mono text-[10.5px] text-muted-foreground tabular-nums">
            Rp {Number(row.original.amountIdr).toLocaleString('id-ID')}
          </span>
        </div>
      ),
    },
    {
      accessorKey: 'chain',
      header: 'Chain',
      cell: ({ getValue }) => (
        <span className="text-[11.5px] text-muted-foreground">
          {CHAIN_LABEL[getValue() as RequestChain]}
        </span>
      ),
    },
    {
      accessorKey: 'safeType',
      header: 'Safe',
      cell: ({ getValue }) => (
        <span className="font-mono text-[11px] uppercase tracking-[0.04em] text-muted-foreground">
          {SAFE_LABEL[getValue() as SafeType]}
        </span>
      ),
    },
    {
      accessorKey: 'safeTxHash',
      header: 'Safe tx hash',
      cell: ({ getValue }) => {
        const v = getValue() as string | null
        if (!v) return <span className="text-muted-foreground">—</span>
        return (
          <span className="font-mono text-[11.5px] text-foreground" title={v}>
            {shortHash(v)}
          </span>
        )
      },
    },
    {
      id: 'action',
      header: '',
      cell: ({ row }) => {
        const url = safeUiUrl(row.original)
        if (!url) {
          return (
            <span className="font-mono text-[10.5px] text-muted-foreground/70">
              No tx hash yet
            </span>
          )
        }
        return (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 rounded-sm border border-border bg-background px-2 py-1 text-[11.5px] font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
            data-testid={`open-in-safe-${row.original.id}`}
          >
            Open in Safe
            <ExternalLink className="h-3 w-3" />
          </a>
        )
      },
    },
  ]

  const emptyState = (
    <TableEmptyState
      mode="no-data"
      icon={<Bell className="h-10 w-10 text-muted-foreground/40" strokeWidth={1.5} />}
      title="No pending approvals"
      description="When operators submit mint or burn requests, they'll appear here for Safe approval."
    />
  )

  return (
    <div>
      <PageHeader
        eyebrow="Approvals"
        title="Notifications"
        italicAccent="pending Safe TXs"
        subtitle="Mint and burn requests waiting for sign + execute in the Safe UI."
      />

      <DataTable<RequestListItem>
        columns={columns}
        data={rows}
        rowCount={total}
        isLoading={list.isLoading}
        pageSize={PAGE_SIZE}
        filterToolbar={<div className="hidden" />}
        hasFilters={false}
        emptyState={emptyState}
      />
    </div>
  )
}
