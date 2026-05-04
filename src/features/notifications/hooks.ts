import { useQuery } from '@tanstack/react-query'
import type { Notification, PaginatedResponse } from '@/lib/types'

const POLL_INTERVAL_MS = 5000

export function useNotifications() {
  return useQuery<PaginatedResponse<Notification>>({
    queryKey: ['notifications', 'list'],
    queryFn: async () => {
      const res = await fetch('/api/notifications')
      if (!res.ok) throw new Error('Failed to fetch notifications')
      return res.json()
    },
    refetchInterval: POLL_INTERVAL_MS,
  })
}

export function useNotificationsCount() {
  return useQuery<{ count: number }>({
    queryKey: ['notifications', 'count'],
    queryFn: async () => {
      const res = await fetch('/api/notifications/count')
      if (!res.ok) throw new Error('Failed to fetch notifications count')
      return res.json()
    },
    refetchInterval: POLL_INTERVAL_MS,
  })
}
