import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/apiFetch'
import type {
  CreateMintRequestBody,
  MintRequestDetail,
  PhaseOnePaginatedResponse,
  PhaseOneUser,
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
    },
  })
}
