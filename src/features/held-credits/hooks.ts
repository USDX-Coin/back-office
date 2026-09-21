import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { QUEUE_COUNTS_KEY } from '@/features/queue-counts/hooks'
import { APPROVALS_LIST_KEY } from '@/features/approvals/hooks'
import type { ApprovalRequest } from '@/features/approvals/types'
import { ApiError, apiFetch, apiFetchRaw } from '@/lib/apiFetch'
import type { PhaseOnePaginatedResponse } from '@/lib/types'
import { isStaleHeldCreditError } from './labels'
import {
  HELD_RESOLVE_REASON_MAX,
  HELD_RESOLVE_REASON_MIN,
  type HeldCreditDetail,
  type HeldCreditListItem,
  type HeldCreditResolution,
  type ResolveHeldCreditBody,
  type ResolvedHeldCredit,
} from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Mint Bermasalah — `/api/v1/held-credits` (USDX-341 + USDX-486).
//
//   GET  list + detail  STAFF / MANAGER / ADMIN / DEVELOPER
//   POST resolve        STAFF / MANAGER / ADMIN
//
// DILAYANI MSW sampai api-dev menyajikan modulnya; rutenya sengaja TIDAK
// terdaftar di `INTEGRATION_PATHS`.
// ─────────────────────────────────────────────────────────────────────────────

const HELD_PATH = '/api/v1/held-credits'

export const HELD_CREDITS_LIST_KEY = ['held-credits', 'list'] as const

interface HeldCreditFilters {
  page?: number
  /** Nama parameter kontraknya `take` (cap 100, bawaan 10). */
  take?: number
}

/**
 * `GET /api/v1/held-credits` — antrean TERBUKA, kredit terlama dulu.
 *
 * `ListHeldCreditsDto` hanya menerima `page` + `take`: tidak ada saringan sama
 * sekali, dan itu bukan kelalaian layar ini. Karena itu tidak ada popover
 * Filter di halamannya — memasangnya berarti menulis parameter yang dibuang
 * diam-diam oleh ValidationPipe, dan operator akan mengira antreannya menyusut.
 */
export function useHeldCredits(filters: HeldCreditFilters) {
  const sp = new URLSearchParams()
  if (filters.page !== undefined) sp.set('page', String(filters.page))
  if (filters.take !== undefined) sp.set('take', String(filters.take))
  return useQuery({
    queryKey: ['held-credits', 'list', filters],
    queryFn: () =>
      apiFetchRaw<PhaseOnePaginatedResponse<HeldCreditListItem>>(`${HELD_PATH}?${sp.toString()}`),
    refetchOnWindowFocus: false,
  })
}

export function useHeldCreditDetail(id: string | null) {
  return useQuery({
    queryKey: ['held-credits', 'detail', id],
    queryFn: () => apiFetch<HeldCreditDetail>(`${HELD_PATH}/${id}`),
    enabled: Boolean(id),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  })
}

// ─── Dua jawaban untuk satu permintaan ──────────────────────────────────────

export type ResolveOutcome =
  | { outcome: 'EXECUTED'; result: ResolvedHeldCredit }
  | { outcome: 'PENDING_APPROVAL'; approval: ApprovalRequest }

/**
 * Membedakan "sudah selesai" dari "menunggu orang kedua".
 *
 * Backend membedakannya dengan KODE HTTP: `200` = selesai, `202` = sebuah
 * usulan dibuat dan menunggu `POST /api/v1/approvals/{id}/approve`. Kode itu
 * TIDAK sampai ke sini: `apiFetch` / `apiFetchRaw` hanya mengembalikan badan
 * responsnya, dan berkas itu bukan milik tiket ini untuk diubah.
 *
 * Jadi pembedanya BADAN, dan itu aman karena kedua bentuk saling lepas:
 * jawaban selesai punya `creditId` dan tidak punya `actionType`; usulan punya
 * `actionType` + `expiresAt` dan tidak punya `creditId`. Bentuk yang BUKAN
 * keduanya dilempar sebagai galat, bukan ditebak ke salah satu arah — menebak
 * "sudah selesai" atas usulan yang sebenarnya menggantung adalah kebohongan ke
 * arah yang paling mahal: operator berhenti menunggu padahal uangnya belum
 * bergerak.
 */
