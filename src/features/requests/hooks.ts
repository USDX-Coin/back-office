import { useQuery } from '@tanstack/react-query'
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

async function fetchRequests(
  filters: RequestListFilters
): Promise<PhaseOnePaginatedResponse<RequestListItem>> {
  const res = await fetch(`/api/v1/requests?${buildQuery(filters)}`)
  if (!res.ok) throw new Error('Failed to fetch requests')
  return res.json()
}

async function fetchRequestDetail(
  id: string
): Promise<PhaseOneSuccessResponse<RequestDetail>> {
  const res = await fetch(`/api/v1/requests/${id}`)
  if (!res.ok) throw new Error('Failed to fetch request')
  return res.json()
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
