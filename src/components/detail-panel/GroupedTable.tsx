import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import TableErrorState from '@/components/TableErrorState'
import { cn } from '@/lib/utils'

export interface GroupedColumn<T> {
  id: string
  header: string
  cell: (row: T) => ReactNode
  align?: 'left' | 'right'
  /** Kelas tambahan untuk <th> dan <td> (mis. `hidden md:table-cell`). */
  className?: string
}

export interface RowGroup<T> {
  key: string
  /** Judul baris kelompok, mis. "Perlu tindakan". Angkanya ditambahkan otomatis. */
  label: string
  rows: T[]
  /** Total sesungguhnya kalau lebih besar dari `rows.length` (data berhalaman). */
  total?: number
  /** Kelompok "perlu tindakan" diberi warna maroon. */
  emphasis?: boolean
  isLoading?: boolean
  isError?: boolean
  onRetry?: () => void
  /** Kalimat saat kelompok ini kosong. Kosong + tanpa kalimat = baris kelompoknya tidak dirender. */
  emptyText?: string
  /** Kalimat tambahan di bawah baris kelompok (mis. "100 terlama ditampilkan"). */
  note?: ReactNode
  pagination?: { page: number; pageCount: number; onPage: (p: number) => void }
}

interface GroupedTableProps<T> {
  columns: GroupedColumn<T>[]
  groups: RowGroup<T>[]
  rowKey: (row: T) => string
  rowLabel: (row: T) => string
  selectedKey?: string | null
  onSelect: (row: T) => void
  minWidth?: number
}

/**
 * Satu tabel, beberapa kelompok baris — pola "Perlu tindakan di atas, sisanya
 * di bawah" dari contoh yang disetujui PM. Baris bisa diklik dan dipilih
 * dengan papan ketik (Enter/Spasi); baris terpilih ditandai garis maroon di
 * kiri + isian lembut, bukan warna saja (`aria-current`).
 */
export default function GroupedTable<T>({
  columns,
  groups,
  rowKey,
  rowLabel,
  selectedKey,
  onSelect,
  minWidth = 640,
}: GroupedTableProps<T>) {
  const colSpan = columns.length
  return (
    <div className="overflow-hidden rounded-md border border-border bg-card">
      <Table minWidth={minWidth}>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {columns.map((c) => (
              <TableHead
                key={c.id}
                className={cn(
                  'h-9 whitespace-nowrap bg-muted/60 px-3.5 text-xs font-semibold text-muted-foreground',
                  c.align === 'right' && 'text-right',
                  c.className
                )}
              >
                {c.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        {groups.map((g) => {
          const empty = !g.isLoading && !g.isError && g.rows.length === 0
          if (empty && !g.emptyText) return null
          const count = g.total ?? g.rows.length
          return (
            <TableBody key={g.key} data-group={g.key}>
              <TableRow className="hover:bg-transparent" data-group-row="">
                <TableCell
                  colSpan={colSpan}
                  className={cn(
                    'bg-card px-3.5 pb-1.5 pt-4 text-xs font-semibold',
                    g.emphasis ? 'text-primary' : 'text-muted-foreground'
                  )}
                >
                  {g.label}
                  {!g.isLoading && !g.isError && <span className="tabular-nums"> · {count}</span>}
                  {g.note && <span className="ml-2 font-normal text-muted-foreground">{g.note}</span>}
                </TableCell>
              </TableRow>
              {g.isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={`sk-${i}`} className="h-baris-tabel">
                    <TableCell colSpan={colSpan} className="px-3.5">
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : g.isError ? (
                <TableRow>
                  <TableCell colSpan={colSpan}>
                    <TableErrorState onRetry={g.onRetry} />
                  </TableCell>
                </TableRow>
              ) : empty ? (
                <TableRow>
                  <TableCell colSpan={colSpan} className="px-3.5 py-6 text-center text-sm text-muted-foreground">
                    {g.emptyText}
                  </TableCell>
                </TableRow>
              ) : (
                g.rows.map((row) => {
                  const k = rowKey(row)
                  const selected = selectedKey === k
                  return (
                    <TableRow
                      key={k}
                      data-hoverable=""
                      role="button"
                      tabIndex={0}
                      aria-label={rowLabel(row)}
                      aria-current={selected ? 'true' : undefined}
                      onClick={() => onSelect(row)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          onSelect(row)
                        }
                      }}
                      className={cn(
                        'h-baris-tabel cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                        selected && '!bg-primary/10 shadow-[inset_3px_0_0_hsl(var(--primary))]'
                      )}
                    >
                      {columns.map((c) => (
                        <TableCell
                          key={c.id}
                          data-col={c.id}
                          className={cn('px-3.5 text-sm', c.align === 'right' && 'text-right', c.className)}
                        >
                          {c.cell(row)}
                        </TableCell>
                      ))}
                    </TableRow>
                  )
                })
              )}
              {g.pagination && g.pagination.pageCount > 1 && !g.isLoading && !g.isError && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={colSpan} className="px-3.5 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        disabled={g.pagination.page <= 1}
                        onClick={() => g.pagination!.onPage(g.pagination!.page - 1)}
                        aria-label="Halaman sebelumnya"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </Button>
                      <span className="px-2 text-xs tabular-nums text-muted-foreground">
                        Halaman {g.pagination.page} dari {g.pagination.pageCount}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        disabled={g.pagination.page >= g.pagination.pageCount}
                        onClick={() => g.pagination!.onPage(g.pagination!.page + 1)}
                        aria-label="Halaman berikutnya"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          )
        })}
      </Table>
    </div>
  )
}
