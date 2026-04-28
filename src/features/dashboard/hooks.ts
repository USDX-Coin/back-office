import { useQuery } from '@tanstack/react-query'
import type { DashboardSnapshot } from '@/lib/types'

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
