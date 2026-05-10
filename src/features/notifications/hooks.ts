import { useQuery } from '@tanstack/react-query'
import { apiFetchRaw } from '@/lib/apiFetch'
import type { PhaseOnePaginatedResponse, RequestListItem } from '@/lib/types'

// USDX-38 / USDX-19: notifications surface the cross-type list of
// PENDING_APPROVAL mint+burn requests so an approver can jump from the
// backoffice straight to the Safe UI to sign + execute.
//
// Datasource: GET /api/v1/requests?status=PENDING_APPROVAL (sot/api/requests.yaml).
// Auto-refresh every 30s matches USDX-19 AC "Auto-refresh".

const NOTIFICATIONS_QUERY_KEY = ['notifications', 'pending'] as const
const REFETCH_INTERVAL_MS = 30 * 1000

interface NotificationsListParams {
  page?: number
  limit?: number
}

interface NotificationsResult {
  rows: RequestListItem[]
  total: number
  page: number
  limit: number
}

async function fetchPendingNotifications({
  page = 1,
  limit = 8,
}: NotificationsListParams): Promise<NotificationsResult> {
  const sp = new URLSearchParams({
    status: 'PENDING_APPROVAL',
    page: String(page),
    limit: String(limit),
  })
  const json = await apiFetchRaw<PhaseOnePaginatedResponse<RequestListItem>>(
    `/api/v1/requests?${sp.toString()}`
  )
  return {
    rows: json.data,
    total: json.metadata.total,
    page: json.metadata.page,
    limit: json.metadata.limit,
  }
}

// Bell popover + /notifications page list. `limit` controls how many rows to
// fetch; pass a small number (e.g. 8) for the popover, larger for the page.
export function usePendingNotifications(params: NotificationsListParams = {}) {
  const page = params.page ?? 1
  const limit = params.limit ?? 8
  return useQuery({
    queryKey: [...NOTIFICATIONS_QUERY_KEY, 'list', { page, limit }],
    queryFn: () => fetchPendingNotifications({ page, limit }),
    refetchInterval: REFETCH_INTERVAL_MS,
    staleTime: REFETCH_INTERVAL_MS / 2,
  })
}

// Bell badge count. Cheaper query (limit=1) — only metadata.total is read.
export function usePendingNotificationsCount() {
  return useQuery({
    queryKey: [...NOTIFICATIONS_QUERY_KEY, 'count'],
    queryFn: async () => {
      const json = await apiFetchRaw<PhaseOnePaginatedResponse<RequestListItem>>(
        '/api/v1/requests?status=PENDING_APPROVAL&limit=1'
      )
      return json.metadata.total
    },
    refetchInterval: REFETCH_INTERVAL_MS,
    staleTime: REFETCH_INTERVAL_MS / 2,
  })
}
