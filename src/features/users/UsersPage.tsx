import { useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { Plus, Pencil, Trash2, Users as UsersIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import DataTable from '@/components/DataTable'
import { useDataTableParams } from '@/components/useDataTableParams'
import Avatar from '@/components/Avatar'
import PageHeader from '@/components/PageHeader'
import TableEmptyState from '@/components/TableEmptyState'
import UserModal from './UserModal'
import UserDeleteDialog from './UserDeleteDialog'
import UserFilterToolbar, { type UserFilterValues } from './UserFilterToolbar'
import { useCustomers } from './hooks'
import type { Customer } from '@/lib/types'
import { StatusPill, type StatusTone } from '@/components/StatusPill'

const ROLE_TONE: Record<Customer['role'], StatusTone> = {
  admin: 'info',
  editor: 'neutral',
  member: 'neutral',
}

const TYPE_TONE: Record<Customer['type'], StatusTone> = {
  personal: 'success',
  organization: 'info',
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

  const columns: ColumnDef<Customer>[] = [
    {
      id: 'name',
      header: 'Name',
      cell: ({ row }) => {
        const c = row.original
        const fullName = `${c.firstName} ${c.lastName}`.trim()
        return (
          <div className="flex items-center gap-2.5">
            <Avatar name={fullName} size="sm" />
            <span className="font-medium text-foreground">{fullName}</span>
          </div>
        )
      },
    },
    {
      accessorKey: 'email',
      header: 'Email',
      meta: { filterType: 'text' },
    },
    {
      accessorKey: 'phone',
      header: 'Phone',
      cell: ({ getValue }) => (
        <span className="font-mono text-[12px] tabular-nums">
          {getValue() as string}
        </span>
      ),
      meta: { filterType: 'text' },
    },
    {
      accessorKey: 'type',
      header: 'Type',
      cell: ({ getValue }) => {
        const t = getValue() as Customer['type']
        return (
          <StatusPill
            label={t === 'personal' ? 'Personal' : 'Organization'}
            tone={TYPE_TONE[t]}
            appearance="soft"
          />
        )
      },
      meta: {
        filterType: 'enum',
        enumOptions: [
          { value: 'personal', label: 'Personal' },
          { value: 'organization', label: 'Organization' },
        ],
      },
    },
    {
      accessorKey: 'organization',
      header: 'Organization',
      cell: ({ getValue }) => (
        <span className="text-muted-foreground">
          {(getValue() as string | undefined) ?? '—'}
        </span>
      ),
      meta: { filterType: 'text' },
    },
    {
      accessorKey: 'role',
      header: 'Role',
      meta: {
        filterType: 'enum',
        enumOptions: [
          { value: 'admin', label: 'Admin' },
          { value: 'editor', label: 'Editor' },
          { value: 'member', label: 'Member' },
        ],
      },
      cell: ({ getValue }) => {
        const r = getValue() as Customer['role']
        return (
          <StatusPill
            label={r.charAt(0).toUpperCase() + r.slice(1)}
            tone={ROLE_TONE[r]}
            appearance="soft"
          />
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
        <UsersIcon
          className="h-10 w-10 text-muted-foreground/40"
          strokeWidth={1.5}
        />
      }
      title="No users yet"
      description="Add your first customer to get started."
      cta={
        <Button onClick={openAdd} className="mt-2">
          <Plus className="mr-1.5 h-4 w-4" />
          Add User
        </Button>
      }
    />
  )

  return (
    <div>
      <PageHeader
        title="User Client"
        actions={
          <Button onClick={openAdd} size="sm">
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add User
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={list.data?.data ?? []}
        rowCount={list.data?.meta.total ?? 0}
        isLoading={list.isLoading}
        filterToolbar={
          <UserFilterToolbar
            values={{ search, type, role }}
            onChange={handleFilterChange}
            onClear={params.clearAll}
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
