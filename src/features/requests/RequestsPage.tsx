import { useSearchParams } from 'react-router'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useRequestList } from './hooks'
import type { RequestStatus, RequestType } from '@/lib/types'

const TYPE_OPTIONS: { value: RequestType | 'all'; label: string }[] = [
  { value: 'all', label: 'All types' },
  { value: 'mint', label: 'Mint' },
  { value: 'burn', label: 'Burn' },
]

const STATUS_OPTIONS: { value: RequestStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'PENDING_APPROVAL', label: 'Pending approval' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'EXECUTED', label: 'Executed' },
  { value: 'IDR_TRANSFERRED', label: 'IDR transferred' },
  { value: 'REJECTED', label: 'Rejected' },
]

const PAGE_SIZE = 10

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString()
}

function shortAddr(addr: string): string {
  if (addr.length <= 12) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export default function RequestsPage() {
  const [params, setParams] = useSearchParams()
  const typeParam = params.get('type') ?? 'all'
  const statusParam = params.get('status') ?? 'all'
  const pageParam = Math.max(1, Number(params.get('page') ?? '1') || 1)

  const filters = {
    type: typeParam === 'all' ? undefined : (typeParam as RequestType),
    status: statusParam === 'all' ? undefined : (statusParam as RequestStatus),
    page: pageParam,
    limit: PAGE_SIZE,
  }

  const { data, isLoading, isError, error } = useRequestList(filters)
  const rows = data?.data ?? []
  const total = data?.metadata?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const hasFilters = !!filters.type || !!filters.status

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value && value !== 'all') next.set(key, value)
    else next.delete(key)
    next.delete('page')
    setParams(next, { replace: true })
  }

  function setPage(n: number) {
    const next = new URLSearchParams(params)
    if (n <= 1) next.delete('page')
    else next.set('page', String(n))
    setParams(next, { replace: true })
  }

  function clearFilters() {
    setParams(new URLSearchParams(), { replace: true })
  }

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-[20px] font-semibold tracking-tight">Requests</h1>
        <p className="text-[13px] text-muted-foreground">
          All mint and burn requests submitted to the backoffice.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <div className="w-[180px]">
          <Select
            value={typeParam}
            onValueChange={(v) => setParam('type', v)}
          >
            <SelectTrigger aria-label="Filter by type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-[200px]">
          <Select
            value={statusParam}
            onValueChange={(v) => setParam('status', v)}
          >
            <SelectTrigger aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            aria-label="Clear filters"
          >
            Clear filters
          </Button>
        )}
      </div>

      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Amount (USDX)</TableHead>
              <TableHead>Amount (IDR)</TableHead>
              <TableHead>Chain</TableHead>
              <TableHead>Safe</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={`s-${i}`}>
                  {Array.from({ length: 9 }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-destructive">
                  {error instanceof Error ? error.message : 'Failed to load requests'}
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="text-center text-muted-foreground"
                >
                  {hasFilters
                    ? 'No requests match the current filters.'
                    : 'No requests yet.'}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="capitalize">{r.type}</TableCell>
                  <TableCell>{r.userName}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {shortAddr(r.userAddress)}
                  </TableCell>
                  <TableCell className="tabular-nums">{r.amount}</TableCell>
                  <TableCell className="tabular-nums">{r.amountIdr}</TableCell>
                  <TableCell>{r.chain}</TableCell>
                  <TableCell>{r.safeType}</TableCell>
                  <TableCell>{r.status}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(r.createdAt)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {!isLoading && !isError && total > 0 && (
        <div className="flex items-center justify-between text-[12.5px] text-muted-foreground">
          <span>
            Page {pageParam} of {totalPages} · {total} total
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(pageParam - 1)}
              disabled={pageParam <= 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(pageParam + 1)}
              disabled={pageParam >= totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
