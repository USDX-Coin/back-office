import { useSearchParams } from 'react-router'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useStaff } from './hooks'

const PAGE_SIZE = 10

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
  const [params, setParams] = useSearchParams()
  const pageParam = Math.max(1, Number(params.get('page') ?? '1') || 1)

  const { data, isLoading, isError, error } = useStaff({
    page: pageParam,
    limit: PAGE_SIZE,
  })
  const rows = data?.data ?? []
  const total = data?.metadata?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  function setPage(n: number) {
    const next = new URLSearchParams(params)
    if (n <= 1) next.delete('page')
    else next.set('page', String(n))
    setParams(next, { replace: true })
  }

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-[20px] font-semibold tracking-tight">Staff</h1>
        <p className="text-[13px] text-muted-foreground">
          Internal back-office operators.
        </p>
      </header>

      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Active</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={`s-${i}`}>
                  {Array.from({ length: 5 }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-destructive">
                  {error instanceof Error ? error.message : 'Failed to load staff'}
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No staff yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="text-muted-foreground">{s.email}</TableCell>
                  <TableCell>{formatRole(s.role)}</TableCell>
                  <TableCell>{s.isActive ? 'Yes' : 'No'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(s.createdAt)}
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
