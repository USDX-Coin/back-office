import { useState } from 'react'
import { useNavigate } from 'react-router'
import { type ColumnDef } from '@tanstack/react-table'
import { Plus, Coins } from 'lucide-react'
import DataTable from '@/components/DataTable'
import PageHeader from '@/components/PageHeader'
import TableEmptyState from '@/components/TableEmptyState'
import { useDataTableParams } from '@/components/useDataTableParams'
import Avatar from '@/components/Avatar'
import { Button } from '@/components/ui/button'
import RequestDetailModal from '@/components/RequestDetailModal'
import MintBurnFilterToolbar, {
  type MintBurnFilterValues,
} from '@/components/MintBurnFilterToolbar'
import { canSubmitOtc, useAuth } from '@/lib/auth'
import { formatShortDate } from '@/lib/format'
import { getRequestStatusConfig } from '@/lib/status'
import type { RequestChain, RequestListItem, SafeType } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useMintList } from './hooks'

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

const PAGE_SIZE = 20

export default function MintListPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const canCreate = canSubmitOtc(user)

  const params = useDataTableParams()
  const search = params.searchParams.get('search') ?? ''
  const status = params.searchParams.get('status') ?? ''
  const chain = params.searchParams.get('chain') ?? ''
  const safeType = params.searchParams.get('safeType') ?? ''

  const list = useMintList({
    page: params.page,
    limit: PAGE_SIZE,
    status: status || undefined,
    chain: chain || undefined,
    safeType: safeType || undefined,
    search: search || undefined,
  })

  const [activeId, setActiveId] = useState<string | null>(null)

  function handleFilterChange(next: MintBurnFilterValues) {
    params.updateParams({
      search: next.search || null,
      status: next.status || null,
      chain: next.chain || null,
      safeType: next.safeType || null,
      page: '1',
    })
  }

  const hasFilters = Boolean(search || status || chain || safeType)

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

  const rows = list.data?.data ?? []
  const total = list.data?.metadata.total ?? 0

  const noDataState = (
    <TableEmptyState
      mode="no-data"
      icon={<Coins className="h-10 w-10 text-muted-foreground/40" strokeWidth={1.5} />}
      title="No mint requests yet"
      description="Submit a new mint OTC to populate this list."
      cta={
        canCreate ? (
          <Button onClick={() => navigate('/mint/new')} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Mint OTC
          </Button>
        ) : null
      }
    />
  )

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeader
          eyebrow="Operations"
          title="Mint"
          italicAccent="OTC requests"
          subtitle="Track every mint request across its approval lifecycle."
        />
        {canCreate && (
          <Button onClick={() => navigate('/mint/new')} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Mint OTC
          </Button>
        )}
      </div>

      <DataTable<RequestListItem>
        columns={columns}
        data={rows}
        rowCount={total}
        isLoading={list.isLoading}
        pageSize={PAGE_SIZE}
        filterToolbar={
          <MintBurnFilterToolbar
            values={{ search, status, chain, safeType }}
            onChange={handleFilterChange}
            onClear={params.clearAll}
          />
        }
        hasFilters={hasFilters}
        emptyState={noDataState}
        onRowClick={(r) => setActiveId(r.id)}
        rowAriaLabel={(r) =>
          `Open mint request for ${r.userName}, ${r.amount} USDX`
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
