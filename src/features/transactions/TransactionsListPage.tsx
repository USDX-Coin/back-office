import { useNavigate, useParams } from 'react-router'
import { type ColumnDef } from '@tanstack/react-table'
import { Eye, Receipt } from 'lucide-react'
import DataTable from '@/components/DataTable'
import PageHeader from '@/components/PageHeader'
import TableEmptyState from '@/components/TableEmptyState'
import { useDataTableParams } from '@/components/useDataTableParams'
import Avatar from '@/components/Avatar'
import TableToolbar from '@/components/table/TableToolbar'
import { useColumnVisibility } from '@/components/table/useColumnVisibility'
import { buildOrderFilterDefs, ORDER_COLUMN_CONFIG } from './filterDefs'
import { formatIdrAmount, formatShortDate } from '@/lib/format'
import {
  getOrderStatusConfig,
  getPaymentStatusConfig,
  getSafeStatusConfig,
  type StatusConfig,
} from '@/lib/status'
import type { OrderListItem } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useOrderList } from './hooks'
import OrderDetailModal from './OrderDetailModal'

const PAGE_SIZE = 20

function StatusBadge({ cfg }: { cfg: StatusConfig }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-[11.5px] font-medium',
        cfg.className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dotClass)} />
      {cfg.label}
    </span>
  )
}

