import { useMemo, useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { Plus, Pencil, Trash2, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import DataTable from '@/components/DataTable'
import { TableCellText } from '@/components/ui/table'
import { formatShortDate } from '@/lib/format'
import { formatRole } from '@/components/layout/navItems'
import { useDataTableParams } from '@/components/useDataTableParams'
import PageHeader from '@/components/PageHeader'
import TableEmptyState from '@/components/TableEmptyState'
import StaffModal from './StaffModal'
import StaffDeactivateDialog from './StaffDeactivateDialog'
import TableToolbar from '@/components/table/TableToolbar'
import { useColumnVisibility } from '@/components/table/useColumnVisibility'
import {
  STAFF_FILTER_DEFS,
  STAFF_SORT_COLUMNS,
  STAFF_COLUMN_CONFIG,
} from './filterDefs'
import { useStaff } from './hooks'
import { canManageStaff, useAuth } from '@/lib/auth'
import type { Staff, StaffRole } from '@/lib/types'

const PAGE_SIZE = 10
// Single fetch ceiling. SoT GET /api/v1/staff exposes only page+limit, so we
// load a generous page once and run search / role / active / sort / paginate
// client-side. Phase 1 staff is bounded (handful per org); revisit if it grows.
const FETCH_LIMIT = 100

export default function StaffPage() {
  const { user } = useAuth()
  const canManage = canManageStaff(user)
  const params = useDataTableParams()
  const search = params.searchParams.get('search') ?? ''
  const role = (params.searchParams.get('role') ?? '') as StaffRole | ''
  // USDX-27: active is now a select filter (URL: 'active' | 'inactive' | empty=all)
  // matching the FilterDef in filterDefs.ts.
  const activeFilter = (params.searchParams.get('active') ?? '') as
    | ''
    | 'active'
    | 'inactive'
  const sortBy = params.sortBy
  const sortOrder = params.sortOrder
  const filterValues = { role, active: activeFilter }
  const [colVisibility, setColVisibility] = useColumnVisibility('staff', STAFF_COLUMN_CONFIG)

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
    if (activeFilter) {
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
      size: 192,
      header: 'Nama',
      enableSorting: true,
      cell: ({ row }) => (
        <TableCellText value={row.original.name} className="font-medium" />
      ),
    },
    {
      accessorKey: 'email',
      size: 256,
      header: 'Email',
      enableSorting: true,
      cell: ({ row }) => (
        <TableCellText value={row.original.email} className="text-muted-foreground" />
      ),
    },
    {
      accessorKey: 'role',
      size: 128,
      header: 'Peran',
      enableSorting: true,
      // Nilai enum ditulis apa adanya — lihat catatan di `filterDefs.ts`.
      cell: ({ row }) => formatRole(row.original.role),
    },
    {
      accessorKey: 'isActive',
      size: 120,
      header: 'Status',
      enableSorting: true,
      cell: ({ row }) =>
        row.original.isActive ? (
          <Badge className="border-transparent bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15 dark:text-success">
            Aktif
          </Badge>
        ) : (
          <Badge variant="secondary">Nonaktif</Badge>
        ),
    },
    {
      accessorKey: 'createdAt',
      size: 168,
      header: 'Dibuat',
      // Dulu `new Date(iso).toLocaleDateString()` TANPA locale — di layar
      // berbahasa Indonesia itu mencetak `5/1/2026`, urutan bulan-hari Amerika
      // yang terbaca "5 Januari" oleh pembacanya. `formatShortDate` memakai
      // `id-ID` seperti seluruh tanggal lain di back office ini: `1 Mei 2026`.
      enableSorting: true,
      cell: ({ row }) => (
        <TableCellText
          value={formatShortDate(row.original.createdAt)}
          className="text-xs text-muted-foreground"
        />
      ),
    },
    ...(canManage
      ? [
          {
            id: 'actions',
            size: 96,
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
                    aria-label={`Ubah ${row.original.name}`}
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
                        ? 'Akun sendiri tidak bisa dinonaktifkan'
                        : `Nonaktifkan ${row.original.name}`
                    }
                    disabled={isSelf || !row.original.isActive}
                    title={
                      isSelf
                        ? 'Akun sendiri tidak bisa dinonaktifkan'
                        : !row.original.isActive
                          ? 'Sudah nonaktif'
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
      title="Belum ada staf"
      description={
        canManage
          ? 'Tambahkan operator back-office pertama untuk mulai.'
          : 'Belum ada yang bisa ditampilkan.'
      }
      cta={
        canManage ? (
          <Button onClick={openAdd} className="mt-2">
            <Plus className="mr-1.5 h-4 w-4" />
            Tambah Staf
          </Button>
        ) : undefined
      }
    />
  )

  const totalLoaded = list.data?.metadata?.total ?? allStaff.length

  return (
    <div>
      <PageHeader
        title="Staf & Peran"
        subtitle={`${
          list.isLoading ? '…' : totalLoaded
        } operator back-office terdaftar`}
        actions={
          canManage ? (
            <Button onClick={openAdd} size="sm">
              <Plus className="mr-1.5 h-4 w-4" />
              Tambah Staf
            </Button>
          ) : undefined
        }
      />

      <DataTable
        columns={columns}
        data={pageRows}
        rowCount={totalFiltered}
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
              placeholder: 'Cari nama atau email',
              onChange: (next) => params.updateParams({ search: next || null, page: '1' }),
            }}
            sort={{
              columns: STAFF_SORT_COLUMNS,
              sortBy,
              sortOrder: (sortOrder ?? '') as 'asc' | 'desc' | '',
              onChange: (nextBy, nextOrder) =>
                params.updateParams({
                  sortBy: nextBy || null,
                  sortOrder: nextOrder || null,
                  page: '1',
                }),
            }}
            filter={{
              defs: STAFF_FILTER_DEFS,
              values: filterValues,
              onChange: (next) =>
                params.updateParams({
                  role: next.role || null,
                  active: next.active || null,
                  page: '1',
                }),
            }}
            columns={{
              items: STAFF_COLUMN_CONFIG,
              visibility: colVisibility,
              onChange: setColVisibility,
            }}
          />
        }
        hasFilters={Boolean(search || role || activeFilter)}
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
