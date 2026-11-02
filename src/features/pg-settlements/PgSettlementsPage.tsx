import { useNavigate, useParams } from 'react-router'
import { type ColumnDef } from '@tanstack/react-table'
import { Landmark } from 'lucide-react'
import DataTable from '@/components/DataTable'
import PageHeader from '@/components/PageHeader'
import StatusPill from '@/components/StatusPill'
import TableEmptyState from '@/components/TableEmptyState'
import TableToolbar from '@/components/table/TableToolbar'
import { useColumnVisibility } from '@/components/table/useColumnVisibility'
import { useDataTableParams } from '@/components/useDataTableParams'
import { rowNav, useReturnFocusToRow } from '@/components/record-modal/rowNav'
import type { ColumnConfig, FilterDef } from '@/components/table/types'
import { TableCellStack } from '@/components/ui/table'
import { formatDateTime, formatIsoDayLong } from '@/lib/format'
import {
  formatIdrDifference,
  isPgSettlementStatus,
  PG_SETTLEMENT_STATUS_OPTIONS,
  pgModeShort,
  pgSettlementStatusPill,
} from '@/lib/pgSettlements'
import { formatIdrExact } from '@/lib/redeemApprovals'
import type { PgSettlementBatch } from '@/lib/types'
import PgSettlementDetailModal from './PgSettlementDetailModal'
import PrefundingCard from './PrefundingCard'
import { usePgSettlements } from './hooks'

const PAGE_SIZE = 20
const BASE = '/pencairan-pg'

const FILTER_DEFS: FilterDef[] = [{ kind: 'select', key: 'status', label: 'Status', options: PG_SETTLEMENT_STATUS_OPTIONS }]

const COLUMN_CONFIG: ColumnConfig[] = [
  { key: 'businessDate', label: 'Tanggal transaksi', required: true },
  { key: 'status', label: 'Status', required: true },
  { key: 'orders', label: 'Order' },
  { key: 'amounts', label: 'Diharapkan & diterima', required: true },
  { key: 'difference', label: 'Selisih', required: true },
  { key: 'mode', label: 'Mode' },
  { key: 'matched', label: 'Dicocokkan' },
]

const columns: ColumnDef<PgSettlementBatch>[] = [
  {
    id: 'businessDate',
    size: 140,
    header: 'Tanggal transaksi',
    cell: ({ row }) => <span className="text-sm font-medium tabular-nums">{formatIsoDayLong(row.original.businessDate)}</span>,
  },
  {
    id: 'status',
    size: 140,
    header: 'Status',
    cell: ({ row }) => <StatusPill cfg={pgSettlementStatusPill(row.original.status)} />,
  },
  {
    id: 'orders',
    size: 88,
    header: 'Order',
    cell: ({ row }) => <span className="text-xs tabular-nums">{row.original.orderCount}</span>,
  },
  {
    id: 'amounts',
    size: 200,
    header: 'Diharapkan / diterima',
    cell: ({ row }) => (
      <TableCellStack
        lines={[
          { value: formatIdrExact(row.original.expectedIdr), className: 'text-sm font-semibold tabular-nums' },
          {
            value: row.original.creditedIdr ? formatIdrExact(row.original.creditedIdr) : 'Belum ada kredit',
            className: 'text-xs tabular-nums text-muted-foreground',
          },
        ]}
      />
    ),
  },
  {
    id: 'difference',
    size: 176,
    header: 'Selisih',
    cell: ({ row }) => {
      const diff = formatIdrDifference(row.original.differenceIdr)
      const bad = row.original.status === 'MISMATCH'
      return <span className={bad ? 'text-xs font-medium text-destructive' : 'text-xs text-muted-foreground'}>{diff ?? '—'}</span>
    },
  },
  {
    id: 'mode',
    size: 80,
    header: 'Mode',
    cell: ({ row }) => <span className="text-xs">{pgModeShort(row.original.mode)}</span>,
  },
  {
    id: 'matched',
    size: 176,
    header: 'Dicocokkan (WIB)',
    cell: ({ row }) =>
      row.original.matchedAt ? (
        <TableCellStack
          lines={[
            { value: formatDateTime(row.original.matchedAt), className: 'text-xs tabular-nums' },
            {
              value: row.original.matchedByName ?? (row.original.status === 'MATCHED' ? 'Otomatis (job harian)' : '—'),
              className: 'text-xs text-muted-foreground',
            },
          ]}
        />
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      ),
  },
]

