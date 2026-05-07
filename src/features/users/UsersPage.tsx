import { useState } from 'react'
import { useNavigate } from 'react-router'
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
import UserFilterToolbar from './UserFilterToolbar'
import { useUsers } from './hooks'
import { canManageUsers, useAuth } from '@/lib/auth'
import type { PhaseOneUser } from '@/lib/types'

const PAGE_SIZE = 10

export default function UsersPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const canManage = canManageUsers(user)
  const params = useDataTableParams()
  const search = params.searchParams.get('search') ?? ''

  const list = useUsers({
    page: params.page,
    limit: PAGE_SIZE,
    search: search || undefined,
  })

  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add')
  const [activeUser, setActiveUser] = useState<PhaseOneUser | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)

  function openAdd() {
    setModalMode('add')
    setActiveUser(null)
    setModalOpen(true)
  }

  function openEdit(u: PhaseOneUser) {
    setModalMode('edit')
    setActiveUser(u)
    setModalOpen(true)
  }

  function openDelete(u: PhaseOneUser) {
    setActiveUser(u)
    setDeleteOpen(true)
  }

  function handleFilterChange(next: { search: string }) {
    params.updateParams({
      search: next.search || null,
      page: '1',
    })
  }

  const columns: ColumnDef<PhaseOneUser>[] = [
    {
      id: 'name',
      header: 'Name',
      cell: ({ row }) => {
        const u = row.original
        return (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/users/${u.id}`)
            }}
            className="flex items-center gap-2.5 text-left hover:text-primary"
            aria-label={`Open ${u.name}`}
          >
            <Avatar name={u.name} size="sm" />
            <span className="font-medium">{u.name}</span>
          </button>
        )
      },
    },
    {
      id: 'wallets',
      header: 'Wallets',
      cell: ({ row }) => {
        const wallets = row.original.wallets
        if (wallets.length === 0) {
          return <span className="text-muted-foreground">—</span>
        }
        const first = wallets[0]!
        const more = wallets.length > 1 ? ` +${wallets.length - 1}` : ''
        return (
          <span className="font-mono text-[11.5px] tabular-nums text-muted-foreground">
            {first.chain} · {first.address.slice(0, 6)}…{first.address.slice(-4)}
            {more}
          </span>
        )
      },
    },
    {
      id: 'notes',
      header: 'Notes',
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.notes ?? '—'}</span>
      ),
    },
    ...(canManage
      ? [
          {
            id: 'actions',
            header: '',
            cell: ({ row }: { row: { original: PhaseOneUser } }) => (
              <div className="flex items-center justify-end gap-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => openEdit(row.original)}
                  aria-label={`Edit ${row.original.name}`}
                  className="h-7 w-7"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => openDelete(row.original)}
                  aria-label={`Delete ${row.original.name}`}
                  className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ),
          } satisfies ColumnDef<PhaseOneUser>,
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
          ? 'Add your first user to get started.'
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

  // SoT openapi.yaml § PaginatedResponse — total lives at metadata.total.
  const total = list.data?.metadata?.total ?? 0

  return (
    <div>
      <PageHeader
        eyebrow="Workspace"
        title="User"
        italicAccent="directory"
        subtitle={`Phase-1 user directory · ${list.isLoading ? '…' : total} total`}
        actions={
          canManage ? (
            <Button onClick={openAdd} size="sm" className="h-7 text-[12px]">
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add User
            </Button>
          ) : undefined
        }
      />

      <DataTable
        columns={columns}
        data={list.data?.data ?? []}
        rowCount={total}
        isLoading={list.isLoading}
        pageSize={PAGE_SIZE}
        filterToolbar={
          <UserFilterToolbar
            values={{ search }}
            onChange={handleFilterChange}
            onClear={params.clearAll}
          />
        }
        hasFilters={Boolean(search)}
        emptyState={noDataState}
      />

      <UserModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        mode={modalMode}
        user={activeUser}
      />
      <UserDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        user={activeUser}
      />
    </div>
  )
}
