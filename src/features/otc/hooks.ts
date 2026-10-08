import { useQuery } from '@tanstack/react-query'
import { apiFetchRaw } from '@/lib/apiFetch'
import { OTC_ACTION_STATUSES, OTC_SAFE_QUEUE_STATUSES } from '@/lib/otc'
import { isRequestTerminal } from '@/lib/status'
import type {
  PhaseOnePaginatedResponse,
  PhaseOneSuccessResponse,
  RequestDetail,
  RequestListItem,
  RequestStatus,
  RequestType,
  SafeTxListItem,
} from '@/lib/types'

/**
 * Data halaman OTC (redesain fase 1). Semua dari endpoint yang SUDAH ada:
 *   - `GET /api/v1/requests` — dua tarikan dengan `status` CSV yang tidak
 *     tumpang tindih (lihat `lib/otc.ts`)
 *   - `GET /api/v1/multisig?status=PENDING_SIGN` + `READY_TO_EXECUTE` —
 *     dicocokkan ke baris lewat `safeTxHash`
 * Ketiga endpoint ADMIN / MANAGER / DEVELOPER (`@Roles` di controller), jadi
 * halaman ini — dan tiap query di bawah — tidak dijalankan untuk STAFF.
 */

export interface OtcRequestFilters {
  statuses: readonly RequestStatus[]
  page?: number
  limit: number
  search?: string
  type?: RequestType | ''
}

function requestsQuery(f: OtcRequestFilters): string {
  const sp = new URLSearchParams()
  sp.set('status', f.statuses.join(','))
  sp.set('page', String(f.page ?? 1))
  sp.set('limit', String(f.limit))
  if (f.search) sp.set('search', f.search)
  if (f.type) sp.set('type', f.type)
  return sp.toString()
}

export function useOtcRequests(f: OtcRequestFilters, enabled = true) {
  return useQuery({
    // Di bawah ['requests'] supaya submit mint/redeem (yang meng-invalidate
    // ['requests']) langsung menyegarkan tabel ini.
    queryKey: ['requests', 'otc', f],
    queryFn: () =>
      apiFetchRaw<PhaseOnePaginatedResponse<RequestListItem>>(`/api/v1/requests?${requestsQuery(f)}`),
    enabled,
    refetchInterval: (query) =>
      (query.state.data?.data ?? []).some((r) => !isRequestTerminal(r.status)) ? 20_000 : false,
    refetchOnWindowFocus: true,
  })
}

/**
 * Antrean tanda tangan yang relevan untuk OTC. Kuncinya di bawah
 * ['multisig', 'list'] supaya tanda tangan / eksekusi / batal (yang
 * meng-invalidate ['multisig', 'list']) langsung memperbarui "x dari y".
 */
export function useOtcSafeQueue(enabled = true) {
  return useQuery({
    queryKey: ['multisig', 'list', 'otc-queue'],
    queryFn: async () => {
      const pages = await Promise.all(
        OTC_SAFE_QUEUE_STATUSES.map((status) =>
          apiFetchRaw<PhaseOnePaginatedResponse<SafeTxListItem>>(
            `/api/v1/multisig?status=${status}&page=1&limit=100`,
          ),
        ),
      )
      return pages.flatMap((p) => p.data)
    },
    enabled,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  })
}

/** Angka menu OTC: permintaan yang masih "Perlu tindakan" (dua status pertama). */
export function useOtcActionCount(opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['requests', 'otc-action-count'],
    queryFn: async () => {
      const json = await apiFetchRaw<PhaseOnePaginatedResponse<RequestListItem>>(
        `/api/v1/requests?status=${OTC_ACTION_STATUSES.join(',')}&limit=1`,
      )
      return json.metadata.total
    },
    enabled: opts.enabled ?? true,
    staleTime: 30 * 1000,
  })
}

export function useRequestDetail(id: string | null) {
  return useQuery({
    queryKey: ['requests', 'detail', id],
    queryFn: () => apiFetchRaw<PhaseOneSuccessResponse<RequestDetail>>(`/api/v1/requests/${id}`),
    enabled: Boolean(id),
    select: (res) => res.data,
    refetchInterval: (query) => {
      const status = query.state.data?.data?.status
      return status && !isRequestTerminal(status) ? 20_000 : false
    },
    refetchOnWindowFocus: true,
  })
}