export default function TransactionsListPage() {
  const navigate = useNavigate()

  // Deep-link route `/transactions/:id` — the list stays rendered while the
  // detail modal auto-opens for the URL param (refresh / share safe).
  const { id: activeId } = useParams<{ id?: string }>()

  const params = useDataTableParams()
  const type = params.searchParams.get('type') ?? ''
  const status = params.searchParams.get('status') ?? ''
  const paymentStatus = params.searchParams.get('paymentStatus') ?? ''
  const safeStatus = params.searchParams.get('safeStatus') ?? ''
  // `userId` is a programmatic (deep-link) filter — no visible control, but we
  // honour it when present (e.g. arriving from a user detail page).
  const userId = params.searchParams.get('userId') ?? ''

  // Redeem has no payment/Safe leg — never forward those filters for REDEEM
  // (orders.yaml marks them MINT-only), even if a stale URL value lingers.
  const isRedeem = type === 'REDEEM'
  const list = useOrderList({
    page: params.page,
    take: PAGE_SIZE,
    type: type || undefined,
    status: status || undefined,
    paymentStatus: isRedeem ? undefined : paymentStatus || undefined,
    safeStatus: isRedeem ? undefined : safeStatus || undefined,
    userId: userId || undefined,
  })

  const [colVisibility, setColVisibility] = useColumnVisibility(
    'transactions',
    ORDER_COLUMN_CONFIG,
  )

  // Status options + Payment/Safe filters depend on the selected type (USDX-245).
  const orderFilterDefs = buildOrderFilterDefs(type)
  const filterValues = { type, status, paymentStatus, safeStatus }
  const hasFilters = Boolean(
    type || status || (!isRedeem && (paymentStatus || safeStatus)) || userId,
  )

  const columns: ColumnDef<OrderListItem>[] = [
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
      cell: ({ getValue }) => (
        <span className="font-mono text-[11px] uppercase tracking-[0.04em] text-muted-foreground">
          {getValue() as string}
        </span>
      ),
    },
    {
      id: 'user',
      header: 'User',
      cell: ({ row }) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={row.original.userEmail} size="sm" />
          <span className="break-all text-[12.5px] font-medium">
            {row.original.userEmail}
          </span>
        </div>
      ),
    },
    {
      accessorKey: 'amount',
      header: 'Amount',
      cell: ({ getValue }) => (
        <span className="flex items-center gap-1.5 font-mono font-medium tabular-nums">
          {Number(getValue() as string).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
          <span className="text-[10.5px] text-muted-foreground">USDX</span>
        </span>
      ),
    },
    {
      accessorKey: 'totalPayIdr',
      header: 'Total pay (IDR)',
      cell: ({ getValue }) => {
        const v = getValue() as string | null
        return v ? (
          <span className="font-mono text-[12px] tabular-nums">
            {formatIdrAmount(Number(v))}
          </span>
        ) : (
          <span className="text-muted-foreground/40">—</span>
        )
      },
    },
    {
      accessorKey: 'netPayoutIdr',
      header: 'Net payout (IDR)',
      cell: ({ getValue }) => {
        const v = getValue() as string | null
        return v ? (
          <span className="font-mono text-[12px] tabular-nums">
            {formatIdrAmount(Number(v))}
          </span>
        ) : (
          <span className="text-muted-foreground/40">—</span>
        )
      },
    },
    {
      accessorKey: 'chain',
      header: 'Chain',
      cell: ({ getValue }) => {
        const c = getValue() as string
        return (
          <span className="inline-flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                c === 'polygon' ? 'bg-[#8247E5]' : 'bg-muted-foreground',
              )}
            />
            {c.charAt(0).toUpperCase() + c.slice(1)}
          </span>
        )
      },
    },
    {
      accessorKey: 'paymentStatus',
      header: 'Payment',
      // Redeem rows have no payment leg (null) → dash.
      cell: ({ getValue }) => {
        const v = getValue() as OrderListItem['paymentStatus']
        return v ? (
          <StatusBadge cfg={getPaymentStatusConfig(v)} />
        ) : (
          <span className="text-muted-foreground/40">—</span>
        )
      },
    },
    {
      accessorKey: 'safeStatus',
      header: 'Safe',
      // Redeem rows don't go through Safe (null) → dash.
      cell: ({ getValue }) => {
        const v = getValue() as OrderListItem['safeStatus']
        return v ? (
          <StatusBadge cfg={getSafeStatusConfig(v)} />
        ) : (
          <span className="text-muted-foreground/40">—</span>
        )
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => (
        <StatusBadge cfg={getOrderStatusConfig(getValue() as OrderListItem['status'])} />
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            navigate(`/transactions/${row.original.id}`)
          }}
          className="inline-flex items-center gap-1 rounded-sm px-2 py-1 text-[11.5px] font-medium text-primary transition-colors hover:bg-primary/10"
          aria-label={`View order for ${row.original.userEmail}`}
        >
          <Eye className="h-3.5 w-3.5" />
          View
        </button>
      ),
    },
  ]

  const rows = list.data?.data ?? []
  const total = list.data?.metadata.total ?? 0
  const activeListItem = activeId ? rows.find((r) => r.id === activeId) ?? null : null

  const noDataState = (
    <TableEmptyState
      mode="no-data"
      icon={<Receipt className="h-10 w-10 text-muted-foreground/40" strokeWidth={1.5} />}
      title="No user transactions yet"
      description="Consumer mint & redeem orders will appear here as users transact."
    />
  )

  return (
    <div>
      <PageHeader
        eyebrow="Consumer"
        title="User Transaction"
        italicAccent="orders"
        subtitle="Read-only monitoring of consumer mint & redeem orders — payment / payout, execution, and fee / spread / revenue."
      />

      <DataTable<OrderListItem>
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
            filter={{
              defs: orderFilterDefs,
              values: filterValues,
              onChange: (next) => {
                // Switching type invalidates the status enum + (for redeem) the
                // payment/Safe filters — clear them so no stale param is sent.
                const typeChanged = (next.type || '') !== type
                const nextIsRedeem = next.type === 'REDEEM'
                params.updateParams({
                  type: next.type || null,
                  status: typeChanged ? null : next.status || null,
                  paymentStatus: typeChanged || nextIsRedeem ? null : next.paymentStatus || null,
                  safeStatus: typeChanged || nextIsRedeem ? null : next.safeStatus || null,
                  page: '1',
                })
              },
            }}
            columns={{
              items: ORDER_COLUMN_CONFIG,
              visibility: colVisibility,
              onChange: setColVisibility,
            }}
          />
        }
        hasFilters={hasFilters}
        emptyState={noDataState}
        onRowClick={(r) => navigate(`/transactions/${r.id}`)}
        rowAriaLabel={(r) => `Open order for ${r.userEmail}, ${r.amount} USDX`}
      />

      <OrderDetailModal
        orderId={activeId ?? null}
        listItem={activeListItem}
        open={Boolean(activeId)}
        onOpenChange={(o) => {
          if (!o) navigate('/transactions', { replace: true })
        }}
      />
    </div>
  )
}
