import { type ReactNode } from 'react'
import { AlertCircle } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import TableEmptyState from '@/components/TableEmptyState'
import { cn } from '@/lib/utils'

export interface ReportColumn<T> {
  key: string
  header: string
  render: (row: T) => ReactNode
  align?: 'left' | 'right'
}

interface Props<T> {
  columns: ReportColumn<T>[]
  rows: T[]
  isFetching: boolean
  isError: boolean
}

export default function ReportTable<T>({ columns, rows, isFetching, isError }: Props<T>) {
  if (isError) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-error">
        <AlertCircle className="h-4 w-4" />
        Unable to load report. Please try again.
      </div>
    )
  }

  return (
    <div className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent border-border">
            {columns.map((col) => (
              <TableHead
                key={col.key}
                className={cn(
                  'h-9 px-4 font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground/80',
                  col.align === 'right' && 'text-right'
                )}
              >
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {isFetching ? (
            Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={i} className="hover:bg-transparent border-border">
                {columns.map((col) => (
                  <TableCell key={col.key} className="px-4 py-2.5">
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : rows.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={columns.length} className="p-0">
                <TableEmptyState
                  mode="no-data"
                  title="No data for the selected range"
                  description="Try widening the date range or clearing filters."
                />
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row, i) => (
              <TableRow key={i} className="border-border hover:bg-muted/40">
                {columns.map((col) => (
                  <TableCell
                    key={col.key}
                    className={cn('px-4 py-2.5 text-[13px]', col.align === 'right' && 'text-right')}
                  >
                    {col.render(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
