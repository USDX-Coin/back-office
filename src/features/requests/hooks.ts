import { useQuery } from '@tanstack/react-query'
import { apiFetchRaw } from '@/lib/apiFetch'
import type {
  PhaseOnePaginatedResponse,
  PhaseOneSuccessResponse,
  RequestDetail,
  RequestListItem,
} from '@/lib/types'

export interface RequestListFilters {
  page?: number
  limit?: number
  type?: string
  status?: string
  chain?: string
  safeType?: string
}

function buildQuery(params: RequestListFilters): string {
  const sp = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '' && v !== null) sp.set(k, String(v))
  })
  return sp.toString()
}

function fetchRequests(
  filters: RequestListFilters
): Promise<PhaseOnePaginatedResponse<RequestListItem>> {
  return apiFetchRaw<PhaseOnePaginatedResponse<RequestListItem>>(
    `/api/v1/requests?${buildQuery(filters)}`
  )
}

function fetchRequestDetail(
  id: string
): Promise<PhaseOneSuccessResponse<RequestDetail>> {
  return apiFetchRaw<PhaseOneSuccessResponse<RequestDetail>>(`/api/v1/requests/${id}`)
}

export function useRequests(filters: RequestListFilters) {
  return useQuery({
    queryKey: ['requests', filters],
    queryFn: () => fetchRequests(filters),
  })
}

export function useRequestDetail(id: string | null) {
  return useQuery({
    queryKey: ['requests', 'detail', id],
    queryFn: () => fetchRequestDetail(id as string),
    enabled: Boolean(id),
  })
}
