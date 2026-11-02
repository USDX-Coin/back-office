import { type ColumnDef } from '@tanstack/react-table'
import { Eye } from 'lucide-react'
import StatusPill from '@/components/StatusPill'
import { TableCellStack } from '@/components/ui/table'
import { formatDateTime } from '@/lib/format'
import {
  formatIdrOrDash,
  formatUsdDifference,
  formatUsdOrDash,
  formatWaiting,
  isUsdShortfall,
  mintSwapIssueLabel,
  mintSwapStatusPill,
} from '@/lib/mintSwaps'
import { formatUsdxExact } from '@/lib/redeemApprovals'
import type { MintSwapListItem } from '@/lib/types'

const timeCol: ColumnDef<MintSwapListItem> = {
  id: 'queuedAt',
  size: 168,
  header: 'Masuk antrean (WIB)',
  cell: ({ row }) => (
    <span className="text-xs tabular-nums text-muted-foreground">{formatDateTime(row.original.queuedAt)}</span>
  ),
}

const customerCol: ColumnDef<MintSwapListItem> = {
  id: 'customer',
  size: 176,
  header: 'Nasabah',
  cell: ({ row }) => (
    <TableCellStack
      lines={[
        { value: row.original.customerName ?? '—', className: 'text-sm font-medium' },
        { value: row.original.mintOrderId, className: 'font-mono text-xs text-muted-foreground' },
      ]}
    />
  ),
}

const amountCol = (header: string): ColumnDef<MintSwapListItem> => ({
  id: 'amount',
  size: 176,
  header,
  cell: ({ row }) => (
    <TableCellStack
      lines={[
        { value: formatUsdxExact(row.original.amountUsdx), className: 'text-sm font-semibold tabular-nums' },
        { value: formatIdrOrDash(row.original.plannedIdr), className: 'text-xs tabular-nums text-muted-foreground' },
      ]}
    />
  ),
})

const attemptsCol: ColumnDef<MintSwapListItem> = {
  id: 'attempts',
  size: 96,
  header: 'Percobaan',
  cell: ({ row }) => <span className="text-xs tabular-nums">{row.original.attemptCount}×</span>,
}

const waitingCol = (header: string): ColumnDef<MintSwapListItem> => ({
  id: 'waiting',
  size: 120,
  header,
  cell: ({ row }) => <span className="text-xs tabular-nums">{formatWaiting(row.original.waitingSeconds)}</span>,
})

const detailCol = (open: (id: string) => void): ColumnDef<MintSwapListItem> => ({
  id: 'actions',
  size: 96,
  header: '',
  cell: ({ row }) => (
    <button
      type="button"
      tabIndex={-1}
      onClick={(e) => {
        e.stopPropagation()
        open(row.original.id)
      }}
      className="inline-flex items-center gap-1 rounded-sm px-2 py-1 text-label font-medium text-primary transition-colors hover:bg-muted"
      aria-hidden
    >
      <Eye className="h-3.5 w-3.5" />
      Detail
    </button>
  ),
})

/** Kolom "Swap IDR→USD" (semua status). */
export function mintSwapColumns(open: (id: string) => void): ColumnDef<MintSwapListItem>[] {
  return [
    timeCol,
    {
      id: 'status',
      size: 184,
      header: 'Status',
      cell: ({ row }) => {
        const issue = row.original.status === 'NEEDS_ACTION' ? mintSwapIssueLabel(row.original.issueCode) : null
        return (
          <div className="flex min-w-0 flex-col gap-1">
            <StatusPill cfg={mintSwapStatusPill(row.original.status)} className="w-fit" />
            {issue && (
              <span className="truncate text-xs text-muted-foreground" title={issue}>
                {issue}
              </span>
            )}
          </div>
        )
      },
    },
    customerCol,
    amountCol('USDX'),
    {
      id: 'usd',
      size: 160,
      header: 'Dolar diterima',
      cell: ({ row }) => {
        const diff = formatUsdDifference(row.original.usdDifference)
        return (
          <TableCellStack
            lines={[
              { value: formatUsdOrDash(row.original.creditedUsd), className: 'text-sm tabular-nums' },
              ...(diff
                ? [
                    {
                      value: diff,
                      className: isUsdShortfall(row.original.usdDifference)
                        ? 'text-xs text-destructive'
                        : 'text-xs text-muted-foreground',
                    },
                  ]
                : []),
            ]}
          />
        )
      },
    },
    attemptsCol,
    waitingCol('Lama'),
    detailCol(open),
  ]
}

/** Kolom antrean "Swap Bermasalah". */
export function mintSwapIssueColumns(
  open: (id: string) => void,
  pendingBySwap: Map<string, string>,
): ColumnDef<MintSwapListItem>[] {
  return [
    timeCol,
    {
      id: 'issue',
      size: 280,
      header: 'Alasan',
      cell: ({ row }) => {
        const issue = mintSwapIssueLabel(row.original.issueCode)
        return (
          <div className="flex min-w-0 flex-col gap-1">
            {pendingBySwap.has(row.original.id) ? (
              <span className="w-fit rounded-sm bg-gold-soft px-1.5 py-0.5 text-label text-gold-foreground">
                Menunggu persetujuan
              </span>
            ) : (
              <StatusPill cfg={mintSwapStatusPill(row.original.status)} className="w-fit" />
            )}
            <span className="line-clamp-2 text-xs" title={issue ?? undefined}>
              {issue ?? '—'}
            </span>
          </div>
        )
      },
    },
    customerCol,
    amountCol('Nominal'),
    attemptsCol,
    waitingCol('Menunggu'),
    detailCol(open),
  ]
}
