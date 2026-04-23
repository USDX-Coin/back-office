import { useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { Plus, Pencil, Trash2, Users as UsersIcon, Activity, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import DataTable from '@/components/DataTable'
import { useDataTableParams } from '@/components/useDataTableParams'
import Avatar from '@/components/Avatar'
import TableEmptyState from '@/components/TableEmptyState'
import UserModal from './UserModal'
import UserDeleteDialog from './UserDeleteDialog'
import UserFilterToolbar, { type UserFilterValues } from './UserFilterToolbar'
import { useCustomers, useCustomerSummary } from './hooks'
import type { Customer } from '@/lib/types'

const ROLE_BADGE: Record<Customer['role'], string> = {
  admin: 'bg-primary/20 text-primary border-primary/30',
  editor: 'bg-secondary/40 text-secondary-foreground border-border/30',
  member: 'bg-muted text-muted-foreground border-border/30',
}

const TYPE_BADGE: Record<Customer['type'], string> = {
  personal: 'bg-success/15 text-success border-success/30',
  organization: 'bg-primary/20 text-primary border-primary/30',
}

export default function UsersPage() {
  const params = useDataTableParams()
  const search = params.searchParams.get('search') ?? ''
  const type = params.searchParams.get('type') ?? ''
  const role = params.searchParams.get('role') ?? ''

  const list = useCustomers({
    page: params.page,
    pageSize: 10,
    search,
    type,
    role,
    sortBy: params.sortBy,
    sortOrder: params.sortOrder,
  })
  const summary = useCustomerSummary()

  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add')
  const [activeCustomer, setActiveCustomer] = useState<Customer | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)

  function openAdd() {
    setModalMode('add')
    setActiveCustomer(null)
    setModalOpen(true)
  }

  function openEdit(c: Customer) {
    setModalMode('edit')
    setActiveCustomer(c)
    setModalOpen(true)
  }

  function openDelete(c: Customer) {
    setActiveCustomer(c)
    setDeleteOpen(true)
  }

  function handleFilterChange(next: UserFilterValues) {
    params.updateParams({
      search: next.search || null,
      type: next.type || null,
      role: next.role || null,
      page: '1',
    })
  }

  function handleClear() {
    params.clearAll()
  }

  const columns: ColumnDef<Customer>[] = [
    {
      id: 'name',
      header: 'Name',
      cell: ({ row }) => {
        const c = row.original
        const fullName = `${c.firstName} ${c.lastName}`.trim()
        return (
          <div className="flex items-center gap-3">
            <Avatar name={fullName} size="sm" />
            <span className="font-medium text-foreground">{fullName}</span>
          </div>
        )
      },
    },
    { accessorKey: 'email', header: 'Email' },
    { accessorKey: 'phone', header: 'Phone' },
    {
      accessorKey: 'type',
      header: 'Type',
      cell: ({ getValue }) => {
        const t = getValue() as Customer['type']
        return (
          <Badge variant="outline" className={TYPE_BADGE[t]}>
            {t === 'personal' ? 'Personal' : 'Organization'}
          </Badge>
        )
      },
    },
    {
      accessorKey: 'organization',
      header: 'Organization',
      cell: ({ getValue }) => (getValue() as string | undefined) ?? '—',
    },
    {
      accessorKey: 'role',
      header: 'Role',
      cell: ({ getValue }) => {
        const r = getValue() as Customer['role']
        return (
          <Badge variant="outline" className={ROLE_BADGE[r]}>
            {r.charAt(0).toUpperCase() + r.slice(1)}
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
      icon={<UsersIcon className="h-10 w-10 text-muted-foreground/40" strokeWidth={1.5} />}
      title="No users yet"
      description="Add your first customer to get started."
      cta={
        <Button onClick={openAdd} className="mt-2 bg-primary text-primary-foreground">
          <Plus className="mr-1.5 h-4 w-4" />
          Add User
        </Button>
      }
    />
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Customer directory · {summary.data?.total ?? '…'} total
          </p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="mr-1.5 h-4 w-4" />
          Add User
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard
          icon={<UsersIcon className="h-5 w-5 text-primary" />}
          label="Total Users"
          value={summary.data?.total ?? '…'}
        />
        <SummaryCard
          icon={<Activity className="h-5 w-5 text-success" />}
          label="Active Now"
          value={summary.data?.active ?? '…'}
        />
        <SummaryCard
          icon={<Building2 className="h-5 w-5 text-warning" />}
          label="Organizations"
          value={summary.data?.organizations ?? '…'}
        />
      </div>

      <DataTable
        columns={columns}
        data={list.data?.data ?? []}
        rowCount={list.data?.meta.total ?? 0}
        isLoading={list.isLoading}
        filterToolbar={
          <UserFilterToolbar
            values={{ search, type, role }}
            onChange={handleFilterChange}
            onClear={handleClear}
          />
        }
        hasFilters={Boolean(search || type || role)}
        emptyState={noDataState}
      />

      <UserModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        mode={modalMode}
        customer={activeCustomer}
      />
      <UserDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        customer={activeCustomer}
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
