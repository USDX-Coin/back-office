import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { QUEUE_COUNTS_KEY } from '@/features/queue-counts/hooks'
import { ApiError, apiFetch, apiFetchRaw } from '@/lib/apiFetch'
import type { PhaseOnePaginatedResponse } from '@/lib/types'
import { isStaleApprovalError } from './labels'
import {
  APPROVAL_REASON_MAX,
  APPROVAL_REASON_MIN,
  type ApprovalFilters,
  type ApprovalRequest,
} from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Persetujuan Orang Kedua — `/api/v1/approvals` (USDX-486).
//
//   GET  list + detail   STAFF / MANAGER / ADMIN / DEVELOPER
//   POST approve|reject  MANAGER / ADMIN
//
// DILAYANI MSW sampai api-dev menyajikan modulnya; rutenya sengaja TIDAK
// terdaftar di `INTEGRATION_PATHS`.
// ─────────────────────────────────────────────────────────────────────────────

const APPROVALS_PATH = '/api/v1/approvals'

export const APPROVALS_LIST_KEY = ['approvals', 'list'] as const

export function buildApprovalsQuery(filters: ApprovalFilters): string {
  const sp = new URLSearchParams()
  if (filters.page !== undefined) sp.set('page', String(filters.page))
  if (filters.take !== undefined) sp.set('take', String(filters.take))
  if (filters.status) sp.set('status', filters.status)
  if (filters.actionType) sp.set('actionType', filters.actionType)
  return sp.toString()
}

export function useApprovals(filters: ApprovalFilters) {
  return useQuery({
    queryKey: ['approvals', 'list', filters],
    queryFn: () =>
      apiFetchRaw<PhaseOnePaginatedResponse<ApprovalRequest>>(
        `${APPROVALS_PATH}?${buildApprovalsQuery(filters)}`
      ),
    refetchOnWindowFocus: false,
  })
}

/**
 * Satu usulan. `staleTime: Infinity` + tanpa refetch fokus: penyetuju sedang
 * membaca isi yang akan ia setujui, dan isi yang berganti sendiri di bawah
 * matanya adalah persis kegagalan yang payload beku (trigger 0066) cegah di
 * sisi server.
 */
export function useApprovalDetail(id: string | null) {
  return useQuery({
    queryKey: ['approvals', 'detail', id],
    queryFn: () => apiFetch<ApprovalRequest>(`${APPROVALS_PATH}/${id}`),
    enabled: Boolean(id),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  })
}

function invalidateAfterDecision(qc: ReturnType<typeof useQueryClient>, id: string) {
  qc.invalidateQueries({ queryKey: APPROVALS_LIST_KEY })
  qc.invalidateQueries({ queryKey: ['approvals', 'detail', id] })
  // Usulan yang disetujui MENJALANKAN aksinya, jadi layar asal aksinya ikut basi.
  qc.invalidateQueries({ queryKey: ['held-credits'] })
  qc.invalidateQueries({ queryKey: ['payout-controls'] })
  // Badge sidebar. Tanpa baris ini angkanya membeku sampai halaman di-reload:
  // `Sidebar` dirender tanpa syarat di `MainLayout` jadi tidak pernah unmount,
  // dan `useQueueCounts` memakai `refetchOnWindowFocus: false` — `staleTime`
  // hanya berlaku saat mount/fokus, bukan sebagai timer. Badge yang tidak pernah
  // bisa dikosongkan adalah badge yang berhenti dibaca.
  qc.invalidateQueries({ queryKey: QUEUE_COUNTS_KEY })
}

export type ApprovalDecision = 'APPROVE' | 'REJECT'

/**
 * Alasan divalidasi DI SINI, bukan hanya di dialog. Gerbang yang cuma hidup di
 * satu dialog dilewati pemanggil kedua — dan `decision_reason` beku setelah
 * ditulis (trigger 0066), jadi alasan yang telanjur salah tidak bisa diperbaiki.
 *
 * Menyetujui: alasan OPSIONAL — "saya setuju" sudah terekam penuh oleh identitas
 * + waktu putusan. Menolak: alasan WAJIB — penolakan tidak meninggalkan jejak
 * akibat apa pun, jadi alasannya satu-satunya yang tersisa untuk dibaca orang
 * berikutnya yang bertanya "kenapa ini tidak jadi".
 */
export function validateDecisionReason(
  decision: ApprovalDecision,
  reason: string
): string | null {
  const trimmed = reason.trim()
  if (decision === 'APPROVE') {
    if (trimmed.length === 0) return null
    if (trimmed.length > APPROVAL_REASON_MAX) {
      return `Alasan maksimal ${APPROVAL_REASON_MAX} karakter.`
    }
    return null
  }
  if (trimmed.length < APPROVAL_REASON_MIN) {
    return `Alasan penolakan wajib diisi, minimal ${APPROVAL_REASON_MIN} karakter.`
  }
  if (trimmed.length > APPROVAL_REASON_MAX) {
    return `Alasan maksimal ${APPROVAL_REASON_MAX} karakter.`
  }
  return null
}

export function useDecideApproval() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      decision,
      reason,
    }: {
      id: string
      decision: ApprovalDecision
      reason: string
    }) => {
      const invalid = validateDecisionReason(decision, reason)
      if (invalid) return Promise.reject(new Error(invalid))
      const trimmed = reason.trim()
      const path = decision === 'APPROVE' ? 'approve' : 'reject'
      // Menyetujui tanpa alasan mengirim badan KOSONG, bukan `reason: ""` —
      // `@MaxLength` lolos untuk string kosong, tapi menyimpan alasan kosong
      // sebagai alasan mengaburkan "tidak ditulis" dengan "ditulis kosong".
      const body =
        decision === 'APPROVE' && trimmed.length === 0 ? {} : { reason: trimmed }
      return apiFetch<ApprovalRequest>(`${APPROVALS_PATH}/${id}/${path}`, {
        method: 'POST',
        body,
      })
    },
    onSuccess: (_result, { id }) => invalidateAfterDecision(qc, id),
    onError: (err, { id }) => {
      // Server bilang keadaannya sudah berubah → tarik ulang, supaya layar tidak
      // terus menawarkan keputusan atas usulan yang sudah tidak menunggu.
      if (err instanceof ApiError && isStaleApprovalError(err.code)) {
        invalidateAfterDecision(qc, id)
      }
    },
  })
}
