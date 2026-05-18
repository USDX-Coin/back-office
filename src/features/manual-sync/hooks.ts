// USDX-87 — Manual Sync data hooks.
// SoT: sot/api/manual-sync.yaml (list / verify / execute).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, apiFetch } from '@/lib/apiFetch'
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

/**
 * `INVALID_STATUS` is the canonical 409 the BE returns when the request is no
 * longer in an executable state (concurrent sync, or auto-path already moved
 * it). See backend PR USDX-93 (#60).
 */
export function isInvalidStatusError(
  err: unknown
): err is ApiError & { details: { currentStatus: string } } {
  return (
    err instanceof ApiError &&
    err.status === 409 &&
    err.code === 'INVALID_STATUS' &&
    typeof (err.details as { currentStatus?: unknown } | undefined)
      ?.currentStatus === 'string'
  )
}

export function useExecuteSync(id: string | null) {
  const qc = useQueryClient()
  // Row leaves the Manual Sync list once it's no longer PENDING_APPROVAL/
  // APPROVED; also bust the mint/burn lists + sidebar pending badges that
  // reference the same underlying request.
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['manual-sync'] })
    qc.invalidateQueries({ queryKey: ['mint'] })
    qc.invalidateQueries({ queryKey: ['burn'] })
    qc.invalidateQueries({ queryKey: ['requests'] })
  }
  return useMutation({
    mutationFn: (body: ManualSyncTxHashBody) => postExecute(id as string, body),
    onSuccess: invalidate,
    onError: (err) => {
      // 409 INVALID_STATUS means the row is stale — refresh the list so it
      // drops out, same as a successful execute. Other errors (400 mismatch,
      // tx not found) leave the list untouched; the modal handles them.
      if (isInvalidStatusError(err)) invalidate()
    },
  })
}
