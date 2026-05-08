import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch, apiFetchRaw } from '@/lib/apiFetch'
import type {
  BurnRequest,
  CreateBurnRequest,
  PhaseOnePaginatedResponse,
  RequestListItem,
} from '@/lib/types'

const BURN_ENDPOINT = '/api/v1/burn'

export function useCreateBurn() {
  const qc = useQueryClient()
  return useMutation<BurnRequest, Error, CreateBurnRequest>({
    mutationFn: (input) =>
      apiFetch<BurnRequest>(BURN_ENDPOINT, {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['requests'] })
      qc.invalidateQueries({ queryKey: ['burn'] })
    },
  })
}

export interface BurnListFilters {
  page?: number
  limit?: number
  status?: string
  chain?: string
  safeType?: string
}

function buildQuery(params: BurnListFilters & { type: 'burn' }): string {
  const sp = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '' && v !== null) sp.set(k, String(v))
  })
  return sp.toString()
}

function fetchBurnList(
  filters: BurnListFilters
): Promise<PhaseOnePaginatedResponse<RequestListItem>> {
  const qs = buildQuery({ ...filters, type: 'burn' })
  return apiFetchRaw<PhaseOnePaginatedResponse<RequestListItem>>(`/api/v1/requests?${qs}`)
}

export function useBurnList(filters: BurnListFilters) {
  return useQuery({
    queryKey: ['burn', 'list', filters],
    queryFn: () => fetchBurnList(filters),
  })
}

// Sidebar badge count: PENDING_APPROVAL burn requests. See usePendingMintCount
// (mint/hooks.ts) for SoT references.
export function usePendingBurnCount() {
  return useQuery({
    queryKey: ['burn', 'pending-count'],
    queryFn: async () => {
      const json = await apiFetchRaw<PhaseOnePaginatedResponse<RequestListItem>>(
        '/api/v1/requests?type=burn&status=PENDING_APPROVAL&limit=1'
      )
      return json.metadata.total
    },
    staleTime: 30 * 1000,
  })
}
