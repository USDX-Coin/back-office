import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch, apiFetchRaw } from '@/lib/apiFetch'
import { buildResolveBody, isStaleStateError, type ResolveFormInput } from '@/lib/payoutFailures'
import type {
  PayoutFailureDetail,
  PayoutFailureListItem,
  PayoutIssueKind,
  PhaseOnePaginatedResponse,
  ResolvePayoutFailureResult,
} from '@/lib/types'

// ─────────────────────────────────────────────────────────────────────────────
// USDX-662 — Pencairan Bermasalah (`sot/api/payout-failures.yaml`, § 17).
//
// DILAYANI MSW di browser sampai api-dev menyajikan modul USDX-471 (lihat
// `src/mocks/browser.ts`). Matriks peran sisi server:
//   BACA     antrean / detail      STAFF, MANAGER, ADMIN, DEVELOPER
//   RESOLVE  RESENT/SETTLED/CLOSED MANAGER, ADMIN  (STAFF & DEV 403)
//
// SETIAP pembacaan — list DAN detail — menulis `pii_access_audit` di server (satu
// baris per order yang rekeningnya dirender). Karena itu tidak ada query di sini
// yang menembak sendiri saat jendela kembali fokus: refetch latar belakang
// mengarang jejak audit yang tidak diminta siapa pun.
// ─────────────────────────────────────────────────────────────────────────────

const QUEUE_PATH = '/api/v1/payout-failures'

interface PayoutFailureFilters {
  page?: number
  /** Nama parameter kontraknya `take`; jawabannya tetap `metadata.limit`. */
  take?: number
  /** Kosong = ketiga populasi (satu layar, D22-b). */
  issueKind?: PayoutIssueKind
}

function buildQuery(filters: PayoutFailureFilters): string {
  const sp = new URLSearchParams()
  if (filters.page !== undefined) sp.set('page', String(filters.page))
  if (filters.take !== undefined) sp.set('take', String(filters.take))
  if (filters.issueKind) sp.set('issueKind', filters.issueKind)
  return sp.toString()
}

/** `GET /api/v1/payout-failures` — antrean TERBUKA, terlama dulu (urutan server, tanpa parameter). */
export function usePayoutFailures(filters: PayoutFailureFilters) {
  return useQuery({
    queryKey: ['payout-failures', 'list', filters],
    queryFn: () =>
      apiFetchRaw<PhaseOnePaginatedResponse<PayoutFailureListItem>>(
        `${QUEUE_PATH}?${buildQuery(filters)}`,
      ),
    refetchOnWindowFocus: false,
  })
}

/**
 * Badge `(N)` — jumlah antrean terbuka menurut `metadata.total`. `take=1` tetap
 * menulis satu baris audit per tarikan, jadi `staleTime` menahannya dari tiap
 * perpindahan halaman.
 */
export function useOpenPayoutFailureCount() {
  return useQuery({
    queryKey: ['payout-failures', 'open-count'],
    queryFn: async () => {
      const json = await apiFetchRaw<PhaseOnePaginatedResponse<PayoutFailureListItem>>(
        `${QUEUE_PATH}?take=1`,
      )
      return json.metadata.total
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

/**
 * `GET /api/v1/payout-failures/:id` — satu request, satu keputusan. `enabled`
 * dipegang pemanggil (detail dibuka), tanpa refetch fokus/reconnect/basi —
 * disiplin `useRedeemApprovalDetail` / `useKycDetail`. Setelah resolve ia
 * SENGAJA ditarik ulang (lihat `invalidateAfterResolve`): jejak resolusi yang
 * baru harus tampil, dan itu satu pembacaan yang memang diminta.
 */
export function usePayoutFailureDetail(id: string | null) {
  return useQuery({
    queryKey: ['payout-failures', 'detail', id],
    queryFn: () => apiFetch<PayoutFailureDetail>(`${QUEUE_PATH}/${id}`),
    enabled: Boolean(id),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  })
}

/**
 * Kunci cache yang basi saat satu order keluar dari antrean — atau saat server
 * bilang keadaannya sudah berubah (409 ALREADY_RESOLVED dsb.). `['orders']` ikut
 * karena order yang sama dirender layar User Transaction.
 */
function invalidateAfterResolve(qc: ReturnType<typeof useQueryClient>, id: string) {
  qc.invalidateQueries({ queryKey: ['payout-failures', 'list'] })
  qc.invalidateQueries({ queryKey: ['payout-failures', 'open-count'] })
  qc.invalidateQueries({ queryKey: ['payout-failures', 'detail', id] })
  qc.invalidateQueries({ queryKey: ['orders'] })
}

/**
 * `POST /api/v1/payout-failures/:id/resolve`.
 *
 * Form divalidasi DI SINI juga, bukan hanya di dialog: gerbang yang hanya hidup di
 * dialog dilewati pemanggil lain, dan alasan < 10 karakter atau `SETTLED_MANUAL`
 * tanpa bukti transfer masuk ke jejak append-only yang tidak bisa diperbaiki.
 */
export function useResolvePayoutFailure() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ResolveFormInput }) => {
      const result = buildResolveBody(input)
      if (!result.valid) {
        const message = result.errors.reason ?? result.errors.externalRef ?? 'Isian tidak valid'
        return Promise.reject(new Error(message))
      }
      return apiFetch<ResolvePayoutFailureResult>(`${QUEUE_PATH}/${id}/resolve`, {
        method: 'POST',
        body: result.body,
      })
    },
    onSuccess: (_result, { id }) => invalidateAfterResolve(qc, id),
    onError: (err, { id }) => {
      if (isStaleStateError(err)) invalidateAfterResolve(qc, id)
    },
  })
}
