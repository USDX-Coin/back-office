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
