import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import TableEmptyState from '@/components/TableEmptyState'
import TableErrorState from '@/components/TableErrorState'
import { formatDate } from '@/lib/format'
import {
  formatAmountDecimal,
  formatOccurredAt,
  isNegativeAmount,
} from '@/lib/transparency'
import type { ReserveLedgerPage } from '@/lib/types'

interface Props {
  data: ReserveLedgerPage | undefined
  isLoading: boolean
  isError: boolean
  onRetry: () => void
  page: number
  onPageChange: (page: number) => void
}

const COLUMNS = [
  'Event date',
  'Type',
  'Amount',
  'Reason',
  'Recorded by',
  'Recorded at',
]

/**
 * The full ledger history, server-paginated.
 *
 * Deliberately shows no edit or delete affordance: the contract's ledger is
 * append-only, so offering either would promise something the API cannot do.
 */
export default function LedgerHistoryTable({
  data,
  isLoading,
  isError,
  onRetry,
  page,
  onPageChange,
}: Props) {
  const entries = data?.entries ?? []
  const total = data?.total ?? 0
  const take = data?.take ?? entries.length
  const lastPage = take > 0 ? Math.max(1, Math.ceil(total / take)) : 1
  const firstRow = total === 0 ? 0 : (page - 1) * take + 1
  // Counted from the rows actually returned, not from `page * take` — a short
  // final page would otherwise claim to be showing entries it does not have.
  const lastRow = total === 0 ? 0 : (page - 1) * take + entries.length

  return (
    <Card className="rounded-md shadow-none dark:border-0">
      <CardHeader>
        <CardTitle className="text-[15px] font-semibold tracking-tight">
          Ledger history
        </CardTitle>
      </CardHeader>

      <CardContent className="px-0 pb-0">
        {isError ? (
          <TableErrorState
            title="Couldn't load the reserve ledger"
            description="The transparency service did not respond. Nothing was changed."
            onRetry={onRetry}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table aria-label="Reserve ledger entries">
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  {COLUMNS.map((header) => (
                    <TableHead
                      key={header}
                      className="h-9 px-4 font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground/80"
                    >
                      {header}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i} className="border-border hover:bg-transparent">
                      {COLUMNS.map((col) => (
                        <TableCell key={col} className="px-4 py-2.5">
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : entries.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={COLUMNS.length} className="p-0">
                      <TableEmptyState
                        mode="no-data"
                        title="No ledger entries yet"
                        description="Record the first entry to publish a reserve figure on usdx.co.id."
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  entries.map((entry) => {
                    const negative = isNegativeAmount(entry.amount)
                    return (
                      <TableRow
                        key={entry.id}
                        className="border-border hover:bg-muted/40"
                      >
                        <TableCell className="whitespace-nowrap px-4 py-2.5 font-mono text-[13px]">
                          {formatOccurredAt(entry.occurredAt)}
                        </TableCell>
                        <TableCell className="px-4 py-2.5">
                          <Badge
                            variant="outline"
                            className="font-mono text-[11px] font-medium"
                          >
                            {entry.entryType}
                          </Badge>
                        </TableCell>
                        <TableCell
                          className={`whitespace-nowrap px-4 py-2.5 text-right font-mono text-[13px] font-medium ${
                            negative ? 'text-destructive' : 'text-foreground'
                          }`}
                        >
                          {formatAmountDecimal(entry.amount)} {entry.currency}
                        </TableCell>
                        {/* `reason` is internal only — it is deliberately absent
                            from the public payload, and this table is the only
                            place it is shown. */}
                        <TableCell className="max-w-[320px] px-4 py-2.5 text-[13px] text-muted-foreground">
                          {entry.reason}
                        </TableCell>
                        <TableCell className="whitespace-nowrap px-4 py-2.5 text-[13px]">
                          {entry.createdByName}
                        </TableCell>
                        <TableCell className="whitespace-nowrap px-4 py-2.5 text-[13px] text-muted-foreground">
                          {formatDate(entry.createdAt)}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {!isError && total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {`Showing ${firstRow}–${lastRow} of ${total} entries`}
          </p>
          <div className="flex items-center gap-2">
            {/* Named explicitly: the attestation table below has its own
                Previous/Next, and "Next" alone is ambiguous to a screen reader
                landing anywhere on this page. */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label="Previous page of ledger entries"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1 || isLoading}
            >
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {page} of {lastPage}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label="Next page of ledger entries"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= lastPage || isLoading}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}
