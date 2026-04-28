import { useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { Plus, Pencil, Trash2, UserCog } from 'lucide-react'
import { Button } from '@/components/ui/button'
import DataTable from '@/components/DataTable'
import { useDataTableParams } from '@/components/useDataTableParams'
import Avatar from '@/components/Avatar'
import PageHeader from '@/components/PageHeader'
import SummaryStat from '@/components/SummaryStat'
import TableEmptyState from '@/components/TableEmptyState'
import StaffModal from './StaffModal'
import StaffDeleteDialog from './StaffDeleteDialog'
import StaffFilterToolbar, { type StaffFilterValues } from './StaffFilterToolbar'
import { useStaff, useStaffSummary } from './hooks'
import type { Staff } from '@/lib/types'
import { cn } from '@/lib/utils'

const ROLE_LABEL: Record<Staff['role'], string> = {
  support: 'Support Agent',
  operations: 'Operations Manager',
  compliance: 'Compliance Officer',
  super_admin: 'Super Admin',
}

const ROLE_PILL: Record<Staff['role'], string> = {
  support: 'bg-muted text-muted-foreground',
  operations: 'bg-muted text-foreground',
  compliance: 'bg-warning/10 text-warning',
  super_admin: 'bg-primary/10 text-primary',
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
          <div className="flex items-center gap-2.5">
            <Avatar name={s.displayName} size="sm" />
            <span className="font-medium text-foreground">{s.displayName}</span>
          </div>
        )
      },
    },
    { accessorKey: 'email', header: 'Email' },
    {
      accessorKey: 'phone',
      header: 'Phone',
      cell: ({ getValue }) => (
        <span className="font-mono text-[12px] tabular-nums">
          {getValue() as string}
        </span>
      ),
    },
    {
      accessorKey: 'role',
      header: 'Role',
      cell: ({ getValue }) => {
        const r = getValue() as Staff['role']
        return (
          <span
            className={cn(
              'inline-flex rounded-sm px-2 py-0.5 text-[11.5px] font-medium',
              ROLE_PILL[r]
            )}
          >
            {ROLE_LABEL[r]}
          </span>
        )
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => openEdit(row.original)}
            aria-label={`Edit ${row.original.firstName}`}
            className="h-7 w-7"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => openDelete(row.original)}
            aria-label={`Delete ${row.original.firstName}`}
            className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ]

  const noDataState = (
    <TableEmptyState
      mode="no-data"
      icon={
        <UserCog
          className="h-10 w-10 text-muted-foreground/40"
          strokeWidth={1.5}
        />
      }
      title="No staff members yet"
      description="Invite your first operator to get started."
      cta={
        <Button onClick={openAdd} className="mt-2">
          <Plus className="mr-1.5 h-4 w-4" />
          Add Staff
        </Button>
      }
    />
  )

  return (
    <div>
      <PageHeader
        eyebrow="Workspace"
        title="Staf"
        italicAccent="directory"
        subtitle={`Internal team directory · ${summary.data?.total ?? '…'} members`}
        actions={
          <Button onClick={openAdd} size="sm" className="h-7 text-[12px]">
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add Staff
          </Button>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <SummaryStat
          label="Total staff"
          value={summary.data?.total ?? '…'}
          hint="all roles"
        />
        <SummaryStat
          label="Admins"
          value={summary.data?.admins ?? '…'}
          hint="super admins"
        />
        <SummaryStat
          label="Active now"
          value={summary.data?.activeNow ?? '…'}
          hint="last 30 days"
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
