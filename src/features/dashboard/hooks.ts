import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/apiFetch'
import type { DashboardStats } from '@/lib/types'

// USDX-16 / USDX-37 — sot/openapi.yaml § /api/v1/dashboard/stats.
// Polls every 30s so the dashboard stays current without a manual reload.
export const DASHBOARD_STATS_POLL_MS = 30_000
// USDX-117 — cap the backoff so a degraded backend is still retried every 5min.
export const DASHBOARD_STATS_MAX_POLL_MS = 5 * 60_000

// USDX-117 — back off polling on consecutive failures so a struggling backend
// isn't hit every 30s. react-query resets `fetchFailureCount` to 0 on the next
// success, so the interval self-recovers to the base cadence.
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
