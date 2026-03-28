import { Link } from 'react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Coins, ArrowRightLeft, TrendingUp, Clock, CheckCircle, Eye, Activity } from 'lucide-react'
import { useDashboardStats } from './hooks'
import { formatAmount, formatShortDate } from '@/lib/format'
import { getMintingStatusConfig, getRedeemStatusConfig } from '@/lib/status'
import type { MintingStatus, RedeemStatus } from '@/lib/types'

export default function DashboardPage() {
  const { data: stats, isPending, isError } = useDashboardStats()

  if (isError) {
    return (
      <div className="rounded-lg border border-error/20 bg-red-50 p-6 text-center">
        <p className="text-error font-medium">Failed to load dashboard data</p>
        <p className="text-sm text-muted mt-1">Please try refreshing the page</p>
      </div>
    )
  }

  const mintingTotal = stats?.minting.total ?? 1
  const redeemTotal = stats?.redeem.total ?? 1

  return (
    <div className="space-y-6 pb-6">
      <div>
        <h1 className="text-2xl font-bold text-dark">Dashboard</h1>
        <p className="text-muted mt-1">Overview of minting and redeem operations</p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Minting"
          value={stats?.minting.total}
          subtitle="All-time requests"
          icon={<Coins className="h-5 w-5 text-primary" />}
          loading={isPending}
        />
        <StatCard
          title="Minting Volume"
          value={stats ? formatAmount(stats.minting.totalVolume) : undefined}
          subtitle="Total USDX minted"
          icon={<TrendingUp className="h-5 w-5 text-success" />}
          loading={isPending}
        />
        <StatCard
          title="Total Redeem"
          value={stats?.redeem.total}
          subtitle="All-time requests"
          icon={<ArrowRightLeft className="h-5 w-5 text-primary" />}
          loading={isPending}
        />
        <StatCard
          title="Redeem Volume"
          value={stats ? formatAmount(stats.redeem.totalVolume) : undefined}
          subtitle="Total USDX redeemed"
          icon={<TrendingUp className="h-5 w-5 text-success" />}
          loading={isPending}
        />
      </div>

      {/* Status breakdowns + Quick Actions */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Minting by Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Coins className="h-4 w-4 text-primary" />
              Minting by Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isPending ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {stats && Object.entries(stats.minting.byStatus).map(([status, count]) => {
                  const config = getMintingStatusConfig(status as MintingStatus)
                  const pct = Math.round((count / mintingTotal) * 100)
                  return (
                    <div key={status} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Badge variant={config.variant} className={config.className}>
                          {config.label}
                        </Badge>
                        <span className="text-sm font-semibold text-dark">{count}</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-gray-100">
                        <div
                          className="h-1.5 rounded-full bg-primary/60 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Redeem by Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ArrowRightLeft className="h-4 w-4 text-primary" />
              Redeem by Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isPending ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {stats && Object.entries(stats.redeem.byStatus).map(([status, count]) => {
                  const config = getRedeemStatusConfig(status as RedeemStatus)
                  const pct = Math.round((count / redeemTotal) * 100)
                  return (
                    <div key={status} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Badge variant={config.variant} className={config.className}>
                          {config.label}
                        </Badge>
                        <span className="text-sm font-semibold text-dark">{count}</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-gray-100">
                        <div
                          className="h-1.5 rounded-full bg-primary/60 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions + System */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Activity className="h-4 w-4 text-primary" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button asChild variant="outline" className="w-full justify-start gap-2 text-sm">
                <Link to="/minting?status=pending">
                  <Eye className="h-4 w-4 text-warning" />
                  Review Pending Minting
                  {stats && (
                    <span className="ml-auto rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
                      {stats.minting.byStatus.pending}
                    </span>
                  )}
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full justify-start gap-2 text-sm">
                <Link to="/minting?status=under_review">
                  <CheckCircle className="h-4 w-4 text-primary" />
                  Approve Under Review
                  {stats && (
                    <span className="ml-auto rounded-full bg-primary-light px-2 py-0.5 text-xs font-medium text-primary-dark">
                      {stats.minting.byStatus.under_review}
                    </span>
                  )}
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full justify-start gap-2 text-sm">
                <Link to="/redeem?status=pending">
                  <ArrowRightLeft className="h-4 w-4 text-primary" />
                  View Pending Redeems
                  {stats && (
                    <span className="ml-auto rounded-full bg-primary-light px-2 py-0.5 text-xs font-medium text-primary-dark">
                      {stats.redeem.byStatus.pending}
                    </span>
                  )}
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">System</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted">Status</span>
                <span className="flex items-center gap-1.5 font-medium text-success">
                  <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
                  Operational
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Network</span>
                <span className="font-medium text-dark">Ethereum</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Token</span>
                <span className="font-medium text-dark">USDX</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Last sync</span>
                <span className="font-medium text-dark">{formatShortDate(new Date().toISOString())}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="h-5 w-5" />
              Recent Activity
            </CardTitle>
            <div className="flex gap-2">
              <Button asChild variant="ghost" size="sm" className="text-primary hover:text-primary-dark text-xs">
                <Link to="/minting">View Minting →</Link>
              </Button>
              <Button asChild variant="ghost" size="sm" className="text-primary hover:text-primary-dark text-xs">
                <Link to="/redeem">View Redeem →</Link>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isPending ? (
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : stats?.recentActivity.length === 0 ? (
            <p className="text-center text-muted py-4">No recent activity</p>
          ) : (
            <div className="divide-y divide-border">
              {stats?.recentActivity.map((item) => {
                const statusLabel = item.status.replace(/_/g, ' ')
                return (
                  <Link
                    key={`${item.type}-${item.id}`}
                    to={`/${item.type}?highlight=${item.id}`}
                    className="flex items-center justify-between py-3 first:pt-0 last:pb-0 hover:bg-gray-50 rounded-lg px-2 transition-colors -mx-2"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                        item.type === 'minting' ? 'bg-primary-light' : 'bg-blue-50'
                      }`}>
                        {item.type === 'minting' ? (
                          <Coins className="h-4 w-4 text-primary" />
                        ) : (
                          <ArrowRightLeft className="h-4 w-4 text-primary" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-dark">{item.requester}</p>
                        <p className="text-xs text-muted capitalize">
                          {item.type} · {formatShortDate(item.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-dark">{formatAmount(item.amount)}</p>
                      <p className="text-xs text-muted capitalize">{statusLabel}</p>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
  loading,
}: {
  title: string
  value: string | number | undefined
  subtitle: string
  icon: React.ReactNode
  loading: boolean
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-muted truncate">{title}</p>
            {loading ? (
              <Skeleton className="h-8 w-24 mt-1" />
            ) : (
              <p className="text-2xl font-bold text-dark mt-1">{value}</p>
            )}
            <p className="text-xs text-muted mt-1">{subtitle}</p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary-light ml-3">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
