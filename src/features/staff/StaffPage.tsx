import { useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import {
  Plus,
  Pencil,
  Trash2,
  UserCog,
  ShieldCheck,
  Activity,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import DataTable from '@/components/DataTable'
import { useDataTableParams } from '@/components/useDataTableParams'
import Avatar from '@/components/Avatar'
import TableEmptyState from '@/components/TableEmptyState'
import StaffModal from './StaffModal'
import StaffDeleteDialog from './StaffDeleteDialog'
import StaffFilterToolbar, { type StaffFilterValues } from './StaffFilterToolbar'
import { useStaff, useStaffSummary } from './hooks'
import type { Staff } from '@/lib/types'

const ROLE_LABEL: Record<Staff['role'], string> = {
  support: 'Support Agent',
  operations: 'Operations Manager',
  compliance: 'Compliance Officer',
  super_admin: 'Super Admin',
}

const ROLE_BADGE: Record<Staff['role'], string> = {
  support: 'bg-muted text-muted-foreground border-border/30',
  operations: 'bg-secondary/40 text-secondary-foreground border-border/30',
  compliance: 'bg-warning/15 text-warning border-warning/30',
  super_admin: 'bg-primary/20 text-primary border-primary/30',
}

export default function StaffPage() {
  const params = useDataTableParams()
  const search = params.searchParams.get('search') ?? ''
  const role = params.searchParams.get('role') ?? ''

  const list = useStaff({
    page: params.page,
    pageSize: 10,
    search,
    role,
    sortBy: params.sortBy,
    sortOrder: params.sortOrder,
  })
  const summary = useStaffSummary()

  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add')
  const [activeStaff, setActiveStaff] = useState<Staff | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)

  function openAdd() {
    setModalMode('add')
    setActiveStaff(null)
    setModalOpen(true)
  }

  function openEdit(s: Staff) {
    setModalMode('edit')
    setActiveStaff(s)
    setModalOpen(true)
  }

  function openDelete(s: Staff) {
    setActiveStaff(s)
    setDeleteOpen(true)
  }

  function handleFilterChange(next: StaffFilterValues) {
    params.updateParams({
      search: next.search || null,
      role: next.role || null,
      page: '1',
    })
  }

  const columns: ColumnDef<Staff>[] = [
    {
      id: 'name',
      header: 'Name',
      cell: ({ row }) => {
        const s = row.original
        return (
          <div className="flex items-center gap-3">
            <Avatar name={s.displayName} size="sm" />
            <span className="font-medium text-foreground">{s.displayName}</span>
          </div>
        )
      },
    },
    { accessorKey: 'email', header: 'Email' },
    { accessorKey: 'phone', header: 'Phone' },
    {
      accessorKey: 'role',
      header: 'Role',
      cell: ({ getValue }) => {
        const r = getValue() as Staff['role']
        return (
          <Badge variant="outline" className={ROLE_BADGE[r]}>
            {ROLE_LABEL[r]}
          </Badge>
        )
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => openEdit(row.original)}
            aria-label={`Edit ${row.original.firstName}`}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => openDelete(row.original)}
            aria-label={`Delete ${row.original.firstName}`}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]

  const noDataState = (
    <TableEmptyState
      mode="no-data"
      icon={<UserCog className="h-10 w-10 text-muted-foreground/40" strokeWidth={1.5} />}
      title="No staff members yet"
      description="Invite your first operator to get started."
      cta={
        <Button onClick={openAdd} className="mt-2 bg-primary text-primary-foreground">
          <Plus className="mr-1.5 h-4 w-4" />
          Add Staff
        </Button>
      }
    />
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Staff</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Internal team directory · {summary.data?.total ?? '…'} members
          </p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="mr-1.5 h-4 w-4" />
          Add Staff
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard
          icon={<UserCog className="h-5 w-5 text-primary" />}
          label="Total Staff"
          value={summary.data?.total ?? '…'}
        />
        <SummaryCard
          icon={<ShieldCheck className="h-5 w-5 text-warning" />}
          label="Admins"
          value={summary.data?.admins ?? '…'}
        />
        <SummaryCard
          icon={<Activity className="h-5 w-5 text-success" />}
          label="Active Now"
          value={summary.data?.activeNow ?? '…'}
        />
      </div>

      <DataTable
        columns={columns}
        data={list.data?.data ?? []}
        rowCount={list.data?.meta.total ?? 0}
        isLoading={list.isLoading}
        filterToolbar={
          <StaffFilterToolbar
            values={{ search, role }}
            onChange={handleFilterChange}
            onClear={params.clearAll}
          />
        }
        hasFilters={Boolean(search || role)}
        emptyState={noDataState}
      />

      <StaffModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        mode={modalMode}
        staff={activeStaff}
      />
      <StaffDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        staff={activeStaff}
      />
    </div>
  )
}

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: number | string
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted/60">
          {icon}
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}
