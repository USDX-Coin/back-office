import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/apiFetch'
import type {
  CreateMintRequestBody,
  MintRequestDetail,
  PhaseOnePaginatedResponse,
  PhaseOneUser,
} from '@/lib/types'

// GET /api/v1/users?search= — Phase-1 user lookup for autocomplete.
async function fetchPhaseOneUsers(search: string): Promise<PhaseOneUser[]> {
  // apiFetch unwraps SuccessResponse and returns `data`. Since the SoT envelope
  // for paginated lists is { status, metadata, data: [...] }, calling with the
  // paginated generic returns the array directly.
  const params = new URLSearchParams()
  if (search) params.set('search', search)
  params.set('limit', '8')
  const path = `/api/v1/users?${params.toString()}`
  // The generic must match the *full* envelope so apiFetch returns `.data`.
  const data = await apiFetch<PhaseOnePaginatedResponse<PhaseOneUser>['data']>(path)
  return data
}

export function usePhaseOneUsers(search: string, enabled: boolean) {
  return useQuery({
    queryKey: ['phase-one-users', search],
    queryFn: () => fetchPhaseOneUsers(search),
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
