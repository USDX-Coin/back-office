import { useMemo, useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { Plus, Pencil, Trash2, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import DataTable from '@/components/DataTable'
import { useDataTableParams } from '@/components/useDataTableParams'
import PageHeader from '@/components/PageHeader'
import TableEmptyState from '@/components/TableEmptyState'
import StaffModal from './StaffModal'
import StaffDeactivateDialog from './StaffDeactivateDialog'
import StaffFilterToolbar, {
  type StaffFilterValues,
} from './StaffFilterToolbar'
import { useStaff } from './hooks'
import { canManageStaff, useAuth } from '@/lib/auth'
import type { Staff, StaffRole } from '@/lib/types'

const PAGE_SIZE = 10
// Single fetch ceiling. SoT GET /api/v1/staff exposes only page+limit, so we
// load a generous page once and run search / role / active / sort / paginate
// client-side. Phase 1 staff is bounded (handful per org); revisit if it grows.
const FETCH_LIMIT = 100

function formatRole(role: string): string {
  return role
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString()
}

export default function StaffPage() {
  const { user } = useAuth()
  const canManage = canManageStaff(user)
  const params = useDataTableParams()
  const search = params.searchParams.get('search') ?? ''
  const role = (params.searchParams.get('role') ?? '') as StaffRole | ''
  const activeFilter = (params.searchParams.get('active') ?? 'all') as
    | 'all'
    | 'active'
    | 'inactive'
  const sortBy = params.sortBy
  const sortOrder = params.sortOrder

  const list = useStaff({ page: 1, limit: FETCH_LIMIT })
  const allStaff = useMemo<Staff[]>(() => list.data?.data ?? [], [list.data])

  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add')
  const [activeStaff, setActiveStaff] = useState<Staff | null>(null)
  const [deactivateOpen, setDeactivateOpen] = useState(false)

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

  function openDeactivate(s: Staff) {
    setActiveStaff(s)
    setDeactivateOpen(true)
  }

  function handleFilterChange(next: StaffFilterValues) {
    params.updateParams({
      search: next.search || null,
      role: next.role || null,
      active: next.active === 'all' ? null : next.active,
      page: '1',
    })
  }

  // Client-side filter pipeline (search → role → active → sort → paginate).
  const filtered = useMemo(() => {
    let rows = allStaff
    if (search.trim()) {
      const needle = search.trim().toLowerCase()
      rows = rows.filter(
        (s) =>
          s.name.toLowerCase().includes(needle) ||
          s.email.toLowerCase().includes(needle)
      )
    }
    if (role) rows = rows.filter((s) => s.role === role)
    if (activeFilter !== 'all') {
      const want = activeFilter === 'active'
      rows = rows.filter((s) => s.isActive === want)
    }
    if (sortBy) {
      const dir = sortOrder === 'asc' ? 1 : -1
      rows = [...rows].sort((a, b) => {
        const av = (a[sortBy as keyof Staff] ?? '') as string | boolean
        const bv = (b[sortBy as keyof Staff] ?? '') as string | boolean
        if (av < bv) return -1 * dir
        if (av > bv) return 1 * dir
        return 0
      })
    }
    return rows
  }, [allStaff, search, role, activeFilter, sortBy, sortOrder])

  const totalFiltered = filtered.length
  const pageRows = useMemo(() => {
    const start = (params.page - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, params.page])

  const columns: ColumnDef<Staff>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      enableSorting: true,
      cell: ({ row }) => (
        <span className="font-medium">{row.original.name}</span>
      ),
    },
    {
      accessorKey: 'email',
      header: 'Email',
      enableSorting: true,
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.email}</span>
      ),
    },
    {
      accessorKey: 'role',
      header: 'Role',
      enableSorting: true,
      cell: ({ row }) => formatRole(row.original.role),
    },
    {
      accessorKey: 'isActive',
      header: 'Status',
      enableSorting: true,
      cell: ({ row }) =>
        row.original.isActive ? (
          <Badge className="border-transparent bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15">
            Active
          </Badge>
        ) : (
          <Badge variant="secondary">Inactive</Badge>
        ),
    },
    {
      accessorKey: 'createdAt',
      header: 'Created',
      enableSorting: true,
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {formatDate(row.original.createdAt)}
        </span>
      ),
    },
    ...(canManage
      ? [
          {
            id: 'actions',
            header: '',
            enableSorting: false,
            cell: ({ row }: { row: { original: Staff } }) => {
              const isSelf = user?.id === row.original.id
              return (
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
                    onClick={() => openDeactivate(row.original)}
                    aria-label={
                      isSelf
                        ? 'Cannot deactivate your own account'
                        : `Deactivate ${row.original.name}`
                    }
                    disabled={isSelf || !row.original.isActive}
                    title={
                      isSelf
                        ? 'You cannot deactivate your own account'
                        : !row.original.isActive
                          ? 'Already inactive'
                          : undefined
                    }
                    className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive disabled:text-muted-foreground"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )
            },
          } satisfies ColumnDef<Staff>,
        ]
      : []),
  ]

  const noDataState = (
    <TableEmptyState
      mode="no-data"
      icon={
        <ShieldCheck
          className="h-10 w-10 text-muted-foreground/40"
          strokeWidth={1.5}
        />
      }
      title="No staff yet"
      description={
        canManage
          ? 'Add your first back-office operator to get started.'
          : 'No staff to show.'
      }
      cta={
        canManage ? (
          <Button onClick={openAdd} className="mt-2">
            <Plus className="mr-1.5 h-4 w-4" />
            Add Staff
          </Button>
        ) : undefined
      }
    />
  )

  const totalLoaded = list.data?.metadata?.total ?? allStaff.length

  return (
    <div>
      <PageHeader
        eyebrow="Workspace"
        title="Staff"
        italicAccent="directory"
        subtitle={`Internal back-office operators · ${
          list.isLoading ? '…' : totalLoaded
        } total`}
        actions={
          canManage ? (
            <Button onClick={openAdd} size="sm" className="h-7 text-[12px]">
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add Staff
            </Button>
          ) : undefined
        }
      />

      <DataTable
        columns={columns}
        data={pageRows}
        rowCount={totalFiltered}
        isLoading={list.isLoading}
        pageSize={PAGE_SIZE}
        filterToolbar={
          <StaffFilterToolbar
            values={{ search, role, active: activeFilter }}
            onChange={handleFilterChange}
            onClear={params.clearAll}
          />
        }
        hasFilters={Boolean(search || role || activeFilter !== 'all')}
        emptyState={noDataState}
      />

      <StaffModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        mode={modalMode}
        staff={activeStaff}
      />
      <StaffDeactivateDialog
        open={deactivateOpen}
        onOpenChange={setDeactivateOpen}
        staff={activeStaff}
      />
    </div>
  )
}
