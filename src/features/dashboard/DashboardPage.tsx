import { lazy, Suspense } from 'react'
import { ArrowUpCircle, ArrowDownCircle, Users, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import KpiCard from './KpiCard'
import RecentActivityList from './RecentActivityList'
import NetworkDistribution from './NetworkDistribution'
import { useDashboardSnapshot } from './hooks'

const VolumeTrendChart = lazy(() => import('./VolumeTrendChart'))

function formatUSD(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}k`
  return `$${value.toLocaleString()}`
}

export default function DashboardPage() {
  const { data, isLoading } = useDashboardSnapshot()
  const kpis = data?.kpis

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Operations Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Rolling 30-day performance across OTC mint and redeem.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total Mint Volume (30d)"
          value={kpis ? formatUSD(kpis.totalMintVolume30d) : '—'}
          icon={<ArrowUpCircle className="h-5 w-5 text-primary" />}
          trend={kpis?.trends.mintVolume}
          trendDescription="vs previous 30d"
        />
        <KpiCard
          label="Total Redeem Volume (30d)"
          value={kpis ? formatUSD(kpis.totalRedeemVolume30d) : '—'}
          icon={<ArrowDownCircle className="h-5 w-5 text-primary" />}
          trend={kpis?.trends.redeemVolume}
          trendDescription="vs previous 30d"
        />
        <KpiCard
          label="Active Users"
          value={kpis ? kpis.activeUsers.toLocaleString() : '—'}
          icon={<Users className="h-5 w-5 text-primary" />}
          trend={kpis?.trends.activeUsers}
          trendDescription="vs previous period"
        />
        <KpiCard
          label="Pending Transactions"
          value={kpis ? kpis.pendingTransactions.toLocaleString() : '—'}
          icon={<Clock className="h-5 w-5 text-warning" />}
          tone="warning"
          trendDescription={kpis?.pendingTransactions === 0 ? 'Queue clear' : 'Awaiting settlement'}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-8">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Volume Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {isLoading ? (
                <Skeleton className="h-full w-full" />
              ) : (
                <Suspense fallback={<Skeleton className="h-full w-full" />}>
                  <VolumeTrendChart data={data?.volumeTrend ?? []} />
                </Suspense>
              )}
            </div>
          </CardContent>
        </Card>
        <div className="lg:col-span-4">
          <NetworkDistribution items={data?.networkDistribution ?? []} />
        </div>
      </div>

      <RecentActivityList items={data?.recentActivity ?? []} />
    </div>
  )
}
