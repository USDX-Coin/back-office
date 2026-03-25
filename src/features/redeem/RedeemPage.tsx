import { useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import DataTable from '@/components/DataTable'
import RedeemDetailModal from './RedeemDetailModal'
import { useRedeemList } from './hooks'
import { formatAmount, formatShortDate } from '@/lib/format'
import { getRedeemStatusConfig } from '@/lib/status'
import { exportToCsv } from '@/lib/csv'
import type { RedeemRequest, RedeemStatus } from '@/lib/types'

const statusOptions: { value: string; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
]

const csvColumns = [
  { key: 'id' as const, header: 'ID' },
  { key: 'requester' as const, header: 'Requester' },
  { key: 'amount' as const, header: 'Amount' },
  { key: 'bankName' as const, header: 'Bank Name' },
  { key: 'bankAccount' as const, header: 'Bank Account' },
  { key: 'status' as const, header: 'Status' },
  { key: 'network' as const, header: 'Network' },
  { key: 'createdAt' as const, header: 'Created At' },
]

export default function RedeemPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { data, isPending } = useRedeemList()

  const selectedItem = data?.data.find((r) => r.id === selectedId) ?? null

  const columns: ColumnDef<RedeemRequest, unknown>[] = [
    {
      accessorKey: 'id',
      header: 'ID',
      enableSorting: true,
    },
    {
      accessorKey: 'requester',
      header: 'Requester',
      enableSorting: true,
    },
    {
      accessorKey: 'amount',
      header: 'Amount',
      cell: ({ getValue }) => formatAmount(getValue() as number),
      enableSorting: true,
    },
    {
      accessorKey: 'bankName',
      header: 'Bank',
      enableSorting: false,
    },
    {
      accessorKey: 'network',
      header: 'Network',
      enableSorting: false,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => {
        const status = getValue() as RedeemStatus
        const config = getRedeemStatusConfig(status)
        return (
          <Badge variant={config.variant} className={config.className}>
            {config.label}
          </Badge>
        )
      },
      enableSorting: true,
    },
    {
      accessorKey: 'createdAt',
      header: 'Created',
      cell: ({ getValue }) => formatShortDate(getValue() as string),
      enableSorting: true,
    },
    {
      id: 'actions',
      header: 'Action',
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelectedId(row.original.id)}
        >
          <Eye className="mr-1 h-4 w-4" />
          Detail
        </Button>
      ),
      enableSorting: false,
    },
  ]

  function handleExportCsv() {
    if (!data?.data) return
    exportToCsv(data.data, csvColumns, `redeem-export-${new Date().toISOString().slice(0, 10)}`)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-dark">Redeem Requests</h1>
        <p className="text-muted mt-1">Monitor redeem requests</p>
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        rowCount={data?.meta.total ?? 0}
        isLoading={isPending}
        statusOptions={statusOptions}
        onExportCsv={handleExportCsv}
      />

      <RedeemDetailModal
        item={selectedItem}
        open={!!selectedId}
        onClose={() => setSelectedId(null)}
      />
    </div>
  )
}
