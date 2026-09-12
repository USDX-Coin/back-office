import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch, apiFetchRaw } from '@/lib/apiFetch'
import { isRequestTerminal } from '@/lib/status'
import { POLL_LIST_MS } from '@/lib/queryConfig'
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
  search?: string
  /** YYYY-MM-DD, Asia/Jakarta — BE filters created_at (USDX-98). */
  startDate?: string
  endDate?: string
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
    // USDX-27: poll only while some row is still non-terminal (see useMintList).
    refetchInterval: (query) =>
      (query.state.data?.data ?? []).some((r) => !isRequestTerminal(r.status))
        ? POLL_LIST_MS
        : false,
    refetchOnWindowFocus: true,
  })
}

// Sidebar badge count: PENDING_APPROVAL burn requests. See usePendingMintCount
// (mint/hooks.ts) for SoT references. USDX-78: `enabled` skips the query for
// STAFF (no access to /api/v1/requests*).
export function usePendingBurnCount(opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['burn', 'pending-count'],
    queryFn: async () => {
      const json = await apiFetchRaw<PhaseOnePaginatedResponse<RequestListItem>>(
        '/api/v1/requests?type=burn&status=PENDING_APPROVAL&limit=1'
      )
      return json.metadata.total
    },
    enabled: opts.enabled ?? true,
    staleTime: 30 * 1000,
  })
}
