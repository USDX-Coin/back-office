import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import PageHeader from '@/components/PageHeader'
import TableErrorState from '@/components/TableErrorState'
import Phase1Stats from './Phase1Stats'
import QueueBoard from './QueueBoard'
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
        eyebrow="Pekerjaan Hari Ini"
        title="Beranda"
        italicAccent="ringkasan"
        subtitle={
          stats
            ? `${stats.pendingRequests} request OTC menunggu persetujuan · kurs Rp${stats.currentRate}/USDX`
            : showError
              ? 'Statistik tidak dapat dimuat'
              : 'Memuat…'
        }
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[12px] font-mono font-normal"
              disabled
            >
              Diperbarui tiap 30 detik
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => refetchStats()}
              aria-label="Muat ulang"
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
          </>
        }
      />

      {/* P1-3 — pertanyaan pertama operator tiap pagi ("apa yang menunggu
          saya hari ini") dijawab di baris paling atas. Papan antrean berdiri
          SENDIRI dari query statistik on-chain: `/api/v1/dashboard/stats` yang
          gagal tidak boleh ikut menghapus daftar pekerjaan dari layar. */}
      <QueueBoard />

      {showError ? (
        <div className="rounded-md bg-card">
          <TableErrorState
            title="Statistik jaringan tidak dapat dimuat"
            onRetry={() => refetchStats()}
          />
        </div>
      ) : (
        <Phase1Stats data={stats} isLoading={statsLoading} />
      )}
    </div>
  )
}
