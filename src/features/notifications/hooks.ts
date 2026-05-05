import { useQuery } from '@tanstack/react-query'
import type { PhaseOnePaginatedResponse, RequestListItem } from '@/lib/types'

const POLL_INTERVAL_MS = 5000

// The Notifications surface is a filtered view over the Phase-1 Requests
// list (sot/openapi.yaml § GET /api/v1/requests). We page through every
// PENDING_APPROVAL row to keep the badge accurate; the underlying list is
// small (typically < 100 at any time) so a single page is enough.
const PENDING_APPROVAL_LIMIT = 200

interface NotificationsQueryResult {
  data: RequestListItem[]
  total: number
}

// Uses raw fetch (matches src/features/requests/hooks.ts) because the page
// needs `metadata.total` from the SoT envelope, which apiFetch unwraps away.
async function fetchPendingApprovals(): Promise<NotificationsQueryResult> {
  const response = await fetch(
    `/api/v1/requests?status=PENDING_APPROVAL&limit=${PENDING_APPROVAL_LIMIT}`
  )
  if (!response.ok) throw new Error('Failed to fetch notifications')
  const payload = (await response.json()) as PhaseOnePaginatedResponse<RequestListItem>
  return { data: payload.data, total: payload.metadata.total }
}

export function useNotifications() {
  return useQuery<NotificationsQueryResult>({
    queryKey: ['notifications', 'list'],
    queryFn: fetchPendingApprovals,
    refetchInterval: POLL_INTERVAL_MS,
  })
}

export function useNotificationsCount() {
  return useQuery<{ count: number }>({
    queryKey: ['notifications', 'count'],
    queryFn: async () => {
      const result = await fetchPendingApprovals()
      return { count: result.total }
    },
    refetchInterval: POLL_INTERVAL_MS,
  })
}
