import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/apiFetch'
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

export interface MintListFilters {
  page?: number
  limit?: number
  status?: string
  chain?: string
  safeType?: string
}

function buildQuery(params: MintListFilters & { type: 'mint' }): string {
  const sp = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '' && v !== null) sp.set(k, String(v))
  })
  return sp.toString()
}

async function fetchMintList(
  filters: MintListFilters
): Promise<PhaseOnePaginatedResponse<RequestListItem>> {
  const qs = buildQuery({ ...filters, type: 'mint' })
  const res = await fetch(`/api/v1/requests?${qs}`)
  if (!res.ok) throw new Error('Failed to fetch mint list')
  return res.json()
}

export function useMintList(filters: MintListFilters) {
  return useQuery({
    queryKey: ['mint', 'list', filters],
    queryFn: () => fetchMintList(filters),
  })
}

// Sidebar badge count: PENDING_APPROVAL mint requests. SoT phase-1.md line 179
// sets PENDING_APPROVAL as the initial DB status; SoT § Sidebar uses (N) as
// "jumlah request dengan status PENDING_APPROVAL" — query metadata.total.
export function usePendingMintCount() {
  return useQuery({
    queryKey: ['mint', 'pending-count'],
    queryFn: async () => {
      const res = await fetch('/api/v1/requests?type=mint&status=PENDING_APPROVAL&limit=1')
      if (!res.ok) throw new Error('Failed to fetch pending mint count')
      const json = (await res.json()) as PhaseOnePaginatedResponse<RequestListItem>
      return json.metadata.total
    },
    staleTime: 30 * 1000,
  })
}
