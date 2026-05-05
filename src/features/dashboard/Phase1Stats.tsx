// USDX-16 — renders the SoT /api/v1/dashboard/stats payload.
// All quantity values arrive from the API as decimal strings (USDX has 6
// on-chain decimals; the API returns the human-readable form). This view
// formats them as USDX with grouping but never coerces to Number, so we
// don't lose precision on > 2^53 values.
import { Link } from 'react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { DashboardStats } from '@/lib/types'

const REQUEST_STATUS_LABELS: Record<keyof DashboardStats['requestsByStatus'], string> = {
  PENDING_APPROVAL: 'Pending approval',
  APPROVED: 'Approved',
  EXECUTED: 'Executed',
  REJECTED: 'Rejected',
}

const REQUEST_STATUS_DOT: Record<keyof DashboardStats['requestsByStatus'], string> = {
  PENDING_APPROVAL: 'bg-warning',
  APPROVED: 'bg-primary',
  EXECUTED: 'bg-success',
  REJECTED: 'bg-destructive',
}

function formatDecimal(value: string, fractionDigits = 2): string {
  const negative = value.startsWith('-')
  const abs = negative ? value.slice(1) : value
  const [whole = '0', fraction = ''] = abs.split('.')
  const groupedWhole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const trimmedFraction = (fraction + '0'.repeat(fractionDigits)).slice(0, fractionDigits)
  const sign = negative ? '-' : ''
  return fractionDigits > 0
    ? `${sign}${groupedWhole}.${trimmedFraction}`
    : `${sign}${groupedWhole}`
}

function formatRate(value: string): string {
  // Indonesian rupiah convention: thousands grouped with a dot, no decimals.
  const negative = value.startsWith('-')
  const abs = negative ? value.slice(1) : value
  const [whole = '0'] = abs.split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${negative ? '-' : ''}${grouped}`
}

interface StatCardProps {
  label: string
  value: string
  unit?: string
  description?: string
  loading?: boolean
  testId?: string
}

function StatCard({ label, value, unit, description, loading, testId }: StatCardProps) {
  return (
    <Card
      className="rounded-md py-0 gap-0 shadow-none dark:border-0"
      data-testid={testId}
    >
      <CardContent className="px-4 py-3.5">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        {loading ? (
          <Skeleton className="mt-2 h-6 w-24" />
        ) : (
          <p className="mt-2 text-[22px] font-semibold leading-none tracking-tight tabular-nums">
            {value}
            {unit && (
              <span className="ml-1 text-[11.5px] font-mono font-normal text-muted-foreground">
                {unit}
              </span>
            )}
          </p>
        )}
        {description && (
          <p className="mt-2.5 font-mono text-[11.5px] text-muted-foreground">
            {description}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

interface Phase1StatsProps {
  data?: DashboardStats
  isLoading: boolean
}

export default function Phase1Stats({ data, isLoading }: Phase1StatsProps) {
  return (
    <section data-testid="dashboard-phase1-stats" aria-label="USDX network statistics">
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total supply"
          value={data ? formatDecimal(data.totalSupply) : '—'}
          unit="USDX"
          description="On-chain supply"
          loading={isLoading}
          testId="stat-total-supply"
        />
        <StatCard
          label="Total minted"
          value={data ? formatDecimal(data.totalMinted) : '—'}
          unit="USDX"
          description="Lifetime mint volume"
          loading={isLoading}
          testId="stat-total-minted"
        />
        <StatCard
          label="Total burned"
          value={data ? formatDecimal(data.totalBurned) : '—'}
          unit="USDX"
          description="Lifetime burn volume"
          loading={isLoading}
          testId="stat-total-burned"
        />
        <Card
          className="rounded-md py-0 gap-0 shadow-none dark:border-0 transition-colors hover:bg-muted/40"
          data-testid="stat-pending-requests"
        >
          <Link
            to="/requests?status=PENDING_APPROVAL"
            className="block px-4 py-3.5"
            aria-label="View pending requests"
          >
            <p className="text-[11px] text-muted-foreground">Pending requests</p>
            {isLoading ? (
              <Skeleton className="mt-2 h-6 w-12" />
            ) : (
              <p className="mt-2 text-[22px] font-semibold leading-none tracking-tight tabular-nums text-warning">
                {data ? data.pendingRequests.toLocaleString() : '—'}
              </p>
            )}
            <p className="mt-2.5 font-mono text-[11.5px] text-muted-foreground">
              View pending → /requests
            </p>
          </Link>
        </Card>
      </div>

      <div className="mb-6 grid gap-3 lg:grid-cols-3">
        <Card
          className="rounded-md py-0 gap-0 shadow-none dark:border-0"
          data-testid="stat-requests-by-status"
        >
          <CardHeader className="px-4 pt-3.5 pb-3 border-b border-border [&]:!gap-0">
            <CardTitle className="text-[13px] font-semibold">
              Requests by status
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {isLoading || !data ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <ul className="space-y-2.5">
                {(
                  Object.entries(data.requestsByStatus) as Array<[
                    keyof DashboardStats['requestsByStatus'],
                    number,
                  ]>
                ).map(([key, count]) => (
                  <li
                    key={key}
                    className="flex items-center gap-3 text-[12.5px]"
                    data-testid={`requests-status-${key}`}
                  >
                    <span
                      className={cn('h-1.5 w-1.5 rounded-full', REQUEST_STATUS_DOT[key])}
                      aria-hidden="true"
                    />
                    <span className="flex-1 text-foreground/90">
                      {REQUEST_STATUS_LABELS[key]}
                    </span>
                    <span className="font-mono tabular-nums text-foreground">
                      {count.toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card
          className="rounded-md py-0 gap-0 shadow-none dark:border-0"
          data-testid="stat-safe-balances"
        >
          <CardHeader className="px-4 pt-3.5 pb-3 border-b border-border [&]:!gap-0">
            <CardTitle className="text-[13px] font-semibold">
              Safe wallet balances
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {isLoading || !data ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <>
                <div data-testid="safe-balance-staff">
                  <p className="text-[11px] text-muted-foreground">Staff Safe</p>
                  <p className="mt-1 font-mono text-[14px] font-semibold tabular-nums">
                    {formatDecimal(data.safeBalances.staff)}
                    <span className="ml-1 text-[11.5px] font-normal text-muted-foreground">
                      USDX
                    </span>
                  </p>
                </div>
                <div data-testid="safe-balance-manager">
                  <p className="text-[11px] text-muted-foreground">Manager Safe</p>
                  <p className="mt-1 font-mono text-[14px] font-semibold tabular-nums">
                    {formatDecimal(data.safeBalances.manager)}
                    <span className="ml-1 text-[11.5px] font-normal text-muted-foreground">
                      USDX
                    </span>
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card
          className="rounded-md py-0 gap-0 shadow-none dark:border-0"
          data-testid="stat-current-rate"
        >
          <CardHeader className="px-4 pt-3.5 pb-3 border-b border-border [&]:!gap-0">
            <CardTitle className="text-[13px] font-semibold">
              Current rate
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {isLoading || !data ? (
              <Skeleton className="h-12 w-32" />
            ) : (
              <>
                <p className="font-mono text-[22px] font-semibold tabular-nums">
                  Rp{formatRate(data.currentRate)}
                </p>
                <p className="mt-2 text-[11.5px] text-muted-foreground">
                  per 1 USDX (USD/IDR)
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
