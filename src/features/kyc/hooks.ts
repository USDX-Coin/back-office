import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch, apiFetchRaw } from '@/lib/apiFetch'
import { validateKycRejectReason } from '@/lib/validators'
import type {
  KycDetail,
  KycListItem,
  KycReviewLog,
  PhaseOnePaginatedResponse,
} from '@/lib/types'

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

// ─── USDX-155 — detail / audit trail / approve / reject ───

// GET /api/v1/kyc/:id — decrypted PII + presigned photo URLs (TTL 5 min).
// EVERY call writes a `VIEWED` audit row server-side (audit-first, fail-closed
// — kyc.yaml § detail), so this query must never refetch on its own: no
// window-focus refetch, no staleness-driven refetch. Re-fetches happen only on
// explicit operator intent ("Refresh photos") via `refetch()`.
export function useKycDetail(id: string | null) {
  return useQuery({
    queryKey: ['kyc', 'detail', id],
    queryFn: () => apiFetch<KycDetail>(`/api/v1/kyc/${id}`),
    enabled: Boolean(id),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  })
}

// GET /api/v1/kyc/:id/reviews — reverse-chronological audit trail. Does NOT
// write a VIEWED row (kyc.yaml § reviewsHistory). Fetched lazily when the
// collapsible opens (`enabled`).
export function useKycReviews(id: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['kyc', 'reviews', id],
    queryFn: () => apiFetch<KycReviewLog[]>(`/api/v1/kyc/${id}/reviews`),
    enabled: Boolean(id) && enabled,
  })
}

// Shared post-mutation cache work for approve/reject:
// - drop the detail + reviews cache for this id WITHOUT refetching (a refetch
//   would write a pointless VIEWED row — the modal closes on success anyway)
// - invalidate the list + pending-count so the table and the sidebar (N)
//   badge refresh (the USDX-154 AC "badge refresh setelah approve/reject")
function useInvalidateAfterReview() {
  const qc = useQueryClient()
  return (id: string) => {
    qc.removeQueries({ queryKey: ['kyc', 'detail', id] })
    qc.removeQueries({ queryKey: ['kyc', 'reviews', id] })
    qc.invalidateQueries({ queryKey: ['kyc', 'list'] })
    qc.invalidateQueries({ queryKey: ['kyc', 'pending-count'] })
  }
}

// POST /api/v1/kyc/:id/approve — Staff/Manager/Admin; only valid on PENDING
// (else 409 INVALID_STATUS). Returns the updated KycListItem.
export function useApproveKyc() {
  const invalidate = useInvalidateAfterReview()
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<KycListItem>(`/api/v1/kyc/${id}/approve`, { method: 'POST' }),
    onSuccess: (_data, id) => invalidate(id),
  })
}

// POST /api/v1/kyc/:id/reject — body { reason } (1..500 chars, visible to the
// user + sent in the kyc-rejected email).
export function useRejectKyc() {
  const invalidate = useInvalidateAfterReview()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => {
      // USDX-610 — diperiksa DI SINI, bukan hanya di dialognya, dan penempatan itu
      // intinya: gerbang yang hanya ada di dialog dilewati pemanggil mana pun yang
      // lain (aksi massal, pintasan papan ketik, penolong tes), dan yang sampai ke
      // nasabah lewat email `kyc-rejected.html` adalah alasan sepanjang satu huruf.
      // Menolak sebelum permintaan dikirim juga menjaga teks yang sudah diketik
      // petugas tetap di layar. Server juga menolaknya; ini bagian front end,
      // bukan pengganti bagian itu.
      const check = validateKycRejectReason(reason)
      if (!check.valid) return Promise.reject(new Error(check.error))
      return apiFetch<KycListItem>(`/api/v1/kyc/${id}/reject`, {
        method: 'POST',
        body: { reason: check.reason },
      })
    },
    onSuccess: (_data, { id }) => invalidate(id),
  })
}
