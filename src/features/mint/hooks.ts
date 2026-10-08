import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch, apiFetchRaw } from '@/lib/apiFetch'
import type {
  CreateMintRequestBody,
  MintRequestDetail,
  PhaseOnePaginatedResponse,
  PhaseOneUser,
  RequestListItem,
} from '@/lib/types'

// USDX-46: server filters by kycStatus=VERIFIED. Suspended is filtered FE-side
// because sot/api/users.yaml does not yet expose `?suspended=` query param.
async function fetchEligibleUsers(search: string): Promise<PhaseOneUser[]> {
  const params = new URLSearchParams()
  if (search) params.set('search', search)
  params.set('kycStatus', 'VERIFIED')
  params.set('limit', '8')
  const path = `/api/v1/users?${params.toString()}`
  const data = await apiFetch<PhaseOnePaginatedResponse<PhaseOneUser>['data']>(path)
  return data.filter((u) => !u.suspended)
}

// Public hook used by UserPicker on Mint + Burn forms. Returns only users
// who pass the BE eligibility check (KYC VERIFIED + not suspended).
export function useEligibleUsers(search: string, enabled: boolean) {
  return useQuery({
    queryKey: ['phase-one-users', 'eligible', search],
    queryFn: () => fetchEligibleUsers(search),
    enabled: enabled && search.length > 0,
    staleTime: 30 * 1000,
  })
}

// POST /api/v1/mint — submit a mint request.
async function postMintRequest(body: CreateMintRequestBody): Promise<MintRequestDetail> {
  return apiFetch<MintRequestDetail>('/api/v1/mint', {
    method: 'POST',
    body,
  })
}

export function useCreateMintRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: postMintRequest,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['requests'] })
      qc.invalidateQueries({ queryKey: ['mint'] })
    },
  })
}

// Sidebar badge count: PENDING_APPROVAL mint requests. SoT phase-1.md line 179
// sets PENDING_APPROVAL as the initial DB status; SoT § Sidebar uses (N) as
// "jumlah request dengan status PENDING_APPROVAL" — query metadata.total.
// USDX-78: `enabled` lets the Sidebar / BottomNav skip the query for STAFF
// (sot/phase-1.md L34 — STAFF can't access /api/v1/requests*, so firing would
// produce noisy 403s).
export function usePendingMintCount(opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['mint', 'pending-count'],
    queryFn: async () => {
      const json = await apiFetchRaw<PhaseOnePaginatedResponse<RequestListItem>>(
        '/api/v1/requests?type=mint&status=PENDING_APPROVAL&limit=1'
      )
      return json.metadata.total
    },
    enabled: opts.enabled ?? true,
    staleTime: 30 * 1000,
  })
}
