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
import { cn } from '@/lib/utils'

export interface DataTableProps<T> {
  columns: ColumnDef<T, unknown>[]
  data: T[]
  rowCount: number
  isLoading?: boolean
  statusOptions?: { value: string; label: string }[]
  onExportCsv?: () => void
  pageSize?: number
  filterToolbar?: ReactNode
  emptyState?: ReactNode
  hasFilters?: boolean
}

export default function DataTable<T>({
  columns,
  data,
  rowCount,
  isLoading = false,
  statusOptions,
  onExportCsv,
  pageSize: defaultPageSize = 10,
  filterToolbar,
  emptyState,
  hasFilters: hasFiltersProp,
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
    state: { pagination, sorting },
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
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
  })

  const totalPages = Math.ceil(rowCount / defaultPageSize) || 1

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

      <div className="overflow-hidden rounded-md bg-card">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent border-border">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="h-9 px-4 font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground/80"
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
                <TableRow key={i} className="hover:bg-transparent border-border">
                  {columns.map((_, j) => (
                    <TableCell key={j} className="px-4 py-2.5">
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columns.length} className="p-0">
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
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className="border-border hover:bg-muted/40">
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="px-4 py-2.5 text-[12.5px]">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <p className="font-mono text-[11.5px] text-muted-foreground tabular-nums">
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
          <span className="px-2 font-mono text-[11.5px] tabular-nums text-muted-foreground">
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
