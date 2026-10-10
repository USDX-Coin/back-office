import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/apiFetch'
import type { DashboardStats } from '@/lib/types'

// `GET /api/v1/dashboard/stats` (sot/api/dashboard.yaml; backend origin/dev
// `dashboard.controller.ts`, tanpa @Roles). Dipakai lagi oleh Ringkasan —
// perilaku polling sama dengan Beranda lama (USDX-37 / USDX-117): 30 dtk,
// mundur ganda saat gagal beruntun, maksimal 5 menit.
export const DASHBOARD_STATS_POLL_MS = 30_000
export const DASHBOARD_STATS_MAX_POLL_MS = 5 * 60_000

export function dashboardStatsPollInterval(failureCount: number): number {
  if (failureCount <= 0) return DASHBOARD_STATS_POLL_MS
  return Math.min(DASHBOARD_STATS_POLL_MS * 2 ** failureCount, DASHBOARD_STATS_MAX_POLL_MS)
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => apiFetch<DashboardStats>('/api/v1/dashboard/stats'),
    refetchInterval: (query) => dashboardStatsPollInterval(query.state.fetchFailureCount),
  })
}
