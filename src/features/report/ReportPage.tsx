import { useCallback, useMemo, useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { Copy, Download } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import DataTable from '@/components/DataTable'
import { useDataTableParams } from '@/components/useDataTableParams'
import Avatar from '@/components/Avatar'
import ReportFilterToolbar, { type ReportFilterValues } from './ReportFilterToolbar'
import ReportInsightsBento from './ReportInsightsBento'
import { useReport, useReportInsights, fetchAllReportRows } from './hooks'
import { exportToCsv } from '@/lib/csv'
import { formatShortDate } from '@/lib/format'
import { getOtcStatusConfig } from '@/lib/status'
import type { Customer, ReportRow } from '@/lib/types'
import { cn } from '@/lib/utils'

const NETWORK_DOT: Record<string, string> = {
  ethereum: 'bg-slate-400',
  polygon: 'bg-purple-500',
  arbitrum: 'bg-blue-500',
  solana: 'bg-emerald-500',
  base: 'bg-blue-400',
}

const KIND_BADGE: Record<'mint' | 'redeem', string> = {
  mint: 'bg-primary/20 text-primary border-primary/30',
  redeem: 'bg-warning/15 text-warning border-warning/30',
}

const CSV_COLUMNS: { key: keyof ReportRow; header: string }[] = [
  { key: 'createdAt', header: 'Date' },
  { key: 'txHash', header: 'Transaction ID' },
  { key: 'kind', header: 'Type' },
  { key: 'customerName', header: 'Customer' },
  { key: 'network', header: 'Network' },
  { key: 'amount', header: 'Amount' },
  { key: 'status', header: 'Status' },
]

function shortHash(hash: string): string {
  if (hash.length < 14) return hash
  return `${hash.slice(0, 8)}…${hash.slice(-4)}`
}

async function copyHash(hash: string) {
  try {
    await navigator.clipboard.writeText(hash)
    toast.success('Transaction ID copied')
  } catch {
    toast.error('Copy failed')
  }
}

export default function ReportPage() {
  const params = useDataTableParams()
  const startDate = params.searchParams.get('startDate') ?? ''
  const endDate = params.searchParams.get('endDate') ?? ''
  const type = params.searchParams.get('type') ?? ''
  const status = params.searchParams.get('status') ?? ''
  const customerId = params.searchParams.get('customerId') ?? ''
  const searchParam = params.searchParams.get('search') ?? ''

  // Customer object kept locally so the typeahead chip re-renders after URL restore.
  const [customerSelection, setCustomerSelection] = useState<Customer | null>(null)
  const activeCustomer = customerSelection && customerSelection.id === customerId ? customerSelection : null

  const filters = useMemo(
    () => ({
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      type: type || undefined,
      status: status || undefined,
      customerId: customerId || undefined,
      search: searchParam || undefined,
    }),
    [startDate, endDate, type, status, customerId, searchParam]
  )

  const list = useReport({
    ...filters,
    page: params.page,
    pageSize: 10,
    sortBy: params.sortBy || undefined,
    sortOrder: params.sortOrder || undefined,
  })
  const insights = useReportInsights(filters)

  const filterValues: ReportFilterValues = {
    startDate,
    endDate,
    type,
    status,
    customer: activeCustomer,
    search: searchParam,
  }

  function handleFilterChange(next: ReportFilterValues) {
    setCustomerSelection(next.customer)
    params.updateParams({
      startDate: next.startDate || null,
      endDate: next.endDate || null,
      type: next.type || null,
      status: next.status || null,
      customerId: next.customer?.id ?? null,
      search: next.search || null,
      page: '1',
    })
  }

  function handleClear() {
    setCustomerSelection(null)
    params.clearAll()
  }

  const handleExport = useCallback(async () => {
    try {
      const rows = await fetchAllReportRows(filters)
      exportToCsv(
        rows.map((r) => ({
          ...r,
          createdAt: formatShortDate(r.createdAt),
        })),
        CSV_COLUMNS,
        `usdx-report-${new Date().toISOString().slice(0, 10)}`
      )
      toast.success(`Exported ${rows.length} rows`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed')
    }
  }, [filters])

  const columns: ColumnDef<ReportRow>[] = [
    {
      accessorKey: 'createdAt',
      header: 'Date',
      cell: ({ getValue }) => formatShortDate(getValue() as string),
      enableSorting: true,
    },
    {
      accessorKey: 'txHash',
      header: 'Transaction ID',
      cell: ({ getValue }) => {
        const hash = getValue() as string
        return (
          <button
            type="button"
            onClick={() => copyHash(hash)}
            className="inline-flex items-center gap-1.5 font-mono text-xs text-foreground hover:text-primary"
            title={hash}
            aria-label={`Copy ${hash}`}
          >
            {shortHash(hash)}
            <Copy className="h-3 w-3 opacity-40" />
          </button>
        )
      },
    },
    {
      accessorKey: 'kind',
      header: 'Type',
      cell: ({ getValue }) => {
        const k = getValue() as 'mint' | 'redeem'
        return (
          <Badge variant="outline" className={cn('text-[10px] uppercase', KIND_BADGE[k])}>
            {k}
          </Badge>
        )
      },
    },
    {
      id: 'customer',
      header: 'Customer',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Avatar name={row.original.customerName} size="sm" />
          <span className="text-sm">{row.original.customerName}</span>
        </div>
      ),
    },
    {
      accessorKey: 'network',
      header: 'Network',
      cell: ({ getValue }) => {
        const n = getValue() as string
        return (
          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <span className={cn('inline-flex h-1.5 w-1.5 rounded-full', NETWORK_DOT[n] ?? 'bg-slate-400')} />
            {n.charAt(0).toUpperCase() + n.slice(1)}
          </span>
        )
      },
    },
    {
      accessorKey: 'amount',
      header: 'Amount',
      cell: ({ getValue }) => (
        <span className="font-medium text-foreground">
          ${(getValue() as number).toLocaleString()}
        </span>
      ),
      enableSorting: true,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => {
        const s = getValue() as ReportRow['status']
        const cfg = getOtcStatusConfig(s)
        return (
          <Badge variant="outline" className={cfg.className}>
            {cfg.label}
          </Badge>
        )
      },
    },
  ]

  const hasFilters = Boolean(
    startDate || endDate || type || status || customerId || searchParam
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Transaction Reporting</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Filter, search, and export OTC transaction history.
          </p>
        </div>
        <Button variant="outline" onClick={handleExport}>
          <Download className="mr-1.5 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={list.data?.data ?? []}
        rowCount={list.data?.meta.total ?? 0}
        isLoading={list.isLoading}
        filterToolbar={
          <ReportFilterToolbar
            values={filterValues}
            onChange={handleFilterChange}
            onClear={handleClear}
          />
        }
        hasFilters={hasFilters}
      />

      <ReportInsightsBento data={insights.data} />
    </div>
  )
}
