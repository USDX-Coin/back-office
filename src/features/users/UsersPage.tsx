import { useState } from 'react'
import { useNavigate } from 'react-router'
import { type ColumnDef } from '@tanstack/react-table'
import { Plus, Pencil, Trash2, Users as UsersIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import DataTable from '@/components/DataTable'
import { useDataTableParams } from '@/components/useDataTableParams'
import Avatar from '@/components/Avatar'
import PageHeader from '@/components/PageHeader'
import SummaryStat from '@/components/SummaryStat'
import TableEmptyState from '@/components/TableEmptyState'
import UserModal from './UserModal'
import UserDeleteDialog from './UserDeleteDialog'
import UserFilterToolbar, { type UserFilterValues } from './UserFilterToolbar'
import { useCustomers, useCustomerSummary } from './hooks'
import { canManageUsers, useAuth } from '@/lib/auth'
import type { Customer } from '@/lib/types'
import { cn } from '@/lib/utils'

const ROLE_PILL: Record<Customer['role'], string> = {
  admin: 'bg-primary/10 text-primary',
  editor: 'bg-muted text-foreground',
  member: 'bg-muted text-muted-foreground',
}

const TYPE_PILL: Record<Customer['type'], string> = {
  personal: 'bg-success/10 text-success',
  organization: 'bg-primary/10 text-primary',
}

export default function UsersPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const canManage = canManageUsers(user)
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

  const columns: ColumnDef<Customer>[] = [
    {
      id: 'name',
      header: 'Name',
      cell: ({ row }) => {
        const c = row.original
        const fullName = `${c.firstName} ${c.lastName}`.trim()
        return (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/users/${c.id}`)
            }}
            className="flex items-center gap-2.5 text-left hover:text-primary"
            aria-label={`Open ${fullName}`}
          >
            <Avatar name={fullName} size="sm" />
            <span className="font-medium">{fullName}</span>
          </button>
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
      accessorKey: 'type',
      header: 'Type',
      cell: ({ getValue }) => {
        const t = getValue() as Customer['type']
        return (
          <span
            className={cn(
              'inline-flex rounded-sm px-2 py-0.5 text-[11.5px] font-medium',
              TYPE_PILL[t]
            )}
          >
            {t === 'personal' ? 'Personal' : 'Organization'}
          </span>
        )
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
    },
    {
      accessorKey: 'role',
      header: 'Role',
      cell: ({ getValue }) => {
        const r = getValue() as Customer['role']
        return (
          <span
            className={cn(
              'inline-flex rounded-sm px-2 py-0.5 text-[11.5px] font-medium',
              ROLE_PILL[r]
            )}
          >
            {r.charAt(0).toUpperCase() + r.slice(1)}
          </span>
        )
      },
    },
    ...(canManage
      ? [
          {
            id: 'actions',
            header: '',
            cell: ({ row }: { row: { original: Customer } }) => (
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
          } satisfies ColumnDef<Customer>,
        ]
      : []),
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
      description={
        canManage
          ? 'Add your first customer to get started.'
          : 'No users to show.'
      }
      cta={
        canManage ? (
          <Button onClick={openAdd} className="mt-2">
            <Plus className="mr-1.5 h-4 w-4" />
            Add User
          </Button>
        ) : undefined
      }
    />
  )

  return (
    <div>
      <PageHeader
        eyebrow="Workspace"
        title="User"
        italicAccent="directory"
        subtitle={`Customer directory · ${summary.data?.total ?? '…'} total`}
        actions={
          canManage ? (
            <Button onClick={openAdd} size="sm" className="h-7 text-[12px]">
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add User
            </Button>
          ) : undefined
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <SummaryStat
          label="Total users"
          value={summary.data?.total ?? '…'}
          hint="all-time"
        />
        <SummaryStat
          label="Active now"
          value={summary.data?.active ?? '…'}
          hint="last 30 days"
        />
        <SummaryStat
          label="Organizations"
          value={summary.data?.organizations ?? '…'}
          hint="active orgs"
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
