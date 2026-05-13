import { useState } from 'react'
import { useNavigate } from 'react-router'
import { type ColumnDef } from '@tanstack/react-table'
import { Plus, Coins } from 'lucide-react'
import DataTable from '@/components/DataTable'
import PageHeader from '@/components/PageHeader'
import TableEmptyState from '@/components/TableEmptyState'
import { useDataTableParams } from '@/components/useDataTableParams'
import Avatar from '@/components/Avatar'
import InputCurrencyBadge from '@/components/InputCurrencyBadge'
import TruncatedHash from '@/components/TruncatedHash'
import { Button } from '@/components/ui/button'
import RequestDetailModal from '@/components/RequestDetailModal'
import { TxHashLink } from '@/components/OnChainLinks'
import TableToolbar from '@/components/table/TableToolbar'
import { useColumnVisibility } from '@/components/table/useColumnVisibility'
import {
  REQUEST_FILTER_DEFS,
  REQUEST_SORT_COLUMNS,
  REQUEST_COLUMN_CONFIG,
} from './filterDefs'
import { resolveOnChainLinks } from '@/lib/chainLinks'
import { useChainConfig } from '@/features/chains/hooks'
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
  const sortBy = params.searchParams.get('sortBy') ?? ''
  const sortOrder = (params.searchParams.get('sortOrder') ?? '') as 'asc' | 'desc' | ''

  const list = useMintList({
    page: params.page,
    limit: PAGE_SIZE,
    status: status || undefined,
    chain: chain || undefined,
    safeType: safeType || undefined,
    search: search || undefined,
  })
  const { data: chains } = useChainConfig()

  const [activeRow, setActiveRow] = useState<RequestListItem | null>(null)
  const [colVisibility, setColVisibility] = useColumnVisibility('mint', REQUEST_COLUMN_CONFIG)

  const filterValues = { status, chain, safeType }
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
              <TruncatedHash value={row.original.userAddress} />
            </span>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'amount',
      header: 'Amount',
      cell: ({ row }) => {
        const input = row.original.inputCurrency
        return (
          <div className="flex flex-col leading-tight">
            <span className="flex items-center gap-1.5 font-mono font-medium tabular-nums">
              {Number(row.original.amount).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
              <span className="text-[10.5px] text-muted-foreground">USDX</span>
              {input === 'USD' && <InputCurrencyBadge currency="USD" />}
            </span>
            <span className="flex items-center gap-1.5 font-mono text-[10.5px] text-muted-foreground tabular-nums">
              <span>Rp {Number(row.original.amountIdr).toLocaleString('id-ID')}</span>
              {input === 'IDR' && <InputCurrencyBadge currency="IDR" />}
            </span>
          </div>
        )
      },
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
    {
      id: 'onchainTx',
      header: 'On-chain tx',
      cell: ({ row }) => (
        <TxHashLink
          hash={row.original.onChainTxHash}
          href={resolveOnChainLinks(row.original, chains).explorerHref}
          label="View transaction on block explorer"
        />
      ),
    },
    {
      id: 'safeTx',
      header: 'Safe tx',
      cell: ({ row }) => (
        <TxHashLink
          hash={row.original.safeTxHash}
          href={resolveOnChainLinks(row.original, chains).safeHref}
          label="View transaction in Safe"
        />
      ),
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
      {/* USDX-27: align with Users/Staff — Add button lives in PageHeader's
          `actions` slot (compact, top-right at ≥sm) instead of a separate
          full-width button below the title. */}
      <PageHeader
        eyebrow="Operations"
        title="Mint"
        italicAccent="OTC requests"
        subtitle="Track every mint request across its approval lifecycle."
        actions={
          canCreate ? (
            <Button onClick={() => navigate('/mint/new')} size="sm" className="h-7 text-[12px]">
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add Mint OTC
            </Button>
          ) : undefined
        }
      />

      <DataTable<RequestListItem>
        columns={columns}
        data={rows}
        rowCount={total}
        isLoading={list.isLoading}
        isError={list.isError}
        onRetry={() => list.refetch()}
        pageSize={PAGE_SIZE}
        columnVisibility={colVisibility}
        onColumnVisibilityChange={setColVisibility}
        filterToolbar={
          <TableToolbar
            search={{
              value: search,
              placeholder: 'Search user, address, tx…',
              onChange: (next) => params.updateParams({ search: next || null, page: '1' }),
            }}
            sort={{
              columns: REQUEST_SORT_COLUMNS,
              sortBy,
              sortOrder,
              onChange: (nextBy, nextOrder) =>
                params.updateParams({
                  sortBy: nextBy || null,
                  sortOrder: nextOrder || null,
                  page: '1',
                }),
            }}
            filter={{
              defs: REQUEST_FILTER_DEFS,
              values: filterValues,
              onChange: (next) =>
                params.updateParams({
                  status: next.status || null,
                  chain: next.chain || null,
                  safeType: next.safeType || null,
                  page: '1',
                }),
            }}
            columns={{
              items: REQUEST_COLUMN_CONFIG,
              visibility: colVisibility,
              onChange: setColVisibility,
            }}
          />
        }
        hasFilters={hasFilters}
        emptyState={noDataState}
        onRowClick={(r) => setActiveRow(r)}
        rowAriaLabel={(r) =>
          `Open mint request for ${r.userName}, ${r.amount} USDX`
        }
      />

      <RequestDetailModal
        requestId={activeRow?.id ?? null}
        listItem={activeRow}
        open={Boolean(activeRow)}
        onOpenChange={(o) => {
          if (!o) setActiveRow(null)
        }}
      />
    </div>
  )
}
