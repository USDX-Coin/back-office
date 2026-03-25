import { Link } from 'react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Coins, ArrowRightLeft, TrendingUp, Clock } from 'lucide-react'
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-dark">Dashboard</h1>
        <p className="text-muted mt-1">Overview of minting and redeem operations</p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Minting"
          value={stats?.minting.total}
          icon={<Coins className="h-5 w-5 text-primary" />}
          loading={isPending}
        />
        <StatCard
          title="Minting Volume"
          value={stats ? formatAmount(stats.minting.totalVolume) : undefined}
          icon={<TrendingUp className="h-5 w-5 text-success" />}
          loading={isPending}
        />
        <StatCard
          title="Total Redeem"
          value={stats?.redeem.total}
          icon={<ArrowRightLeft className="h-5 w-5 text-primary" />}
          loading={isPending}
        />
        <StatCard
          title="Redeem Volume"
          value={stats ? formatAmount(stats.redeem.totalVolume) : undefined}
          icon={<TrendingUp className="h-5 w-5 text-success" />}
          loading={isPending}
        />
      </div>

      {/* Status breakdowns */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Minting by Status</CardTitle>
          </CardHeader>
          <CardContent>
            {isPending ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-6 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {stats && Object.entries(stats.minting.byStatus).map(([status, count]) => {
                  const config = getMintingStatusConfig(status as MintingStatus)
                  return (
                    <div key={status} className="flex items-center justify-between">
                      <Badge variant={config.variant} className={config.className}>
                        {config.label}
                      </Badge>
                      <span className="text-sm font-medium">{count}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Redeem by Status</CardTitle>
          </CardHeader>
          <CardContent>
            {isPending ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-6 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {stats && Object.entries(stats.redeem.byStatus).map(([status, count]) => {
                  const config = getRedeemStatusConfig(status as RedeemStatus)
                  return (
                    <div key={status} className="flex items-center justify-between">
                      <Badge variant={config.variant} className={config.className}>
                        {config.label}
                      </Badge>
                      <span className="text-sm font-medium">{count}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isPending ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : stats?.recentActivity.length === 0 ? (
            <p className="text-center text-muted py-4">No recent activity</p>
          ) : (
            <div className="space-y-2">
              {stats?.recentActivity.map((item) => (
                <Link
                  key={`${item.type}-${item.id}`}
                  to={`/${item.type}?highlight=${item.id}`}
                  className="flex items-center justify-between rounded-lg p-2 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full ${
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
                      <p className="text-xs text-muted">{formatShortDate(item.createdAt)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{formatAmount(item.amount)}</p>
                    <p className="text-xs text-muted capitalize">{item.status.replace('_', ' ')}</p>
                  </div>
                </Link>
              ))}
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
  icon,
  loading,
}: {
  title: string
  value: string | number | undefined
  icon: React.ReactNode
  loading: boolean
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-light">
          {icon}
        </div>
        <div>
          <p className="text-sm text-muted">{title}</p>
          {loading ? (
            <Skeleton className="h-7 w-20 mt-1" />
          ) : (
            <p className="text-2xl font-bold text-dark">{value}</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
