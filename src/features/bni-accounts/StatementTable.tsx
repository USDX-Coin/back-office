import { useMemo, type ReactNode } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import DataTable from '@/components/DataTable'
import StatusPill from '@/components/StatusPill'
import { formatBankAmount, formatBniPostDate } from '@/lib/format'
import { getBniFlagConfig } from '@/lib/status'
import type { BniStatementRow } from '@/lib/types'
import {
  pageOf,
  statementRowKey,
  statementSourceLabel,
  type IndexedStatementRow,
} from './statementRows'

// USDX-631 / USDX-692 — sot/bni-integration.md § 16.4 "Tabel" + § 16.8.8
// (kolom Sumber): bank columns as-is.
// Every nullable (MALFORMED) value renders "—", never NaN / Invalid Date; no
// per-row anomaly icon (the count sits in the summary line).

function Dash() {
  return <span className="text-muted-foreground/40">—</span>
}

function MonoCell({ value }: { value: string | null | undefined }) {
  return value ? (
    <span className="block truncate font-mono text-xs tabular-nums" title={value}>
      {value}
    </span>
  ) : (
    <Dash />
  )
}

function buildStatementColumns(currency: string | null | undefined): ColumnDef<IndexedStatementRow>[] {
  // Nominal bank: `title` membawa nilai UTUH. Mutasi rekening operasional bisa
  // menyentuh miliaran, dan nominal yang terbaca separuh di layar rekonsiliasi
  // adalah kesalahan pencocokan yang tidak meninggalkan jejak.
  const amount = (row: BniStatementRow, key: 'amount' | 'balance') => {
    if (row[key] == null) return <Dash />
    const teks = formatBankAmount(row[key], currency)
    return (
      <span
        className="block truncate font-mono text-xs font-medium tabular-nums"
        title={teks}
      >
        {teks}
      </span>
    )
  }
  return [
    {
      id: 'postDate',
      // `YYYY-MM-DD HH:MM:SS` bank, utuh dengan detiknya.
      size: 176,
      header: 'Tanggal posting',
      cell: ({ row }) => (
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {formatBniPostDate(row.original.row.postDate)}
        </span>
      ),
    },
    {
      id: 'flag',
      size: 96,
      header: 'Jenis',
      cell: ({ row }) => <StatusPill cfg={getBniFlagConfig(row.original.row.flag)} />,
    },
    {
      id: 'amount',
      size: 176,
      header: 'Nominal',
      cell: ({ row }) => amount(row.original.row, 'amount'),
    },
    {
      id: 'balance',
      size: 176,
      header: 'Saldo setelah',
      cell: ({ row }) => amount(row.original.row, 'balance'),
    },
    {
      id: 'description',
      // Satu-satunya kolom yang memang melipat (`whitespace-pre-wrap`).
      size: 320,
      header: 'Deskripsi',
      cell: ({ row }) => (
        <span className="block max-w-[28rem] whitespace-pre-wrap break-words text-xs">
          {row.original.row.description || <Dash />}
        </span>
      ),
    },
    {
      id: 'journalNo',
      size: 152,
      header: 'No. jurnal',
      cell: ({ row }) => <MonoCell value={row.original.row.journalNo} />,
    },
    {
      id: 'branchName',
      size: 160,
      header: 'Cabang',
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {row.original.row.branchName || <Dash />}
        </span>
      ),
    },
    {
      id: 'source',
      size: 112,
      header: 'Sumber',
      cell: ({ row }) => {
        const label = statementSourceLabel(row.original.row.source)
        return label ? (
          <span className="font-mono text-2xs uppercase tracking-[0.04em] text-muted-foreground">
            {label}
          </span>
        ) : (
          <Dash />
        )
      },
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
  // Clamp a stale `?page=` (browser Back after a smaller re-pull) to the last
  // real page so the table never shows an empty slice of a non-empty result.
  const lastPage = Math.max(1, Math.ceil(rows.length / pageSize))
  const safePage = Math.min(Math.max(1, page || 1), lastPage)
  return (
    <DataTable<IndexedStatementRow>
      columns={columns}
      data={pageOf(rows, safePage, pageSize)}
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
