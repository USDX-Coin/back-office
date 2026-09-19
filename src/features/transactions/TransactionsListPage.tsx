import { useNavigate, useParams } from 'react-router'
import { type ColumnDef } from '@tanstack/react-table'
import { Eye, Receipt } from 'lucide-react'
import DataTable from '@/components/DataTable'
import PageHeader from '@/components/PageHeader'
import TableEmptyState from '@/components/TableEmptyState'
import { useDataTableParams } from '@/components/useDataTableParams'
import Avatar from '@/components/Avatar'
import { TableCellText } from '@/components/ui/table'
import TableToolbar from '@/components/table/TableToolbar'
import { useColumnVisibility } from '@/components/table/useColumnVisibility'
import { buildOrderFilterDefs, ORDER_COLUMN_CONFIG } from './filterDefs'
import { formatIdrAmount, formatShortDate } from '@/lib/format'
import { PARTNER_CUSTOMER_EMAIL_LABEL } from '@/lib/pii'
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
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm px-2 py-0.5 text-2xs font-medium',
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
  const redeemStatus = params.searchParams.get('redeemStatus') ?? ''
  const paymentStatus = params.searchParams.get('paymentStatus') ?? ''
  const safeStatus = params.searchParams.get('safeStatus') ?? ''
  // USDX-547 — partner vs retail population. Applies to both order types.
  const ownerType = params.searchParams.get('ownerType') ?? ''
  // `userId` is a programmatic (deep-link) filter — no visible control, but we
  // honour it when present (e.g. arriving from a user detail page).
  const userId = params.searchParams.get('userId') ?? ''

  // Redeem filters on RedeemStatus via `redeemStatus`; the mint `status` /
  // payment / Safe params are MINT-only (orders.yaml). Never forward the
  // wrong-dimension filters for the active type, even if a stale URL value
  // lingers (USDX-254).
  const isRedeem = type === 'REDEEM'
  const list = useOrderList({
    page: params.page,
    take: PAGE_SIZE,
    type: type || undefined,
    status: isRedeem ? undefined : status || undefined,
    redeemStatus: isRedeem ? redeemStatus || undefined : undefined,
    paymentStatus: isRedeem ? undefined : paymentStatus || undefined,
    safeStatus: isRedeem ? undefined : safeStatus || undefined,
    ownerType: ownerType || undefined,
    userId: userId || undefined,
  })

  const [colVisibility, setColVisibility] = useColumnVisibility(
    'transactions',
    ORDER_COLUMN_CONFIG,
  )

  // Status options + Payment/Safe filters depend on the selected type
  // (USDX-245 dropdown; USDX-254 sends redeem status via `redeemStatus`).
  const orderFilterDefs = buildOrderFilterDefs(type)
  const filterValues = { type, ownerType, status, redeemStatus, paymentStatus, safeStatus }
  const hasFilters = Boolean(
    type ||
      ownerType ||
      userId ||
      (isRedeem ? redeemStatus : status || paymentStatus || safeStatus),
  )

  const columns: ColumnDef<OrderListItem>[] = [
    {
      accessorKey: 'createdAt',
      size: 112,
      header: 'Date',
      cell: ({ getValue }) => (
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {formatShortDate(getValue() as string)}
        </span>
      ),
    },
    {
      accessorKey: 'type',
      size: 68,
      header: 'Type',
      cell: ({ getValue }) => (
        <span className="font-mono text-2xs uppercase tracking-[0.04em] text-muted-foreground">
          {getValue() as string}
        </span>
      ),
    },
    {
      id: 'user',
      size: 200,
      header: 'User',
      cell: ({ row }) => {
        // The backend sends the literal marker `(partner customer)` when the
        // order has no `users` row (USDX-571). It is a label, not a person, so
        // it gets no avatar — an initial derived from "(" is noise — and it is
        // dimmed to read as metadata rather than as an address.
        const email = row.original.userEmail
        if (email === PARTNER_CUSTOMER_EMAIL_LABEL) {
          return (
            <TableCellText value={email} className="text-xs italic text-muted-foreground" />
          )
        }
        return (
          <div className="flex min-w-0 items-center gap-2.5">
            <Avatar name={email} size="sm" />
            <TableCellText value={email} className="text-xs font-medium" />
          </div>
        )
      },
    },
    {
      // USDX-547 — "which partner is this order from". The `(partner customer)`
      // marker in the User column only explains why that cell is not an email;
      // it does not say who to contact, and for a partner order the party to
      // contact is the PARTNER, never its customer.
      id: 'partner',
      size: 120,
      header: 'Partner',
      cell: ({ row }) => {
        const partner = row.original.partner
        // Retail orders render an EMPTY cell — deliberately not "—" and not
        // "N/A". Both read as "this value failed to load"; empty reads as
        // "this concept does not apply", which is the truth for retail.
        if (!partner) return null
        return (
          <div className="flex min-w-0 flex-col leading-tight">
            <TableCellText value={partner.displayName} className="text-xs font-medium" />
            {/* `code` is what appears in transaction references and survives a
                change of legal name, so it is worth the second line. */}
            <span className="font-mono text-2xs uppercase tracking-[0.04em] text-muted-foreground">
              {partner.code}
            </span>
          </div>
        )
      },
    },
    {
      accessorKey: 'amount',
      size: 116,
      header: 'Amount',
      cell: ({ getValue }) => (
        <span className="flex items-center gap-1.5 font-mono font-medium tabular-nums">
          {Number(getValue() as string).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
          <span className="text-2xs text-muted-foreground">USDX</span>
        </span>
      ),
    },
    {
      accessorKey: 'totalPayIdr',
      size: 128,
      header: 'Total pay (IDR)',
      cell: ({ getValue }) => {
        const v = getValue() as string | null
        return v ? (
          <span className="font-mono text-xs tabular-nums">
            {formatIdrAmount(Number(v))}
          </span>
        ) : (
          <span className="text-muted-foreground/40">—</span>
        )
      },
    },
    {
      accessorKey: 'netPayoutIdr',
      size: 128,
      header: 'Net payout (IDR)',
      cell: ({ getValue }) => {
        const v = getValue() as string | null
        return v ? (
          <span className="font-mono text-xs tabular-nums">
            {formatIdrAmount(Number(v))}
          </span>
        ) : (
          <span className="text-muted-foreground/40">—</span>
        )
      },
    },
    {
      accessorKey: 'chain',
      size: 88,
      header: 'Chain',
      cell: ({ getValue }) => {
        const c = getValue() as string
        return (
          <span className="inline-flex items-center gap-1.5 text-2xs text-muted-foreground">
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
      size: 108,
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
      size: 104,
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
      size: 124,
      header: 'Status',
      cell: ({ getValue }) => (
        <StatusBadge cfg={getOrderStatusConfig(getValue() as OrderListItem['status'])} />
      ),
    },
    {
      id: 'actions',
      size: 76,
      header: '',
      cell: ({ row }) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            navigate(`/transactions/${row.original.id}`)
          }}
          className="inline-flex items-center gap-1 rounded-sm px-2 py-1 text-2xs font-medium text-primary transition-colors hover:bg-primary/10"
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
                // payment/Safe filters — clear the now-irrelevant params so we
                // never send an invalid combination the BE would 422 (USDX-254).
                const typeChanged = (next.type || '') !== type
                const nextIsRedeem = next.type === 'REDEEM'
                params.updateParams({
                  type: next.type || null,
                  // Owner is independent of type — never cleared by a type switch.
                  ownerType: next.ownerType || null,
                  // Mint status only when not redeem; redeemStatus only when redeem.
                  status: typeChanged || nextIsRedeem ? null : next.status || null,
                  redeemStatus:
                    typeChanged || !nextIsRedeem ? null : next.redeemStatus || null,
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
