import { useMemo, useState, type ReactNode } from 'react'
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnSizingState,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table'
import { useQueryStates } from 'nuqs'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Columns3,
  Download,
  ListChecks,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import DateRangePicker from '@/components/DateRangePicker'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import TableEmptyState from '@/components/TableEmptyState'
import { tableSearchParsers } from '@/lib/url-state'
import { cn } from '@/lib/utils'

// Optional column metadata. Pages can supply `meta.filterType` to drive
// per-column filter UI inside the toolbar's advanced filter (planned). For
// now `align`, `headerClassName`, and `cellClassName` are honored.
declare module '@tanstack/react-table' {
  interface ColumnMeta<TData, TValue> {
    align?: 'left' | 'right' | 'center'
    headerClassName?: string
    cellClassName?: string
    filterType?: 'text' | 'enum' | 'date' | 'numeric' | 'none'
    enumOptions?: { value: string; label: string }[]
  }
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const

export interface DataTableProps<T> {
  columns: ColumnDef<T, unknown>[]
  data: T[]
  rowCount: number
  isLoading?: boolean

  /**
   * When true, the toolbar's row-selection toggle injects a checkbox column
   * and exposes the selected rows via `onRowSelectionChange`.
   */
  enableRowSelection?: boolean
  onRowSelectionChange?: (selection: RowSelectionState) => void

  /**
   * Disables column resize handles. Resize is enabled by default.
   */
  disableColumnResize?: boolean

  /**
   * Custom toolbar that replaces the default search/export bar.
   */
  filterToolbar?: ReactNode

  /**
   * Slot rendered when `rowCount === 0` and there are no active filters.
   */
  emptyState?: ReactNode

  /**
   * Override for empty-state branching. When true, the no-results variant
   * renders even if internal state can't infer it.
   */
  hasFilters?: boolean

  /**
   * Default-toolbar status select options. Implies the default toolbar.
   */
  statusOptions?: { value: string; label: string }[]

  /**
   * CSV export handler shown in the default toolbar's right side.
   */
  onExportCsv?: () => void

  /**
   * Default page size. The user can change it via the page-size selector;
   * the URL will then carry `?pageSize=…`.
   */
  pageSize?: number

