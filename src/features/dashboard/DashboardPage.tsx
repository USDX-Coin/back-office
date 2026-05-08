import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import PageHeader from '@/components/PageHeader'
import Phase1Stats from './Phase1Stats'
import { useDashboardStats } from './hooks'

export default function DashboardPage() {
  const {
    data: stats,
    isLoading: statsLoading,
    refetch: refetchStats,
  } = useDashboardStats()

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
              onClick={() => refetchStats()}
              aria-label="Refresh"
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
          </>
        }
      />

      <Phase1Stats data={stats} isLoading={statsLoading} />
    </div>
  )
}
