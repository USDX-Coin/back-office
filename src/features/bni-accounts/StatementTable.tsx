import { useMemo, type ReactNode } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import DataTable from '@/components/DataTable'
import StatusPill from '@/components/StatusPill'
import { formatBankAmount, formatBniPostDate } from '@/lib/format'
import { getBniFlagConfig } from '@/lib/status'
import type { BniStatementRow } from '@/lib/types'
import { pageOf, statementRowKey, type IndexedStatementRow } from './statementRows'

// USDX-631 — sot/bni-integration.md § 16.4 "Tabel": bank columns as-is.
// Every nullable (MALFORMED) value renders "—", never NaN / Invalid Date; no
// per-row anomaly icon (the count sits in the summary line).

function Dash() {
  return <span className="text-muted-foreground/40">—</span>
}

function MonoCell({ value }: { value: string | null | undefined }) {
  return value ? <span className="font-mono text-[12px] tabular-nums">{value}</span> : <Dash />
}

function buildStatementColumns(currency: string | null | undefined): ColumnDef<IndexedStatementRow>[] {
  const amount = (row: BniStatementRow, key: 'amount' | 'balance') =>
    row[key] == null ? <Dash /> : (
      <span className="font-mono text-[12px] font-medium tabular-nums">
        {formatBankAmount(row[key], currency)}
      </span>
    )
  return [
    {
      id: 'postDate',
      header: 'Tanggal posting',
      cell: ({ row }) => (
        <span className="font-mono text-[12px] tabular-nums text-muted-foreground">
          {formatBniPostDate(row.original.row.postDate)}
        </span>
      ),
    },
    {
      id: 'flag',
      header: 'Jenis',
      cell: ({ row }) => <StatusPill cfg={getBniFlagConfig(row.original.row.flag)} />,
    },
    {
      id: 'amount',
      header: 'Nominal',
      cell: ({ row }) => amount(row.original.row, 'amount'),
    },
    {
      id: 'balance',
      header: 'Saldo setelah',
      cell: ({ row }) => amount(row.original.row, 'balance'),
    },
    {
      id: 'description',
      header: 'Deskripsi',
      cell: ({ row }) => (
        <span className="block max-w-[28rem] whitespace-pre-wrap break-words text-[12.5px]">
          {row.original.row.description || <Dash />}
        </span>
      ),
    },
    {
      id: 'journalNo',
      header: 'No. jurnal',
      cell: ({ row }) => <MonoCell value={row.original.row.journalNo} />,
    },
    {
      id: 'branchName',
      header: 'Cabang',
      cell: ({ row }) => (
        <span className="text-[12px] text-muted-foreground">
          {row.original.row.branchName || <Dash />}
        </span>
      ),
    },
  ]
}

interface Props {
  /** Already sorted (sortStatementRows) — the WHOLE result; this component slices the page. */
  rows: IndexedStatementRow[]
  page: number
  pageSize: number
  currency: string | null | undefined
  isLoading: boolean
  toolbar: ReactNode
  emptyState: ReactNode
}

export default function StatementTable({
  rows,
  page,
  pageSize,
  currency,
  isLoading,
  toolbar,
  emptyState,
}: Props) {
  const columns = useMemo(() => buildStatementColumns(currency), [currency])
  return (
    <DataTable<IndexedStatementRow>
      columns={columns}
      data={pageOf(rows, page, pageSize)}
      rowCount={rows.length}
      isLoading={isLoading}
      pageSize={pageSize}
      hasFilters={false}
      getRowId={statementRowKey}
      filterToolbar={toolbar}
      emptyState={emptyState}
    />
  )
}
