import { useState, type ReactNode } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type PaginationState,
  type SortingState,
} from '@tanstack/react-table'
import { useSearchParams } from 'react-router'
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  Download,
  X,
} from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableColgroup,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import TableEmptyState from '@/components/TableEmptyState'
import TableErrorState from '@/components/TableErrorState'
import { cn } from '@/lib/utils'

export interface DataTableProps<T> {
  columns: ColumnDef<T, unknown>[]
  data: T[]
  rowCount: number
  isLoading?: boolean
  /** Query failed — renders an error row (with optional retry) instead of an empty state. */
  isError?: boolean
  /** Retry action shown in the error state, typically `query.refetch`. */
  onRetry?: () => void
  statusOptions?: { value: string; label: string }[]
  onExportCsv?: () => void
  pageSize?: number
  filterToolbar?: ReactNode
  emptyState?: ReactNode
  hasFilters?: boolean
  onRowClick?: (row: T) => void
  rowAriaLabel?: (row: T) => string
  // USDX-87: optional per-row className hook for transient visual states
  // (e.g. deep-link highlight from Manual Sync `?highlight=<id>`). Stays
  // generic so other features can reuse it.
  rowClassName?: (row: T) => string | undefined
  // USDX-27 (Columns popover): controlled column-visibility state. Pages own
  // it via useColumnVisibility and pass it to both the toolbar and the table.
  columnVisibility?: import('@tanstack/react-table').VisibilityState
  onColumnVisibilityChange?: (next: import('@tanstack/react-table').VisibilityState) => void
  // USDX-631: stable row identity for client-paginated data whose rows have
  // no unique field (BNI statement rows repeat `journalNo`). Defaults to the
  // TanStack index id when omitted, so existing tables are unaffected.
  getRowId?: (row: T, index: number) => string
}

