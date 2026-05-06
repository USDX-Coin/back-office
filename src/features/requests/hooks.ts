import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import type {
  RequestListItem,
  RequestStatus,
  RequestType,
  RequestDetail,
} from '@/lib/types'

export interface RequestListFilters {
  type?: RequestType
  status?: RequestStatus
  chain?: string
  safeType?: 'STAFF' | 'MANAGER'
  page?: number
  limit?: number
}

export function useRequestList(filters: RequestListFilters) {
  return useQuery({
    queryKey: ['requests', filters],
    queryFn: async () => {
      const result = await apiFetch<RequestListItem[]>('/api/v1/requests', {
        query: {
          type: filters.type,
          status: filters.status,
          chain: filters.chain,
          safeType: filters.safeType,
          page: filters.page,
          limit: filters.limit,
        },
      })
      return result
    },
  })
}

export function useRequestDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['requests', 'detail', id],
    enabled: !!id,
    queryFn: async () => {
      const result = await apiFetch<RequestDetail>(`/api/v1/requests/${id}`)
      return result.data
    },
  })
}
