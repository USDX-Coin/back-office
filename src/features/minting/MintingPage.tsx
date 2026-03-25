import { useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import DataTable from '@/components/DataTable'
import MintingDetailModal from './MintingDetailModal'
import { useMintingList } from './hooks'
import { formatAmount, formatShortDate } from '@/lib/format'
import { getMintingStatusConfig } from '@/lib/status'
import { exportToCsv } from '@/lib/csv'
import type { MintingRequest, MintingStatus } from '@/lib/types'

const statusOptions: { value: string; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'processing', label: 'Processing' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
]

const csvColumns = [
  { key: 'id' as const, header: 'ID' },
  { key: 'requester' as const, header: 'Requester' },
  { key: 'email' as const, header: 'Email' },
  { key: 'amount' as const, header: 'Amount' },
  { key: 'tokenType' as const, header: 'Token Type' },
  { key: 'status' as const, header: 'Status' },
  { key: 'network' as const, header: 'Network' },
  { key: 'createdAt' as const, header: 'Created At' },
]

export default function MintingPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { data, isPending } = useMintingList()

  const selectedItem = data?.data.find((m) => m.id === selectedId) ?? null

  const columns: ColumnDef<MintingRequest, unknown>[] = [
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
      accessorKey: 'email',
      header: 'Email',
      enableSorting: false,
    },
    {
      accessorKey: 'amount',
      header: 'Amount',
      cell: ({ getValue }) => formatAmount(getValue() as number),
      enableSorting: true,
    },
    {
      accessorKey: 'tokenType',
      header: 'Token',
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
        const status = getValue() as MintingStatus
        const config = getMintingStatusConfig(status)
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
    exportToCsv(data.data, csvColumns, `minting-export-${new Date().toISOString().slice(0, 10)}`)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-dark">Minting Requests</h1>
        <p className="text-muted mt-1">Review and manage minting requests</p>
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        rowCount={data?.meta.total ?? 0}
        isLoading={isPending}
        statusOptions={statusOptions}
        onExportCsv={handleExportCsv}
      />

      <MintingDetailModal
        item={selectedItem}
        open={!!selectedId}
        onClose={() => setSelectedId(null)}
      />
    </div>
  )
}