export default function DataTable<T>({
  columns,
  data,
  rowCount,
  isLoading = false,
  isError = false,
  onRetry,
  statusOptions,
  onExportCsv,
  pageSize: defaultPageSize = 10,
  filterToolbar,
  emptyState,
  hasFilters: hasFiltersProp,
  onRowClick,
  rowAriaLabel,
  rowClassName,
  columnVisibility,
  onColumnVisibilityChange,
  getRowId,
}: DataTableProps<T>) {
  const [searchParams, setSearchParams] = useSearchParams()

  const page = Number(searchParams.get('page') || '1')
  const search = searchParams.get('search') || ''
  const status = searchParams.get('status') || ''
  const sortBy = searchParams.get('sortBy') || ''
  const sortOrder = searchParams.get('sortOrder') || 'desc'
  const startDate = searchParams.get('startDate') || ''
  const endDate = searchParams.get('endDate') || ''

  const [searchInput, setSearchInput] = useState(search)

  const pagination: PaginationState = {
    pageIndex: page - 1,
    pageSize: defaultPageSize,
  }

  const sorting: SortingState = sortBy
    ? [{ id: sortBy, desc: sortOrder === 'desc' }]
    : []

  function updateParams(updates: Record<string, string | null>) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      Object.entries(updates).forEach(([key, value]) => {
        if (value) next.set(key, value)
        else next.delete(key)
      })
      return next
    })
  }

  const table = useReactTable({
    data,
    columns,
    rowCount,
    state: { pagination, sorting, columnVisibility: columnVisibility ?? {} },
    onColumnVisibilityChange: (updater) => {
      if (!onColumnVisibilityChange) return
      const next = typeof updater === 'function' ? updater(columnVisibility ?? {}) : updater
      onColumnVisibilityChange(next)
    },
    onPaginationChange: (updater) => {
      const next = typeof updater === 'function' ? updater(pagination) : updater
      updateParams({ page: String(next.pageIndex + 1) })
    },
    onSortingChange: (updater) => {
      const next = typeof updater === 'function' ? updater(sorting) : updater
      if (next.length > 0) {
        updateParams({
          sortBy: next[0].id,
          sortOrder: next[0].desc ? 'desc' : 'asc',
          page: '1',
        })
      } else {
        updateParams({ sortBy: null, sortOrder: null, page: '1' })
      }
    },
    // USDX — lebar kolom. TanStack sudah menyimpan `size`/`minSize` per kolom
    // sejak awal; yang hilang adalah JALUR KELUARNYA ke DOM. Angka bawaan
    // TanStack (150px) dipakai apa adanya oleh tabel 11 kolom dan langsung
    // memaksa gulir 1650px, jadi diturunkan ke 132 — kolom yang butuh lebih
    // menyebut `size` sendiri di ColumnDef-nya.
    defaultColumn: { size: 120, minSize: 80 },
    getCoreRowModel: getCoreRowModel(),
    getRowId,
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
  })

  const totalPages = Math.ceil(rowCount / defaultPageSize) || 1

  // ── Lebar kolom, akhirnya sampai ke DOM ─────────────────────────────────
  //
  // Sebelumnya tidak ada satu pun dari ini: nol `getSize()`, nol `<colgroup>`,
  // dan `<table className="w-full">` tanpa lebar minimum. Jadi definisi `size`
  // di ColumnDef tidak berpengaruh apa pun, dan peramban bebas memeras kolom
  // sampai muat.
  //
  // Dua mode, dan bedanya sengaja:
  //
  // Tata letaknya `fixed`, selalu. Tata letak otomatis terbukti memilih MELIPAT
  // isi daripada menggulir begitu isinya lebih lebar dari wadahnya: baris Mint
  // membengkak jadi ~80px dengan nama, id pesanan, dan hash masing-masing patah
  // dua baris. Lebar yang mengikat memindahkan keputusan itu ke tempat yang
  // benar — sel yang tidak muat DIPOTONG elipsis (nilai utuh di tooltip), dan
  // tabel yang tidak muat MENGGULIR.
  //
  // Kolom yang tidak menyebut `size` memakai angka bawaan dan berbagi lebar
  // sama rata. Itu keadaan sementara, bukan tujuan: sekarang `size` akhirnya
  // berpengaruh, halaman bisa menyebutkan lebarnya satu per satu.
  const kolomTerlihat = table.getVisibleLeafColumns()
  const lebarKolom = kolomTerlihat.map((c) => c.getSize())
  const lebarBaris = lebarKolom.reduce((a, b) => a + b, 0)

  // Kisi kolom hanya dipasang saat ADA baris untuk dilindungi. Keadaan kosong
  // dan keadaan galat merender satu sel `colSpan` berisi kalimat utuh: dengan
  // lebar minimum terpasang, sel itu ikut selebar tabel dan kalimatnya terpotong
  // di tepi kartu — memperbaiki tabel berisi data dengan merusak tabel kosong.
  const adaBaris = isLoading || (!isError && table.getRowModel().rows.length > 0)
  const lebarMinimum = adaBaris ? lebarBaris : undefined

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    updateParams({ search: searchInput || null, page: '1' })
  }

  function clearFilters() {
    setSearchInput('')
    setSearchParams(new URLSearchParams())
  }

  const derivedHasFilters = Boolean(search || status || startDate || endDate)
  const hasFilters = hasFiltersProp ?? derivedHasFilters

  return (
    <div className="space-y-4">
      {filterToolbar ? (
        <div>{filterToolbar}</div>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
            <form onSubmit={handleSearch} className="relative flex-1 max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9"
              />
            </form>

            {statusOptions && (
              <Select
                value={status}
                onValueChange={(val) => updateParams({ status: val === 'all' ? null : val, page: '1' })}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {statusOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <div className="flex gap-2">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => updateParams({ startDate: e.target.value || null, page: '1' })}
                className="w-[150px]"
                aria-label="Start date"
              />
              <Input
                type="date"
                value={endDate}
                onChange={(e) => updateParams({ endDate: e.target.value || null, page: '1' })}
                className="w-[150px]"
                aria-label="End date"
              />
            </div>

            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="mr-1 h-4 w-4" />
                Clear
              </Button>
            )}
          </div>

          {onExportCsv && (
            <Button variant="outline" size="sm" onClick={onExportCsv}>
              <Download className="mr-1 h-4 w-4" />
              Export CSV
            </Button>
          )}
        </div>
      )}

      <div className="relative overflow-hidden rounded-md bg-card">
        <Table fixedLayout={adaBaris} minWidth={lebarMinimum}>
          {adaBaris && <TableColgroup widths={lebarKolom} />}
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    // Kepala kolom: huruf biasa, bukan mono KAPITAL berenggang.
                    // Gayanya diwarisi dari TableHead supaya semua tabel sama.
                    className="px-3"
                  >
                    {header.isPlaceholder ? null : (
                      <div
                        className={cn(
                          'flex items-center gap-1.5',
                          header.column.getCanSort() && 'cursor-pointer select-none'
                        )}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() && (
                          <>
                            {header.column.getIsSorted() === 'asc' ? (
                              <ArrowUp className="h-3 w-3" />
                            ) : header.column.getIsSorted() === 'desc' ? (
                              <ArrowDown className="h-3 w-3" />
                            ) : (
                              <ArrowUpDown className="h-3 w-3 opacity-40" />
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: defaultPageSize }).map((_, i) => (
                <TableRow key={i} className="h-baris-tabel">
                  {columns.map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={kolomTerlihat.length} className="p-0">
                  <TableErrorState onRetry={onRetry} />
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={kolomTerlihat.length} className="p-0">
                  {hasFilters ? (
                    <TableEmptyState mode="no-results" onClearFilters={clearFilters} />
                  ) : emptyState ? (
                    emptyState
                  ) : (
                    <TableEmptyState mode="no-data" />
                  )}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => {
                const clickable = Boolean(onRowClick)
                return (
                  <TableRow
                    key={row.id}
                    className={cn(
                      'h-baris-tabel animate-baris-masuk',
                      clickable &&
                        'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/55',
                      rowClassName?.(row.original)
                    )}
                    // Dibaca oleh aturan sorotan di index.css. Hanya baris DATA
                    // yang menyala — baris skeleton, galat, dan keadaan kosong
                    // tidak menunjuk ke apa pun, jadi tidak ikut menyala.
                    data-hoverable=""
                    role={clickable ? 'button' : undefined}
                    tabIndex={clickable ? 0 : undefined}
                    aria-label={
                      clickable && rowAriaLabel
                        ? rowAriaLabel(row.original)
                        : undefined
                    }
                    onClick={
                      clickable ? () => onRowClick!(row.original) : undefined
                    }
                    onKeyDown={
                      clickable
                        ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              onRowClick!(row.original)
                            }
                          }
                        : undefined
                    }
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="text-sm">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <p className="font-mono text-2xs text-muted-foreground tabular-nums">
          {data.length > 0 ? (page - 1) * defaultPageSize + 1 : 0}–
          {Math.min(page * defaultPageSize, rowCount)} of {rowCount}
        </p>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
            aria-label="First page"
          >
            <ChevronsLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="px-2 font-mono text-2xs tabular-nums text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            aria-label="Next page"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => table.setPageIndex(totalPages - 1)}
            disabled={!table.getCanNextPage()}
            aria-label="Last page"
          >
            <ChevronsRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
