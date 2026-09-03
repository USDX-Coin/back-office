import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { apiFetch, apiFetchRaw } from '@/lib/apiFetch'
import { isSafeTxTerminal, SAFE_TX_COUNTED_STATUSES } from '@/lib/multisig/status'
import {
  invalidateMoneyFlowViews,
  POLL_ACTIVE_MS,
  POLL_BADGE_MS,
} from '@/lib/queryConfig'
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

/**
 * Poll while any row is still in-flight (PENDING_SIGN / READY_TO_EXECUTE /
 * CONFIRMING) so signature progress + status move without a manual refresh, and
 * stop dead once every row has settled. Exported so the "settled data stops
 * polling" rule is asserted directly instead of through a timer.
 */
export function multisigListPollInterval(
  rows: Pick<SafeTxListItem, 'status'>[] | undefined,
): number | false {
  return (rows ?? []).some((r) => !isSafeTxTerminal(r.status)) ? POLL_ACTIVE_MS : false
}

export function useMultisigList(filters: MultisigListFilters) {
  return useQuery({
    queryKey: ['multisig', 'list', filters],
    queryFn: () => fetchList(filters),
    refetchInterval: (query) => multisigListPollInterval(query.state.data?.data),
    refetchOnWindowFocus: true,
  })
}

/**
 * Badge cadence, staggered a second apart per counted status.
 *
 * Three tab counts on one page is three queries, and on a shared interval they
 * fire in the same tick as each other AND as the 5s queue/detail polls — five
 * requests inside one 1-second throttle window (`sot/conventions.md`
 * § Rate Limiting (Redis) caps a user at 5/s). Offsetting them by a second each
 * costs nothing in sustained traffic and cuts the peak to three, which is the
 * headroom the throttle is supposed to have.
 */
export function multisigCountPollInterval(status: SafeTxStatus): number {
  const slot = Math.max(0, SAFE_TX_COUNTED_STATUSES.indexOf(status))
  return POLL_BADGE_MS + slot * 1_000
}

// Lightweight per-status count for the tab "(N)" badges. limit=1 → we only read
// metadata.total (mirrors the sidebar mint/burn PENDING_APPROVAL count pattern).
export function useMultisigStatusCount(status: SafeTxStatus) {
  return useQuery({
    queryKey: ['multisig', 'count', status],
    queryFn: () => fetchList({ status, page: 1, limit: 1 }),
    select: (res) => res.metadata.total,
    // Badges, not the number an operator acts on, so they get the longest
    // leash. Any multisig mutation busts them immediately regardless
    // (applySafeTxResult below).
    refetchInterval: multisigCountPollInterval(status),
    refetchOnWindowFocus: true,
  })
}

/**
 * The open drawer is what the operator is staring at, so it polls at the active
 * cadence — and stops the moment the transaction reaches a terminal state.
 */
export function multisigDetailPollInterval(
  status: SafeTxStatus | undefined,
): number | false {
  return status && !isSafeTxTerminal(status) ? POLL_ACTIVE_MS : false
}

export function useMultisigDetail(id: string | null) {
  return useQuery({
    queryKey: ['multisig', 'detail', id],
    queryFn: () => apiFetch<SafeTxDetail>(`/api/v1/multisig/${id}`),
    enabled: Boolean(id),
    refetchInterval: (query) => multisigDetailPollInterval(query.state.data?.status),
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
// The on-chain step (sign / send execTransaction) happens in the page before
// these run; these persist the result to the backend and then make the whole
// desk agree with it.

/**
 * Land a mutation's own response and fan the change out.
 *
 * Three things happen, in this order, and the order matters:
 *
 *  1. `cancelQueries` on the detail. A poll that started BEFORE the POST landed
 *     would otherwise resolve AFTER it and overwrite the fresh detail with the
 *     pre-action snapshot — the operator watches the panel snap back to
 *     "1/2 · Sign" a second after signing. Cancelling first is the documented
 *     way to make a direct cache write survive an in-flight fetch.
 *  2. `setQueryData` with the payload the backend just returned. Confirm /
 *     execute / cancel all answer with the full `SafeTxDetail`, so the drawer
 *     reflects the action on the very next render instead of one round-trip
 *     later. `invalidateQueries` alone leaves a visible window in which the
 *     signer row and the Sign button still describe the world before the click.
 *
 *     Note what is deliberately NOT here: a re-invalidation of this same detail.
 *     The response we just stored IS the endpoint's own answer, so re-fetching
 *     it buys nothing, costs a request per action, and on a lagging read replica
 *     would snap the panel back to the pre-action state a moment after the
 *     operator saw it update. The 5s poll (which keeps running while the
 *     transaction is non-terminal) picks up anything that moves afterwards.
 *  3. Invalidate the multisig queue and badges, then every OTHER view of the
 *     same money event. Signing a mint moves the consumer order on
 *     /transactions and the OTC request behind it; those pages read `['orders']`
 *     and `['requests']`, which no amount of `['multisig', …]` invalidation
 *     ever touched.
 */
function applySafeTxResult(qc: QueryClient, id: string, fresh: SafeTxDetail): Promise<void> {
  return qc.cancelQueries({ queryKey: ['multisig', 'detail', id] }).then(() => {
    qc.setQueryData(['multisig', 'detail', id], fresh)
    void qc.invalidateQueries({ queryKey: ['multisig', 'list'] })
    void qc.invalidateQueries({ queryKey: ['multisig', 'count'] })
    invalidateMoneyFlowViews(qc)
  })
}

function useApplySafeTxResult(id: string) {
  const qc = useQueryClient()
  return (fresh: SafeTxDetail) => applySafeTxResult(qc, id, fresh)
}

export function useConfirmSignature(id: string) {
  const apply = useApplySafeTxResult(id)
  return useMutation({
    mutationFn: (body: SafeConfirmBody) =>
      apiFetch<SafeTxDetail>(`/api/v1/multisig/${id}/confirm`, {
        method: 'POST',
        body,
      }),
    onSuccess: apply,
  })
}

export function useExecuteSafeTx(id: string) {
  const apply = useApplySafeTxResult(id)
  return useMutation({
    mutationFn: (body: SafeExecuteBody) =>
      apiFetch<SafeTxDetail>(`/api/v1/multisig/${id}/execute`, {
        method: 'POST',
        body,
      }),
    onSuccess: apply,
  })
}

export function useCancelSafeTx(id: string) {
  const apply = useApplySafeTxResult(id)
  return useMutation({
    mutationFn: (body: SafeCancelBody) =>
      apiFetch<SafeTxDetail>(`/api/v1/multisig/${id}/cancel`, {
        method: 'POST',
        body,
      }),
    onSuccess: apply,
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
