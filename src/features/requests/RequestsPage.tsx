import { useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { ArrowDown, ArrowUp, Inbox } from 'lucide-react'
import DataTable from '@/components/DataTable'
import PageHeader from '@/components/PageHeader'
import TableEmptyState from '@/components/TableEmptyState'
import { useDataTableParams } from '@/components/useDataTableParams'
import Avatar from '@/components/Avatar'
import { formatShortDate } from '@/lib/format'
import { getRequestStatusConfig } from '@/lib/status'
import type { RequestChain, RequestListItem, SafeType } from '@/lib/types'
import { cn } from '@/lib/utils'
import RequestDetailModal from './RequestDetailModal'
import RequestFilterToolbar, {
  type RequestFilterValues,
} from './RequestFilterToolbar'
import { useRequests } from './hooks'

const CHAIN_LABEL: Record<RequestChain, string> = {
  ethereum: 'Ethereum',
  polygon: 'Polygon',
  arbitrum: 'Arbitrum',
  base: 'Base',
}

const CHAIN_DOT: Record<RequestChain, string> = {
  ethereum: 'bg-[#627EEA]',
  polygon: 'bg-[#8247E5]',
  arbitrum: 'bg-[#28A0F0]',
  base: 'bg-[#0052FF]',
}

const SAFE_LABEL: Record<SafeType, string> = {
  STAFF: 'Staff',
  MANAGER: 'Manager',
}

const PAGE_SIZE = 10

export default function RequestsPage() {
  const params = useDataTableParams()
  const type = params.searchParams.get('type') ?? ''
  const status = params.searchParams.get('status') ?? ''
  const chain = params.searchParams.get('chain') ?? ''
  const safeType = params.searchParams.get('safeType') ?? ''

  const list = useRequests({
    page: params.page,
    limit: PAGE_SIZE,
    type: type || undefined,
    status: status || undefined,
    chain: chain || undefined,
    safeType: safeType || undefined,
  })

  const [activeId, setActiveId] = useState<string | null>(null)

  function handleFilterChange(next: RequestFilterValues) {
    params.updateParams({
      type: next.type || null,
      status: next.status || null,
      chain: next.chain || null,
      safeType: next.safeType || null,
      page: '1',
    })
  }

  const hasFilters = Boolean(type || status || chain || safeType)

  const columns: ColumnDef<RequestListItem>[] = [
    {
      accessorKey: 'createdAt',
      header: 'Date',
      cell: ({ getValue }) => (
        <span className="font-mono text-[12px] tabular-nums text-muted-foreground">
          {formatShortDate(getValue() as string)}
        </span>
      ),
    },
    {
      accessorKey: 'type',
      header: 'Type',
      cell: ({ getValue }) => {
        const t = getValue() as 'mint' | 'burn'
        return (
          <span
            className={cn(
              'inline-flex items-center gap-1 text-[11.5px]',
              t === 'mint' ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            {t === 'mint' ? (
              <ArrowUp className="h-3 w-3" />
            ) : (
              <ArrowDown className="h-3 w-3" />
            )}
            {t === 'mint' ? 'Mint' : 'Burn'}
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
          <div className="flex flex-col leading-tight">
            <span className="font-medium">{row.original.userName}</span>
            <span className="font-mono text-[10.5px] text-muted-foreground">
              {row.original.userAddress.slice(0, 6)}…
              {row.original.userAddress.slice(-4)}
            </span>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'amount',
      header: 'Amount',
      cell: ({ row }) => (
        <div className="flex flex-col leading-tight">
          <span className="font-mono font-medium tabular-nums">
            {Number(row.original.amount).toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
            <span className="ml-1 text-[10.5px] text-muted-foreground">USDX</span>
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
      cell: ({ getValue }) => {
        const c = getValue() as RequestChain
        return (
          <span className="inline-flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
            <span className={cn('h-1.5 w-1.5 rounded-full', CHAIN_DOT[c])} />
            {CHAIN_LABEL[c]}
          </span>
        )
      },
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
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => {
        const s = getValue() as RequestListItem['status']
        const cfg = getRequestStatusConfig(s)
        return (
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-[11.5px] font-medium',
              cfg.className
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dotClass)} />
            {cfg.label}
          </span>
        )
      },
    },
  ]

  // Bridge phase-1 envelope ({ metadata, data }) into the DataTable's expected shape
  const rows = list.data?.data ?? []
  const total = list.data?.metadata.total ?? 0

  const noDataState = (
    <TableEmptyState
      mode="no-data"
      icon={<Inbox className="h-10 w-10 text-muted-foreground/40" strokeWidth={1.5} />}
      title="No requests yet"
      description="Mint and burn requests appear here as operators submit them."
    />
  )

  return (
    <div>
      <PageHeader
        eyebrow="Operations"
        title="Requests"
        italicAccent="mint & burn"
        subtitle="Track every mint and burn request across its approval lifecycle."
      />

      <DataTable<RequestListItem>
        columns={columns}
        data={rows}
        rowCount={total}
        isLoading={list.isLoading}
        pageSize={PAGE_SIZE}
        filterToolbar={
          <RequestFilterToolbar
            values={{ type, status, chain, safeType }}
            onChange={handleFilterChange}
            onClear={params.clearAll}
          />
        }
        hasFilters={hasFilters}
        emptyState={noDataState}
        onRowClick={(r) => setActiveId(r.id)}
        rowAriaLabel={(r) =>
          `Open ${r.type} request for ${r.userName}, ${r.amount} USDX`
        }
      />

      <RequestDetailModal
        requestId={activeId}
        open={Boolean(activeId)}
        onOpenChange={(o) => {
          if (!o) setActiveId(null)
        }}
      />
    </div>
  )
}
