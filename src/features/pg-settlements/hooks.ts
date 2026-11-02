import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch, apiFetchRaw } from '@/lib/apiFetch'
import { isPgSettlementStaleError, validatePgReason } from '@/lib/pgSettlements'
import type {
  MatchPgSettlementBody,
  PgSettlementBatch,
  PgSettlementBatchDetail,
  PgSettlementSettings,
  PgSettlementStatus,
  PhaseOnePaginatedResponse,
  UpdatePgSettlementSettingsBody,
} from '@/lib/types'

// ─────────────────────────────────────────────────────────────────────────────
// D29 — Pencairan PG T+1 + pengaturannya (`sot/api/pg-settlements.yaml`, § 21.8).
//
//   GET list, detail, settings   STAFF / MANAGER / ADMIN / DEVELOPER
//   POST match-manual, PUT settings   MANAGER / ADMIN
//
// Backendnya USDX-791 BELUM ada (`GET /api/v1/pg-settlements` 404 di api-dev, 2 Nov 2026). Layar
// dikerjakan dari kontrak + MSW; build yang di-deploy memanggil server sungguhan,
// jadi merge SETELAH backend naik (`pnpm cek:backend`).
// ─────────────────────────────────────────────────────────────────────────────

const PATH = '/api/v1/pg-settlements'
const SETTINGS_PATH = '/api/v1/pg-settlement-settings'
export const PG_SETTINGS_KEY = ['pg-settlement-settings'] as const

export function usePgSettlements(filters: { page: number; take: number; status?: PgSettlementStatus }) {
  const sp = new URLSearchParams({ page: String(filters.page), take: String(filters.take) })
  if (filters.status) sp.set('status', filters.status)
  return useQuery({
    queryKey: ['pg-settlements', 'list', filters],
    queryFn: () => apiFetchRaw<PhaseOnePaginatedResponse<PgSettlementBatch>>(`${PATH}?${sp}`),
    refetchOnWindowFocus: false,
  })
}

export function usePgSettlementDetail(id: string | null) {
  return useQuery({
    queryKey: ['pg-settlements', 'detail', id],
    queryFn: () => apiFetch<PgSettlementBatchDetail>(`${PATH}/${id}`),
    enabled: Boolean(id),
    refetchOnWindowFocus: false,
    retry: false,
  })
}

function invalidateBatches(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['pg-settlements'] })
  qc.invalidateQueries({ queryKey: ['queue-counts'] })
  // Untung order di dalam batch menjadi final (§ 21.8) — detail swap ikut basi.
  qc.invalidateQueries({ queryKey: ['mint-swaps'] })
}

/** `POST …/:id/match-manual` — alasan ≥ 10 ditegakkan di sini juga, bukan hanya di dialog. */
export function useMatchPgSettlement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: MatchPgSettlementBody }) => {
      const reason = validatePgReason(body.reason)
      if (reason.error) return Promise.reject(new Error(reason.error))
      if (!body.creditEntryId) return Promise.reject(new Error('Pilih satu kredit dari mutasi.'))
      return apiFetch<PgSettlementBatch>(`${PATH}/${id}/match-manual`, {
        method: 'POST',
        body: { creditEntryId: body.creditEntryId, reason: reason.value },
      })
    },
    onSuccess: () => invalidateBatches(qc),
    onError: (err) => {
      if (isPgSettlementStaleError(err)) invalidateBatches(qc)
    },
  })
}

export function usePgSettlementSettings() {
  return useQuery({
    queryKey: PG_SETTINGS_KEY,
    queryFn: () => apiFetch<PgSettlementSettings>(SETTINGS_PATH),
  })
}

export function useUpdatePgSettlementSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: UpdatePgSettlementSettingsBody) =>
      apiFetch<PgSettlementSettings>(SETTINGS_PATH, { method: 'PUT', body }),
    onSettled: () => qc.invalidateQueries({ queryKey: PG_SETTINGS_KEY }),
  })
}
