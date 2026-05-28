import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/apiFetch'
import type { DashboardStats } from '@/lib/types'

// USDX-16 / USDX-37 — sot/openapi.yaml § /api/v1/dashboard/stats.
// Polls every 30s so the dashboard stays current without a manual reload.
export const DASHBOARD_STATS_POLL_MS = 30_000

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => apiFetch<DashboardStats>('/api/v1/dashboard/stats'),
    refetchInterval: DASHBOARD_STATS_POLL_MS,
  })
}
