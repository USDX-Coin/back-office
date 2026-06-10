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
import TableToolbar from '@/components/table/TableToolbar'
import { useColumnVisibility } from '@/components/table/useColumnVisibility'
import { USERS_FILTER_DEFS, USERS_COLUMN_CONFIG } from './filterDefs'
import { useUsers } from './hooks'
import { canManageUsers, useAuth } from '@/lib/auth'
import { getKycStatusConfig } from '@/lib/status'
import { cn } from '@/lib/utils'
import type { EntityType, KycStatus, PhaseOneUser } from '@/lib/types'

const PAGE_SIZE = 10

const ENTITY_LABEL: Record<EntityType, string> = {
  INDIVIDUAL: 'Individual',
  LEGAL_ENTITY: 'Legal Entity',
}

export default function UsersPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const canManage = canManageUsers(user)
  const params = useDataTableParams()
  const search = params.searchParams.get('search') ?? ''
  const kycStatusParam = (params.searchParams.get('kycStatus') ?? '') as KycStatus | ''
  const entityTypeParam = (params.searchParams.get('entityType') ?? '') as EntityType | ''

  const list = useUsers({
    page: params.page,
    limit: PAGE_SIZE,
    search: search || undefined,
    kycStatus: kycStatusParam || undefined,
    entityType: entityTypeParam || undefined,
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

  const [colVisibility, setColVisibility] = useColumnVisibility('users', USERS_COLUMN_CONFIG)
  const filterValues = { kycStatus: kycStatusParam, entityType: entityTypeParam }

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
            aria-label={`Open ${u.name ?? u.email}`}
          >
            {/* Self-signup users have no name until first KYC submit
                (users.yaml § User.name nullable) — fall back to email. */}
            <Avatar name={u.name ?? u.email} size="sm" />
            <span className="font-medium">{u.name ?? '—'}</span>
          </button>
        )
      },
    },
    {
      id: 'email',
      header: 'Email',
      cell: ({ row }) => (
        <span className="text-[12.5px] text-muted-foreground">
          {row.original.email || '—'}
        </span>
      ),
    },
    {
      id: 'entityType',
      header: 'Entity',
      cell: ({ row }) => (
        <span className="text-[12.5px]">
          {ENTITY_LABEL[row.original.entityType] ?? row.original.entityType}
        </span>
      ),
    },
    {
      id: 'kycStatus',
      header: 'KYC',
      cell: ({ row }) => {
        const cfg = getKycStatusConfig(row.original.kycStatus)
        return (
          <span
            className={cn(
              'inline-flex rounded-sm px-2 py-0.5 text-[11.5px] font-medium',
              cfg.className
            )}
          >
            {cfg.label}
          </span>
        )
      },
    },
    {
      id: 'suspended',
      header: 'Status',
      cell: ({ row }) =>
        row.original.suspended ? (
          <span className="inline-flex rounded-sm bg-destructive/10 px-2 py-0.5 text-[11.5px] font-medium text-destructive">
            Suspended
          </span>
        ) : null,
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
  const hasFilters = Boolean(search || kycStatusParam || entityTypeParam)

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
        isError={list.isError}
        onRetry={() => list.refetch()}
        pageSize={PAGE_SIZE}
        columnVisibility={colVisibility}
        onColumnVisibilityChange={setColVisibility}
        filterToolbar={
          <TableToolbar
            search={{
              value: search,
              placeholder: 'Search by name, email, or wallet',
              onChange: (next) => params.updateParams({ search: next || null, page: '1' }),
            }}
            filter={{
              defs: USERS_FILTER_DEFS,
              values: filterValues,
              onChange: (next) =>
                params.updateParams({
                  kycStatus: next.kycStatus || null,
                  entityType: next.entityType || null,
                  page: '1',
                }),
            }}
            columns={{
              items: USERS_COLUMN_CONFIG,
              visibility: colVisibility,
              onChange: setColVisibility,
            }}
          />
        }
        hasFilters={hasFilters}
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
