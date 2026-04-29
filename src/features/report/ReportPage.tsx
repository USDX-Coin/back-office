import { useCallback, useMemo, useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { ArrowDown, ArrowUp, Copy, Download } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import DataTable from '@/components/DataTable'
import { useDataTableParams } from '@/components/useDataTableParams'
import Avatar from '@/components/Avatar'
import PageHeader from '@/components/PageHeader'
import ReportFilterToolbar, { type ReportFilterValues } from './ReportFilterToolbar'
import ReportInsightsBento from './ReportInsightsBento'
import { useReport, useReportInsights, fetchAllReportRows } from './hooks'
import { exportToCsv } from '@/lib/csv'
import { formatShortDate } from '@/lib/format'
import { StatusPill } from '@/components/StatusPill'
import type { Customer, Network, ReportRow } from '@/lib/types'
import { cn } from '@/lib/utils'

const NETWORK_DOT: Record<Network, string> = {
  ethereum: 'bg-[#627EEA]',
  polygon: 'bg-[#8247E5]',
  arbitrum: 'bg-[#28A0F0]',
  solana: 'bg-[#9945FF]',
  base: 'bg-[#0052FF]',
}

const NETWORK_LABEL: Record<Network, string> = {
  ethereum: 'Ethereum',
  polygon: 'Polygon',
  arbitrum: 'Arbitrum',
  solana: 'Solana',
  base: 'Base',
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

  const [customerSelection, setCustomerSelection] = useState<Customer | null>(null)
  const activeCustomer =
    customerSelection && customerSelection.id === customerId ? customerSelection : null

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
      cell: ({ getValue }) => (
        <span className="font-mono text-[12px] tabular-nums text-muted-foreground">
          {formatShortDate(getValue() as string)}
        </span>
      ),
      enableSorting: true,
    },
    {
      accessorKey: 'txHash',
      header: 'Tx',
      cell: ({ getValue }) => {
        const hash = getValue() as string
        return (
          <button
            type="button"
            onClick={() => copyHash(hash)}
            className="inline-flex items-center gap-1.5 font-mono text-[11.5px] text-muted-foreground hover:text-primary"
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
      header: 'Direction',
      cell: ({ getValue }) => {
        const k = getValue() as 'mint' | 'redeem'
        return (
          <span
            className={cn(
              'inline-flex items-center gap-1 text-[11.5px]',
              k === 'mint' ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            {k === 'mint' ? (
              <ArrowUp className="h-3 w-3" />
            ) : (
              <ArrowDown className="h-3 w-3" />
            )}
            {k === 'mint' ? 'Mint' : 'Redeem'}
          </span>
        )
      },
    },
    {
      id: 'customer',
      header: 'Customer',
      cell: ({ row }) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={row.original.customerName} size="sm" />
          <span className="font-medium">{row.original.customerName}</span>
        </div>
      ),
    },
    {
      accessorKey: 'network',
      header: 'Network',
      cell: ({ getValue }) => {
        const n = getValue() as Network
        return (
          <span className="inline-flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
            <span className={cn('h-1.5 w-1.5 rounded-full', NETWORK_DOT[n])} />
            {NETWORK_LABEL[n]}
          </span>
        )
      },
    },
    {
      accessorKey: 'amount',
      header: 'Amount',
      cell: ({ getValue }) => (
        <span className="font-mono font-medium tabular-nums">
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
        return <StatusPill status={s} appearance="soft" />
      },
    },
  ]

  const hasFilters = Boolean(
    startDate || endDate || type || status || customerId || searchParam
  )

  return (
    <div>
      <PageHeader
        eyebrow="Insights"
        title="Report"
        italicAccent="transactions"
        subtitle="Filter, search, and export OTC transaction history."
        actions={
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[12px]"
            onClick={handleExport}
          >
            <Download className="mr-1 h-3.5 w-3.5" />
            Export CSV
          </Button>
        }
      />

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

      <div className="mt-6">
        <ReportInsightsBento data={insights.data} />
      </div>
    </div>
  )
}
