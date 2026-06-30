import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch, apiFetchRaw } from '@/lib/apiFetch'
import { isSafeTxTerminal } from '@/lib/multisig/status'
import type {
  PhaseOnePaginatedResponse,
  ProposeRequest,
  SafeCancelBody,
  SafeConfirmBody,
  SafeExecuteBody,
  SafeMeta,
  SafeTxDetail,
  SafeTxListItem,
  SafeTxStatus,
  SafeType,
} from '@/lib/types'

// USDX-275 — backoffice Multisig queue. sot/api/multisig.yaml:
//   GET  /api/v1/multisig            (list, paginated, tab/safeType/search filters)
//   GET  /api/v1/multisig/{id}       (detail: decoded + signers + execPayload)
//   GET  /api/v1/multisig/safes      (Safe meta: threshold/owners/nonce)
//   POST /api/v1/multisig/{id}/confirm  (add signature — EIP-712)
//   POST /api/v1/multisig/{id}/execute  (report execTxHash)
//   POST /api/v1/multisig/{id}/cancel   (discard off-chain)

export interface MultisigListFilters {
  page?: number
  limit?: number
  status?: SafeTxStatus | ''
  safeType?: SafeType | ''
  activity?: string
  search?: string
}

function buildQuery(filters: Record<string, unknown>): string {
  const sp = new URLSearchParams()
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== '' && v !== null) sp.set(k, String(v))
  })
  return sp.toString()
}

function fetchList(
  filters: MultisigListFilters,
): Promise<PhaseOnePaginatedResponse<SafeTxListItem>> {
  return apiFetchRaw<PhaseOnePaginatedResponse<SafeTxListItem>>(
    `/api/v1/multisig?${buildQuery(filters as Record<string, unknown>)}`,
  )
}

export function useMultisigList(filters: MultisigListFilters) {
  return useQuery({
    queryKey: ['multisig', 'list', filters],
    queryFn: () => fetchList(filters),
    // Poll while any row is still in-flight (PENDING_SIGN/READY_TO_EXECUTE/
    // CONFIRMING) so signature progress + status move without a manual refresh.
    refetchInterval: (query) =>
      (query.state.data?.data ?? []).some((r) => !isSafeTxTerminal(r.status))
        ? 15_000
        : false,
    refetchOnWindowFocus: true,
  })
}

// Lightweight per-status count for the tab "(N)" badges. limit=1 → we only read
// metadata.total (mirrors the sidebar mint/burn PENDING_APPROVAL count pattern).
export function useMultisigStatusCount(status: SafeTxStatus) {
  return useQuery({
    queryKey: ['multisig', 'count', status],
    queryFn: () => fetchList({ status, page: 1, limit: 1 }),
    select: (res) => res.metadata.total,
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  })
}

export function useMultisigDetail(id: string | null) {
  return useQuery({
    queryKey: ['multisig', 'detail', id],
    queryFn: () => apiFetch<SafeTxDetail>(`/api/v1/multisig/${id}`),
    enabled: Boolean(id),
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status && !isSafeTxTerminal(status) ? 12_000 : false
    },
    refetchOnWindowFocus: true,
  })
}

// Safe meta (threshold/owners/nonce/balance). Owners drive the "is the connected
// wallet an owner?" signer gate. Refreshed rarely (changes on owner/threshold
// governance events) → long staleTime.
export function useSafes(chain?: string) {
  return useQuery({
    queryKey: ['multisig', 'safes', chain ?? 'all'],
    queryFn: () =>
      apiFetch<SafeMeta[]>(`/api/v1/multisig/safes${chain ? `?chain=${chain}` : ''}`),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  })
}

// ─── Mutations ───────────────────────────────────────────────────────────────
// Each invalidates the queue + detail so signature progress / status reflect the
// change. The on-chain step (sign / send execTransaction) happens in the page
// before these run; these only persist the result to the backend.

function useInvalidateMultisig() {
  const qc = useQueryClient()
  return (id: string) => {
    qc.invalidateQueries({ queryKey: ['multisig', 'list'] })
    qc.invalidateQueries({ queryKey: ['multisig', 'count'] })
    qc.invalidateQueries({ queryKey: ['multisig', 'detail', id] })
  }
}

export function useConfirmSignature(id: string) {
  const invalidate = useInvalidateMultisig()
  return useMutation({
    mutationFn: (body: SafeConfirmBody) =>
      apiFetch<SafeTxDetail>(`/api/v1/multisig/${id}/confirm`, {
        method: 'POST',
        body,
      }),
    onSuccess: () => invalidate(id),
  })
}

export function useExecuteSafeTx(id: string) {
  const invalidate = useInvalidateMultisig()
  return useMutation({
    mutationFn: (body: SafeExecuteBody) =>
      apiFetch<SafeTxDetail>(`/api/v1/multisig/${id}/execute`, {
        method: 'POST',
        body,
      }),
    onSuccess: () => invalidate(id),
  })
}

export function useCancelSafeTx(id: string) {
  const invalidate = useInvalidateMultisig()
  return useMutation({
    mutationFn: (body: SafeCancelBody) =>
      apiFetch<SafeTxDetail>(`/api/v1/multisig/${id}/cancel`, {
        method: 'POST',
        body,
      }),
    onSuccess: () => invalidate(id),
  })
}

// USDX-280 — propose a governance op. Backend encodes calldata + simulates +
// stores PENDING_SIGN + auto-signs 1/N. On success the new TX appears in the
// queue → invalidate list + counts. 409 SAFE_QUEUE_OCCUPIED / 422 validation /
// simulate-revert are surfaced by the caller (ProposeModal).
export function useProposeGovernance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: ProposeRequest) =>
      apiFetch<SafeTxDetail>('/api/v1/multisig/propose', { method: 'POST', body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['multisig', 'list'] })
      qc.invalidateQueries({ queryKey: ['multisig', 'count'] })
    },
  })
}
