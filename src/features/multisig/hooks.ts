import { useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch, apiFetchRaw } from '@/lib/apiFetch'
import { isSafeTxTerminal } from '@/lib/multisig/status'
import { invalidateMoneyFlowViews, MONEY_FLOW_STALE_TIME } from '@/lib/moneyFlowViews'
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

/** Poll detail biasa selama transaksi belum final. */
export const SAFE_TX_DETAIL_POLL_MS = 12_000
/**
 * Poll detail selama CONFIRMING (eksekusi sudah dikirim, menunggu jaringan):
 * operator sedang menatap tombol yang baru ia tekan, dan konfirmasi Polygon
 * datang dalam hitungan detik, bukan menit.
 */
export const SAFE_TX_CONFIRMING_POLL_MS = 5_000

export function multisigDetailPollInterval(status: SafeTxStatus | undefined): number | false {
  if (!status || isSafeTxTerminal(status)) return false
  return status === 'CONFIRMING' ? SAFE_TX_CONFIRMING_POLL_MS : SAFE_TX_DETAIL_POLL_MS
}

export function useMultisigDetail(id: string | null) {
  const qc = useQueryClient()
  const query = useQuery({
    queryKey: ['multisig', 'detail', id],
    queryFn: () => apiFetch<SafeTxDetail>(`/api/v1/multisig/${id}`),
    enabled: Boolean(id),
    // Membuka ulang modal selalu menarik ulang (lib/moneyFlowViews).
    staleTime: MONEY_FLOW_STALE_TIME,
    refetchInterval: (query) => multisigDetailPollInterval(query.state.data?.status),
    refetchOnWindowFocus: true,
  })

  // Saat poll mendapati transaksi ini baru saja FINAL (biasanya CONFIRMING →
  // EXECUTED), order / permintaan OTC di belakangnya ikut berubah di server —
  // tapi tidak ada mutasi di klien yang menandainya. Sebarkan ke layar alur
  // uang lain supaya Transaksi / OTC tidak menunggu poll-nya sendiri.
  const status = query.data?.status
  const linkedOrderId = query.data?.linkedOrderId
  const prev = useRef<{ id: string | null; status: SafeTxStatus | undefined }>({ id, status })
  useEffect(() => {
    const before = prev.current
    prev.current = { id, status }
    if (
      before.id === id &&
      before.status &&
      status &&
      !isSafeTxTerminal(before.status) &&
      isSafeTxTerminal(status)
    ) {
      invalidateMoneyFlowViews(qc, { orderId: linkedOrderId })
    }
  }, [id, status, linkedOrderId, qc])

  return query
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
// Each refreshes the detail of the posted id, then every money-flow view (queue,
// counts, Transaksi, OTC, sidebar badges — lib/moneyFlowViews): signing or
// executing a mint moves the order behind it, which `['multisig', …]` alone
// never reached. The on-chain step (sign / send execTransaction) happens in the
// page before these run; these only persist the result to the backend.

function useInvalidateMultisig() {
  const qc = useQueryClient()
  return (id: string, fresh: SafeTxDetail | undefined) => {
    qc.invalidateQueries({ queryKey: ['multisig', 'detail', id] })
    // Rincian order hanya untuk order di balik transaksi ini (bila ada).
    invalidateMoneyFlowViews(qc, { orderId: fresh?.linkedOrderId })
  }
}

// id ikut sebagai VARIABEL mutasi, bukan dari closure hook: hasil wallet
// (tanda tangan / hash eksekusi) harus dikirim ke transaksi yang ditandatangani,
// walau baris yang tampil sudah berganti selama wallet terbuka (verifikator
// netral 11 Okt 2026).
export function useConfirmSignature() {
  const invalidate = useInvalidateMultisig()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: SafeConfirmBody }) =>
      apiFetch<SafeTxDetail>(`/api/v1/multisig/${id}/confirm`, {
        method: 'POST',
        body,
      }),
    onSuccess: (data, { id }) => invalidate(id, data),
  })
}

export function useExecuteSafeTx() {
  const invalidate = useInvalidateMultisig()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: SafeExecuteBody }) =>
      apiFetch<SafeTxDetail>(`/api/v1/multisig/${id}/execute`, {
        method: 'POST',
        body,
      }),
    onSuccess: (data, { id }) => invalidate(id, data),
  })
}

export function useCancelSafeTx() {
  const invalidate = useInvalidateMultisig()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: SafeCancelBody }) =>
      apiFetch<SafeTxDetail>(`/api/v1/multisig/${id}/cancel`, {
        method: 'POST',
        body,
      }),
    onSuccess: (data, { id }) => invalidate(id, data),
  })
}

// USDX-280 — propose a governance op. Backend encodes calldata + simulates +
// stores PENDING_SIGN + auto-signs 1/N. On success the new TX appears in the
// queue → invalidate the money-flow views (queue + counts included; the Safe
// queue it occupies is shown on OTC too). 409 SAFE_QUEUE_OCCUPIED / 422
// validation / simulate-revert are surfaced by the caller (ProposeModal).
export function useProposeGovernance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: ProposeRequest) =>
      apiFetch<SafeTxDetail>('/api/v1/multisig/propose', { method: 'POST', body }),
    onSuccess: () => invalidateMoneyFlowViews(qc),
  })
}