/**
 * D29 — "Pencairan PG" (`sot/bni-integration.md § 21.8`, `GET /api/v1/pg-settlements`).
 *
 * Durianpay mencairkan satu hari transaksi sekaligus (T+1). Setiap batch per tanggal
 * transaksi WIB dicocokkan dengan kredit di mutasi NP IDR; `MISMATCH` selalu ikut
 * (server) dan ditampilkan dengan selisihnya. Kartu prefunding di atas tabel.
 * Badge sidebar = `queue-counts.pgSettlementsMismatch`.
 */
export default function PgSettlementsPage() {
  const navigate = useNavigate()
  const { id: activeId } = useParams<{ id?: string }>()
  const params = useDataTableParams()
  const rawStatus = params.searchParams.get('status') ?? ''
  const status = isPgSettlementStatus(rawStatus) ? rawStatus : undefined
  const list = usePgSettlements({ page: params.page, take: PAGE_SIZE, status })
  const [colVisibility, setColVisibility] = useColumnVisibility('pg-settlements', COLUMN_CONFIG)

  const rows = list.data?.data ?? []
  const suffix = params.searchParams.toString() ? `?${params.searchParams}` : ''
  const openDetail = (id: string) => navigate(`${BASE}/${id}${suffix}`)
  const returnFocus = useReturnFocusToRow(activeId)

  return (
    <div>
      <PageHeader
        title="Pencairan PG"
        subtitle="Durianpay mencairkan pembayaran VA satu hari sekaligus (T+1) ke rekening NP IDR. Setiap batch dicocokkan dengan kredit di mutasi; yang tidak cocok perlu dicek ops."
      />
      <PrefundingCard />
      <DataTable<PgSettlementBatch>
        columns={columns}
        data={rows}
        rowCount={list.data?.metadata.total ?? 0}
        isLoading={list.isLoading}
        isError={list.isError}
        onRetry={() => list.refetch()}
        pageSize={PAGE_SIZE}
        columnVisibility={colVisibility}
        onColumnVisibilityChange={setColVisibility}
        getRowId={(r) => r.id}
        filterToolbar={
          <TableToolbar
            filter={{
              defs: FILTER_DEFS,
              values: { status: status ?? '' },
              onChange: (next) => params.updateParams({ status: next.status || null, page: '1' }),
            }}
            columns={{ items: COLUMN_CONFIG, visibility: colVisibility, onChange: setColVisibility }}
          />
        }
        hasFilters={Boolean(status)}
        emptyState={
          <TableEmptyState
            mode="no-data"
            icon={<Landmark className="h-10 w-10 text-muted-foreground/40" strokeWidth={1.5} />}
            title="Belum ada batch pencairan"
            description="Batch dibuat job harian dari order VA yang sudah dibayar. Kosong berarti belum ada order yang masuk batch."
          />
        }
        onRowClick={(r) => openDetail(r.id)}
        rowAriaLabel={(r) =>
          `Batch ${formatIsoDayLong(r.businessDate)}, ${pgSettlementStatusPill(r.status).label}${
            r.differenceIdr ? `, selisih ${formatIdrDifference(r.differenceIdr)}` : ''
          }`
        }
      />
      <PgSettlementDetailModal
        batchId={activeId ?? null}
        open={Boolean(activeId)}
        onOpenChange={(o) => {
          if (!o) navigate(`${BASE}${suffix}`, { replace: true })
        }}
        nav={rowNav(rows, (r) => r.id, activeId, (id) => navigate(`${BASE}/${id}${suffix}`, { replace: true }))}
        returnFocusTo={returnFocus}
      />
    </div>
  )
}
