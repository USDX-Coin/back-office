import { lazy, Suspense } from 'react'
import { RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import PageHeader from '@/components/PageHeader'
import KpiCard from './KpiCard'
import Phase1Stats from './Phase1Stats'
import RecentActivityList from './RecentActivityList'
import NetworkDistribution from './NetworkDistribution'
import { useDashboardSnapshot, useDashboardStats } from './hooks'

const VolumeTrendChart = lazy(() => import('./VolumeTrendChart'))

function formatUSD(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}k`
  return `$${value.toLocaleString()}`
}

export default function DashboardPage() {
  const { data, isLoading, refetch } = useDashboardSnapshot()
  const {
    data: stats,
    isLoading: statsLoading,
    refetch: refetchStats,
  } = useDashboardStats()
  const kpis = data?.kpis

  const trail = (data?.volumeTrend ?? []).slice(-12)
  const mintSpark = trail.map((d) => d.mint)
  const redeemSpark = trail.map((d) => d.redeem)

  return (
    <div>
      <PageHeader
        eyebrow="USDX network"
        title="Dashboard"
        italicAccent="overview"
        subtitle={
          stats
            ? `${stats.pendingRequests} pending request${stats.pendingRequests === 1 ? '' : 's'} · rate Rp${stats.currentRate}/USDX`
            : 'Loading…'
        }
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[12px] font-mono font-normal"
              disabled
            >
              Live · 30s refresh
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => {
                refetch()
                refetchStats()
              }}
              aria-label="Refresh"
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
          </>
        }
      />

      <Phase1Stats data={stats} isLoading={statsLoading} />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Mint volume / 30d"
          value={kpis ? formatUSD(kpis.totalMintVolume30d) : '—'}
          trend={kpis?.trends.mintVolume}
          trendDescription="vs prior 30d"
          sparkline={mintSpark}
        />
        <KpiCard
          label="Redeem volume / 30d"
          value={kpis ? formatUSD(kpis.totalRedeemVolume30d) : '—'}
          trend={kpis?.trends.redeemVolume}
          trendDescription="vs prior 30d"
          sparkline={redeemSpark}
        />
        <KpiCard
          label="Active customers"
          value={kpis ? kpis.activeUsers.toLocaleString() : '—'}
          trend={kpis?.trends.activeUsers}
          trendDescription="vs prior period"
        />
        <KpiCard
          label="Pending OTC"
          value={kpis ? kpis.pendingTransactions.toLocaleString() : '—'}
          tone="warning"
          trendDescription={
            kpis?.pendingTransactions === 0 ? 'Queue clear' : 'Awaiting settlement'
          }
        />
      </div>

      <div className="mb-6 grid gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2 rounded-md py-0 gap-0 shadow-none dark:border-0">
          <CardHeader className="px-4 pt-3.5 pb-3 border-b border-border [&]:!gap-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-[13px] font-semibold">
                Volume trend
              </CardTitle>
              <div className="flex items-center gap-3 font-mono text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-0.5 w-3 bg-primary" /> Mint
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-0.5 w-3 bg-primary/40" /> Redeem
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-2 py-3">
            <div className="h-[230px]">
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
        <NetworkDistribution items={data?.networkDistribution ?? []} />
      </div>

      <RecentActivityList items={data?.recentActivity ?? []} />
    </div>
  )
}