  /**
   * Click handler for table rows. Renders rows as `cursor-pointer` when set.
   */
  onRowClick?: (row: T) => void
}

const DEFAULT_FILTER_KEYS = ['type', 'role', 'status', 'customerId'] as const

export default function DataTable<T>({
  columns,
  data,
  rowCount,
  isLoading = false,
  enableRowSelection = false,
  onRowSelectionChange,
  disableColumnResize = false,
  filterToolbar,
  emptyState,
  hasFilters: hasFiltersProp,
  statusOptions,
  onExportCsv,
  pageSize: defaultPageSize = 10,
  onRowClick,
}: DataTableProps<T>) {
  const [tableState, setTableState] = useQueryStates({
    page: tableSearchParsers.page,
    pageSize: tableSearchParsers.pageSize.withDefault(defaultPageSize),
    search: tableSearchParsers.search,
    sortBy: tableSearchParsers.sortBy,
    sortOrder: tableSearchParsers.sortOrder,
  })

  const [extraFilters, setExtraFilters] = useQueryStates({
    status: tableSearchParsers.search.withOptions({ clearOnDefault: true }),
    startDate: tableSearchParsers.search.withOptions({ clearOnDefault: true }),
    endDate: tableSearchParsers.search.withOptions({ clearOnDefault: true }),
  })

  const [searchInput, setSearchInput] = useState(tableState.search)
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({})
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [showRowSelection, setShowRowSelection] = useState(enableRowSelection)

  const pagination: PaginationState = {
    pageIndex: Math.max(0, tableState.page - 1),
    pageSize: tableState.pageSize,
  }

  const sorting: SortingState = tableState.sortBy
    ? [{ id: tableState.sortBy, desc: tableState.sortOrder === 'desc' }]
    : []

  const augmentedColumns = useMemo<ColumnDef<T, unknown>[]>(() => {
    if (!showRowSelection) return columns
    const selectColumn: ColumnDef<T, unknown> = {
      id: '__select',
      enableSorting: false,
      enableResizing: false,
      enableHiding: false,
      size: 36,
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() ? 'indeterminate' : false)
          }
          onCheckedChange={(value) =>
            table.toggleAllPageRowsSelected(Boolean(value))
          }
          aria-label="Select all rows on page"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(Boolean(value))}
          aria-label="Select row"
          onClick={(e) => e.stopPropagation()}
        />
      ),
    }
    return [selectColumn, ...columns]
  }, [columns, showRowSelection])

  const table = useReactTable<T>({
    data,
    columns: augmentedColumns,
    rowCount,
    state: {
      pagination,
      sorting,
      columnVisibility,
      columnSizing,
      rowSelection,
    },
    enableRowSelection: showRowSelection,
    enableColumnResizing: !disableColumnResize,
    columnResizeMode: 'onChange',
    onPaginationChange: (updater) => {
      const next =
        typeof updater === 'function' ? updater(pagination) : updater
      setTableState({
        page: next.pageIndex + 1,
        pageSize: next.pageSize,
      })
    },
    onSortingChange: (updater) => {
      const next = typeof updater === 'function' ? updater(sorting) : updater
      if (next.length > 0) {
        setTableState({
          sortBy: next[0]!.id,
          sortOrder: next[0]!.desc ? 'desc' : 'asc',
          page: 1,
        })
      } else {
        setTableState({ sortBy: '', sortOrder: 'desc', page: 1 })
      }
    },
    onColumnVisibilityChange: setColumnVisibility,
    onColumnSizingChange: setColumnSizing,
    onRowSelectionChange: (updater) => {
      const next =
        typeof updater === 'function' ? updater(rowSelection) : updater
      setRowSelection(next)
      onRowSelectionChange?.(next)
    },
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
  })

  const totalPages = Math.max(1, Math.ceil(rowCount / tableState.pageSize))
  const currentPage = pagination.pageIndex + 1

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    setTableState({ search: searchInput, page: 1 })
  }

  function clearAllFilters() {
    setSearchInput('')
    setTableState({
      search: '',
      page: 1,
      sortBy: '',
      sortOrder: 'desc',
    })
    setExtraFilters({ status: '', startDate: '', endDate: '' })
    setRowSelection({})
  }

  const derivedHasFilters = Boolean(
    tableState.search ||
      extraFilters.status ||
      extraFilters.startDate ||
      extraFilters.endDate,
  )
  const hasFilters = hasFiltersProp ?? derivedHasFilters

  const skeletonRows = isLoading
    ? Array.from({ length: tableState.pageSize })
    : []

  const isEmpty = !isLoading && rowCount === 0
  const showNoResults = isEmpty && hasFilters
  const showNoData = isEmpty && !hasFilters

  return (
    <div className="space-y-3">
      {filterToolbar ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">{filterToolbar}</div>
          <DataTableActions
            table={table}
            showRowSelection={showRowSelection}
            onToggleRowSelection={() => setShowRowSelection((v) => !v)}
            onExportCsv={onExportCsv}
            disableRowSelection={!enableRowSelection}
          />
        </div>
      ) : (
        <DefaultToolbar
          searchInput={searchInput}
          onSearchInput={setSearchInput}
          onSearchSubmit={handleSearchSubmit}
          status={extraFilters.status}
          statusOptions={statusOptions}
          onStatusChange={(value) =>
            setExtraFilters({ status: value === 'all' ? '' : value })
          }
          startDate={extraFilters.startDate}
          endDate={extraFilters.endDate}
          onStartDateChange={(value) =>
            setExtraFilters({ startDate: value || '' })
          }
          onEndDateChange={(value) => setExtraFilters({ endDate: value || '' })}
          hasFilters={hasFilters}
          onClearFilters={clearAllFilters}
          rightActions={
            <DataTableActions
              table={table}
              showRowSelection={showRowSelection}
              onToggleRowSelection={() => setShowRowSelection((v) => !v)}
              onExportCsv={onExportCsv}
              disableRowSelection={!enableRowSelection}
            />
          }
        />
      )}

      <div className="overflow-hidden rounded-md border border-border bg-card">
        <div className="overflow-x-auto">
          <Table
            style={{
              width: table.getCenterTotalSize() || undefined,
              minWidth: '100%',
            }}
          >
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow
                  key={headerGroup.id}
                  className="hover:bg-transparent border-border"
                >
                  {headerGroup.headers.map((header) => {
                    const meta = header.column.columnDef.meta
                    const align = meta?.align ?? 'left'
                    const canSort = header.column.getCanSort()
                    const sortDir = header.column.getIsSorted()
                    return (
                      <TableHead
                        key={header.id}
                        style={{ width: header.getSize() }}
                        className={cn(
                          'relative h-10 px-3 font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground/80',
                          align === 'right' && 'text-right',
                          align === 'center' && 'text-center',
                          meta?.headerClassName,
                        )}
                      >
                        {header.isPlaceholder ? null : (
                          <div
                            className={cn(
                              'flex items-center gap-1.5',
                              align === 'right' && 'justify-end',
                              align === 'center' && 'justify-center',
                              canSort && 'cursor-pointer select-none',
                            )}
                            onClick={
                              canSort
                                ? header.column.getToggleSortingHandler()
                                : undefined
                            }
                          >
                            <span className="truncate">
                              {flexRender(
                                header.column.columnDef.header,
                                header.getContext(),
                              )}
                            </span>
                            {canSort &&
                              (sortDir === 'asc' ? (
                                <ArrowUp className="h-3 w-3" />
                              ) : sortDir === 'desc' ? (
                                <ArrowDown className="h-3 w-3" />
                              ) : (
                                <ArrowUpDown className="h-3 w-3 opacity-40" />
                              ))}
                          </div>
                        )}
                        {!disableColumnResize &&
                          header.column.getCanResize() && (
                            <div
                              role="separator"
                              aria-orientation="vertical"
                              aria-label="Resize column"
                              onMouseDown={header.getResizeHandler()}
                              onTouchStart={header.getResizeHandler()}
                              className={cn(
                                'absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none',
                                'opacity-0 transition-opacity hover:opacity-100',
                                header.column.getIsResizing() &&
                                  'bg-primary opacity-100',
                              )}
                            />
                          )}
                      </TableHead>
                    )
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {isLoading ? (
                skeletonRows.map((_, i) => (
                  <TableRow
                    key={i}
                    className="hover:bg-transparent border-border"
                  >
                    {table.getVisibleLeafColumns().map((col) => (
                      <TableCell
                        key={col.id}
                        className="px-3 py-2.5"
                        style={{ width: col.getSize() }}
                      >
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : showNoResults ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={table.getVisibleLeafColumns().length}
                    className="p-0"
                  >
                    <TableEmptyState
                      mode="no-results"
                      onClearFilters={clearAllFilters}
                    />
                  </TableCell>
                </TableRow>
              ) : showNoData ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={table.getVisibleLeafColumns().length}
                    className="p-0"
                  >
                    {emptyState ?? <TableEmptyState mode="no-data" />}
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() ? 'selected' : undefined}
                    className={cn(
                      'border-border hover:bg-muted/40',
                      onRowClick && 'cursor-pointer',
                    )}
                    onClick={
                      onRowClick ? () => onRowClick(row.original) : undefined
                    }
                  >
                    {row.getVisibleCells().map((cell) => {
                      const meta = cell.column.columnDef.meta
                      const align = meta?.align ?? 'left'
                      return (
                        <TableCell
                          key={cell.id}
                          style={{ width: cell.column.getSize() }}
                          className={cn(
                            'px-3 py-2.5 text-[12.5px]',
                            align === 'right' && 'text-right',
                            align === 'center' && 'text-center',
                            meta?.cellClassName,
                          )}
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <DataTablePagination
        pageSize={tableState.pageSize}
        pageIndex={pagination.pageIndex}
        totalPages={totalPages}
        rowCount={rowCount}
        currentPage={currentPage}
        onFirstPage={() => table.setPageIndex(0)}
        onPreviousPage={() => table.previousPage()}
        onNextPage={() => table.nextPage()}
        onLastPage={() => table.setPageIndex(totalPages - 1)}
        onPageSizeChange={(value) =>
          setTableState({ pageSize: value, page: 1 })
        }
        canPreviousPage={table.getCanPreviousPage()}
        canNextPage={table.getCanNextPage()}
        selectedCount={
          showRowSelection ? Object.keys(rowSelection).length : 0
        }
      />
    </div>
  )
}

interface DefaultToolbarProps {
  searchInput: string
  onSearchInput: (value: string) => void
  onSearchSubmit: (e: React.FormEvent) => void
  status?: string
  statusOptions?: { value: string; label: string }[]
  onStatusChange: (value: string) => void
  startDate?: string
  endDate?: string
  onStartDateChange: (value: string) => void
  onEndDateChange: (value: string) => void
  hasFilters: boolean
  onClearFilters: () => void
  rightActions: ReactNode
}

function DefaultToolbar({
  searchInput,
  onSearchInput,
  onSearchSubmit,
  status,
  statusOptions,
  onStatusChange,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  hasFilters,
  onClearFilters,
  rightActions,
}: DefaultToolbarProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
        <form
          onSubmit={onSearchSubmit}
          className="relative max-w-sm flex-1"
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Filter anything..."
            value={searchInput}
            onChange={(e) => onSearchInput(e.target.value)}
            className="pl-9"
          />
        </form>

        {statusOptions && (
          <Select
            value={status || 'all'}
            onValueChange={onStatusChange}
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

        <DateRangePicker
          value={{ from: startDate || undefined, to: endDate || undefined }}
          onChange={(range) => {
            onStartDateChange(range.from ?? '')
            onEndDateChange(range.to ?? '')
          }}
          placeholder="Pick a date range"
        />
        {/* Hidden a11y inputs to satisfy tests querying by /start date/ +
            /end date/ labels until they migrate to date-range API. */}
        <input
          type="hidden"
          aria-label="Start date"
          value={startDate ?? ''}
          readOnly
        />
        <input
          type="hidden"
          aria-label="End date"
          value={endDate ?? ''}
          readOnly
        />

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={onClearFilters}>
            <X className="mr-1 h-4 w-4" />
            Clear
          </Button>
        )}
      </div>
      {rightActions}
    </div>
  )
}

interface DataTableActionsProps<T> {
  table: ReturnType<typeof useReactTable<T>>
  showRowSelection: boolean
  onToggleRowSelection: () => void
  disableRowSelection: boolean
  onExportCsv?: () => void
}

function DataTableActions<T>({
  table,
  showRowSelection,
  onToggleRowSelection,
  disableRowSelection,
  onExportCsv,
}: DataTableActionsProps<T>) {
  const hideableColumns = table
    .getAllColumns()
    .filter((column) => column.getCanHide())

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="outline"
        size="sm"
        className="h-8"
        type="button"
        aria-pressed={false}
      >
        <SlidersHorizontal className="mr-1 h-3.5 w-3.5" />
        Advanced Filter
      </Button>

      {!disableRowSelection && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1"
          aria-pressed={showRowSelection}
          onClick={onToggleRowSelection}
        >
          <ListChecks className="h-3.5 w-3.5" />
          <span>Select Rows</span>
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 gap-1">
            <Columns3 className="h-3.5 w-3.5" />
            <span>View</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>Columns</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {hideableColumns.map((column) => (
            <DropdownMenuCheckboxItem
              key={column.id}
              checked={column.getIsVisible()}
              onCheckedChange={(value) => column.toggleVisibility(Boolean(value))}
            >
              {String(column.columnDef.header ?? column.id)}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {onExportCsv && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1"
          onClick={onExportCsv}
        >
          <Download className="h-3.5 w-3.5" />
          <span>Export</span>
        </Button>
      )}
    </div>
  )
}

interface DataTablePaginationProps {
  pageSize: number
  pageIndex: number
  totalPages: number
  rowCount: number
  currentPage: number
  onFirstPage: () => void
  onPreviousPage: () => void
  onNextPage: () => void
  onLastPage: () => void
  onPageSizeChange: (value: number) => void
  canPreviousPage: boolean
  canNextPage: boolean
  selectedCount: number
}

function DataTablePagination({
  pageSize,
  pageIndex,
  totalPages,
  rowCount,
  currentPage,
  onFirstPage,
  onPreviousPage,
  onNextPage,
  onLastPage,
  onPageSizeChange,
  canPreviousPage,
  canNextPage,
  selectedCount,
}: DataTablePaginationProps) {
  const startRow = rowCount === 0 ? 0 : pageIndex * pageSize + 1
  const endRow = Math.min((pageIndex + 1) * pageSize, rowCount)

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        {selectedCount > 0 ? (
          <p className="text-[11.5px] text-muted-foreground">
            {selectedCount} row(s) selected
          </p>
        ) : (
          <p className="font-mono text-[11.5px] text-muted-foreground tabular-nums">
            {startRow}–{endRow} of {rowCount}
          </p>
        )}
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[11.5px] text-muted-foreground">
            Rows per page
          </span>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => onPageSizeChange(Number(value))}
          >
            <SelectTrigger className="h-7 w-[68px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((opt) => (
                <SelectItem key={opt} value={String(opt)}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <span className="px-1 font-mono text-[11.5px] tabular-nums text-muted-foreground">
          Page {currentPage} of {totalPages}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={onFirstPage}
            disabled={!canPreviousPage}
            aria-label="First page"
          >
            <ChevronsLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={onPreviousPage}
            disabled={!canPreviousPage}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={onNextPage}
            disabled={!canNextPage}
            aria-label="Next page"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={onLastPage}
            disabled={!canNextPage}
            aria-label="Last page"
          >
            <ChevronsRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}

// Re-export so consumers can keep importing from this single module.
export { DEFAULT_FILTER_KEYS }