export function interpretResolveResponse(data: unknown): ResolveOutcome {
  if (data && typeof data === 'object') {
    const body = data as Record<string, unknown>
    if (typeof body.creditId === 'string' && typeof body.resolution === 'string') {
      return { outcome: 'EXECUTED', result: data as ResolvedHeldCredit }
    }
    if (typeof body.actionType === 'string' && typeof body.expiresAt === 'string') {
      return { outcome: 'PENDING_APPROVAL', approval: data as ApprovalRequest }
    }
  }
  throw new Error(
    'Jawaban server tidak dikenali — tidak jelas apakah kredit ini sudah diselesaikan atau sedang menunggu persetujuan. Jangan mencoba lagi sebelum memeriksa antrean dan Persetujuan Orang Kedua.'
  )
}

// ─── Validasi isian ─────────────────────────────────────────────────────────

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface ResolveFormInput {
  action: HeldCreditResolution
  /** Diisi operator; kosong = pakai order pilihan mesin (kalau ada). */
  orderId: string
  reason: string
}

export interface ResolveFormErrors {
  orderId?: string
  reason?: string
}

export type BuildResolveResult =
  | { valid: true; body: ResolveHeldCreditBody }
  | { valid: false; errors: ResolveFormErrors }

/**
 * Divalidasi DI SINI, bukan hanya di dialog: gerbang yang cuma hidup di dialog
 * dilewati pemanggil kedua, dan alasan yang salah masuk ke jejak append-only
 * `bni_notification_reviews` yang tidak bisa diperbaiki.
 *
 * `orderId` HANYA dikirim kalau operator benar-benar mengetiknya. Mengirim
 * ulang id order pilihan mesin bukan tindakan netral: di server, `orderId` yang
 * BERBEDA dari pilihan mesin memaksa usulan orang kedua (`forceApproval`),
 * sementara yang sama dengannya lolos gerbang — jadi field ini menentukan
 * jalur, bukan sekadar isi.
 */
export function buildResolveBody(input: ResolveFormInput): BuildResolveResult {
  const errors: ResolveFormErrors = {}
  const reason = input.reason.trim()
  if (reason.length < HELD_RESOLVE_REASON_MIN) {
    errors.reason = `Alasan wajib diisi, minimal ${HELD_RESOLVE_REASON_MIN} karakter.`
  } else if (reason.length > HELD_RESOLVE_REASON_MAX) {
    errors.reason = `Alasan maksimal ${HELD_RESOLVE_REASON_MAX} karakter.`
  }

  const orderId = input.orderId.trim()
  if (input.action === 'PAID' && orderId.length > 0 && !UUID_PATTERN.test(orderId)) {
    errors.orderId = 'Id order harus berbentuk UUID — salin dari layar Transaksi Nasabah.'
  }

  if (Object.keys(errors).length > 0) return { valid: false, errors }

  const body: ResolveHeldCreditBody = { action: input.action, reason }
  if (input.action === 'PAID' && orderId.length > 0) body.orderId = orderId
  return { valid: true, body }
}

// ─── Mutasi ─────────────────────────────────────────────────────────────────

function invalidateAfterResolve(qc: ReturnType<typeof useQueryClient>, id: string) {
  qc.invalidateQueries({ queryKey: HELD_CREDITS_LIST_KEY })
  qc.invalidateQueries({ queryKey: ['held-credits', 'detail', id] })
  // Order yang sama dirender layar Transaksi Nasabah.
  qc.invalidateQueries({ queryKey: ['orders'] })
  // Kredit di atas ambang melahirkan usulan — antrean persetujuan ikut berubah.
  qc.invalidateQueries({ queryKey: APPROVALS_LIST_KEY })
  // Badge sidebar — DUA angka sekaligus berubah di sini (`heldCreditsOpen` dan,
  // lewat usulan yang lahir, `approvalsOpen`). Tanpa baris ini keduanya membeku
  // sampai halaman di-reload: `Sidebar` tidak pernah unmount dan `useQueueCounts`
  // tidak me-refetch saat fokus.
  qc.invalidateQueries({ queryKey: QUEUE_COUNTS_KEY })
}

export function useResolveHeldCredit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: ResolveFormInput }) => {
      const result = buildResolveBody(input)
      if (!result.valid) {
        throw new Error(result.errors.reason ?? result.errors.orderId ?? 'Isian tidak valid')
      }
      const data = await apiFetch<unknown>(`${HELD_PATH}/${id}/resolve`, {
        method: 'POST',
        body: result.body,
      })
      return interpretResolveResponse(data)
    },
    onSuccess: (_result, { id }) => invalidateAfterResolve(qc, id),
    onError: (err, { id }) => {
      if (err instanceof ApiError && isStaleHeldCreditError(err.code)) {
        invalidateAfterResolve(qc, id)
      }
    },
  })
}
