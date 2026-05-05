import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/apiFetch'
import type { DashboardSnapshot, DashboardStats } from '@/lib/types'

export function useDashboardSnapshot() {
  return useQuery({
    queryKey: ['dashboard', 'snapshot'],
    queryFn: async (): Promise<DashboardSnapshot> => {
      const res = await fetch('/api/dashboard/snapshot')
      if (!res.ok) throw new Error('Failed to fetch dashboard snapshot')
      return res.json()
    },
    refetchInterval: 30_000,
  })
}

// USDX-16 — sot/openapi.yaml § /api/v1/dashboard/stats
// Polls every 30s so the dashboard stays current without a manual reload.
export const DASHBOARD_STATS_POLL_MS = 30_000

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => apiFetch<DashboardStats>('/api/v1/dashboard/stats'),
    refetchInterval: DASHBOARD_STATS_POLL_MS,
  })
}
