// USDX-87 — Manual Sync data hooks.
// SoT: sot/api/manual-sync.yaml (list / verify / execute).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/apiFetch'
import type {
  ManualSyncItem,
  ManualSyncTxHashBody,
  MatchResult,
  RequestDetail,
} from '@/lib/types'

export interface ManualSyncListFilters {
  chain?: string
  type?: 'mint' | 'burn' | ''
}

function buildManualSyncQuery(filters: ManualSyncListFilters): string {
  const sp = new URLSearchParams()
  if (filters.chain) sp.set('chain', filters.chain)
  if (filters.type) sp.set('type', filters.type)
  return sp.toString()
}

async function fetchManualSyncList(
  filters: ManualSyncListFilters
): Promise<ManualSyncItem[]> {
  const qs = buildManualSyncQuery(filters)
  const path = qs ? `/api/v1/manual-sync?${qs}` : '/api/v1/manual-sync'
  return apiFetch<ManualSyncItem[]>(path)
}

/**
 * Manual Sync list — all `PENDING_APPROVAL` / `APPROVED` requests across mint
 * + burn, sorted by `createdAt` asc (BE-side, per sot/api/manual-sync.yaml).
 *
 * Smart polling: every entry on this list is by-definition non-terminal, so
 * we poll continuously while there's at least one row, then stop once the
 * list empties (mirrors the USDX-27 pattern in `useMintList`).
 */
export function useManualSyncList(filters: ManualSyncListFilters) {
  return useQuery({
    queryKey: ['manual-sync', 'list', filters],
    queryFn: () => fetchManualSyncList(filters),
    refetchInterval: (query) =>
      (query.state.data ?? []).length > 0 ? 20_000 : false,
    refetchOnWindowFocus: true,
  })
}

// POST /api/v1/manual-sync/:id/verify — read-only on-chain vs DB comparison.
async function postVerify(
  id: string,
  body: ManualSyncTxHashBody
): Promise<MatchResult> {
  return apiFetch<MatchResult>(`/api/v1/manual-sync/${id}/verify`, {
    method: 'POST',
    body,
  })
}

/**
 * Verify a tx hash against a request. Component manages the mutation lifecycle
 * itself (loading, comparison result, mismatch alert) so we expose the raw
 * mutation rather than wrapping it in additional state.
 */
export function useVerifyTxHash(id: string | null) {
  return useMutation({
    mutationFn: (body: ManualSyncTxHashBody) => postVerify(id as string, body),
  })
}

// POST /api/v1/manual-sync/:id/execute — re-verify then flip status to EXECUTED.
async function postExecute(
  id: string,
  body: ManualSyncTxHashBody
): Promise<RequestDetail> {
  return apiFetch<RequestDetail>(`/api/v1/manual-sync/${id}/execute`, {
    method: 'POST',
    body,
  })
}

export function useExecuteSync(id: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: ManualSyncTxHashBody) => postExecute(id as string, body),
    onSuccess: () => {
      // Row leaves the Manual Sync list (status EXECUTED is not in the
      // PENDING_APPROVAL/APPROVED set); also bust the mint/burn lists +
      // sidebar pending badges that reference the same underlying request.
      qc.invalidateQueries({ queryKey: ['manual-sync'] })
      qc.invalidateQueries({ queryKey: ['mint'] })
      qc.invalidateQueries({ queryKey: ['burn'] })
      qc.invalidateQueries({ queryKey: ['requests'] })
    },
  })
}
