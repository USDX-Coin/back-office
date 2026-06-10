import { useQuery } from '@tanstack/react-query'
import { apiFetchRaw } from '@/lib/apiFetch'
import type { KycListItem, PhaseOnePaginatedResponse } from '@/lib/types'

export interface KycListFilters {
  page?: number
  limit?: number
  status?: string
  entityType?: string
  /** Substring match (case-insensitive) on user email — sot/api/kyc.yaml § list. */
  search?: string
  /** YYYY-MM-DD, Asia/Jakarta — BE filters submitted_at (sot/api/kyc.yaml § list). */
  startDate?: string
  endDate?: string
}

function buildQuery(filters: KycListFilters): string {
  const sp = new URLSearchParams()
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== '' && v !== null) sp.set(k, String(v))
  })
  return sp.toString()
}

function fetchKycList(
  filters: KycListFilters
): Promise<PhaseOnePaginatedResponse<KycListItem>> {
  return apiFetchRaw<PhaseOnePaginatedResponse<KycListItem>>(
    `/api/v1/kyc?${buildQuery(filters)}`
  )
}

// GET /api/v1/kyc — the contract exposes no sortBy/sortOrder params: order is
// fixed at submitted_at ascending (oldest pending first — fairness, week1.md
// § Backoffice Approval Menu), so the page renders rows exactly as returned.
export function useKycList(filters: KycListFilters) {
  return useQuery({
    queryKey: ['kyc', 'list', filters],
    queryFn: () => fetchKycList(filters),
    refetchOnWindowFocus: true,
  })
}

// Sidebar badge count: submissions awaiting review. week1.md § Sidebar —
// `(N)` = jumlah submission status PENDING. Same metadata.total trick as
// usePendingMintCount. Approve/reject (USDX-155) must invalidate ['kyc'] so
// both the badge and the list refresh together.
export function usePendingKycCount() {
  return useQuery({
    queryKey: ['kyc', 'pending-count'],
    queryFn: async () => {
      const json = await apiFetchRaw<PhaseOnePaginatedResponse<KycListItem>>(
        '/api/v1/kyc?status=PENDING&limit=1'
      )
      return json.metadata.total
    },
    staleTime: 30 * 1000,
  })
}
