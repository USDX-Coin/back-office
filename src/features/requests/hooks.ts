import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import type {
  RequestListItem,
  RequestStatus,
  RequestType,
  SafeType,
} from '@/lib/types'

export interface RequestListFilters {
  type?: RequestType
  status?: RequestStatus
  chain?: string
  safeType?: SafeType
  page?: number
  limit?: number
}

export function useRequestList(filters: RequestListFilters) {
  return useQuery({
    queryKey: ['requests', filters],
    queryFn: async () =>
      apiFetch<RequestListItem[]>('/api/v1/requests', {
        query: {
          type: filters.type,
          status: filters.status,
          chain: filters.chain,
          safeType: filters.safeType,
          page: filters.page,
          limit: filters.limit,
        },
      }),
  })
}
