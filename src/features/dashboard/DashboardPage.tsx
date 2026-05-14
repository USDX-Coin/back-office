import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import PageHeader from '@/components/PageHeader'
import TableErrorState from '@/components/TableErrorState'
import Phase1Stats from './Phase1Stats'
import { useDashboardStats } from './hooks'

export default function DashboardPage() {
  const {
    data: stats,
    isLoading: statsLoading,
    isError: statsError,
    refetch: refetchStats,
  } = useDashboardStats()

  // USDX-27: surface fetch failures explicitly. We only swap to the error panel
  // when we have nothing to show — if a poll fails but we still hold stats from
  // a prior success, keep rendering them.
  const showError = statsError && !stats

  return (
    <div>
      <PageHeader
        eyebrow="USDX network"
        title="Dashboard"
        italicAccent="overview"
        subtitle={
          stats
            ? `${stats.pendingRequests} pending request${stats.pendingRequests === 1 ? '' : 's'} · rate Rp${stats.currentRate}/USDX`
            : showError
              ? 'Stats unavailable'
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
              onClick={() => refetchStats()}
              aria-label="Refresh"
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
          </>
        }
      />

      {showError ? (
        <div className="rounded-md bg-card">
          <TableErrorState
            title="Couldn't load dashboard stats"
            onRetry={() => refetchStats()}
          />
        </div>
      ) : (
        <Phase1Stats data={stats} isLoading={statsLoading} />
      )}
    </div>
  )
}
