import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { APPROVALS_LIST_KEY } from '@/features/approvals/hooks'
import type { ApprovalRequest } from '@/features/approvals/types'
import { apiFetch, apiFetchRaw } from '@/lib/apiFetch'
import type { PhaseOnePaginatedResponse } from '@/lib/types'
import {
  PAYOUT_LIMITS_REASON_MAX,
  PAYOUT_LIMITS_REASON_MIN,
  type PayoutControlChange,
  type PayoutControls,
  type PayoutLimits,
  type UpdatePayoutLimitsBody,
} from './types'

const CONTROLS_PATH = '/api/v1/payout-controls'

export const PAYOUT_CONTROLS_KEY = ['payout-controls'] as const

/** `GET /api/v1/payout-controls` — keempat peran. Sudah ada di `origin/dev`. */
export function usePayoutControls() {
  return useQuery({
    queryKey: [...PAYOUT_CONTROLS_KEY, 'current'],
    queryFn: () => apiFetch<PayoutControls>(CONTROLS_PATH),
    refetchOnWindowFocus: false,
  })
}

/**
 * `GET /api/v1/payout-controls/limits/history` — MANAGER/ADMIN.
 *
 * Tanpa saringan dan itu keputusan server: riwayat perubahan plafon tumbuh
 * sebanyak keputusan manusia, bukan sebanyak transaksi. `enabled` dipegang
 * pemanggil supaya STAFF/DEVELOPER tidak pernah menembak endpoint yang pasti
 * menjawab 403 kepadanya.
 */
export function usePayoutLimitHistory(enabled: boolean, page: number, take: number) {
  return useQuery({
    queryKey: [...PAYOUT_CONTROLS_KEY, 'history', page, take],
    queryFn: () =>
      apiFetchRaw<PhaseOnePaginatedResponse<PayoutControlChange>>(
        `${CONTROLS_PATH}/limits/history?page=${page}&take=${take}`
      ),
    enabled,
    refetchOnWindowFocus: false,
    retry: false,
  })
}

// ─── Isian ──────────────────────────────────────────────────────────────────

const DECIMAL_PATTERN = /^\d+(\.\d+)?$/

export interface LimitsFormInput {
  /** Kosong = "pakai bawaan server" (dikirim `null`). */
  maxPerTxIdr: string
  maxDailyIdr: string
  maxBatchPerTick: string
  reason: string
}

export interface LimitsFormErrors {
  maxPerTxIdr?: string
  maxDailyIdr?: string
  maxBatchPerTick?: string
  reason?: string
}

export type BuildLimitsResult =
  | { valid: true; body: UpdatePayoutLimitsBody }
  | { valid: false; errors: LimitsFormErrors }

/**
 * Kosong berarti `null`, dan `null` BERARTI SESUATU: "kembali ke bawaan
 * server", bukan "jangan diubah" dan bukan "tidak diketahui". Itu arti yang
 * sama dengan kolom NULL di `payout_controls`, dan layar ini tidak boleh
 * memberinya arti ketiga.
 *
 * `maxBatchPerTick` minimal 1, bukan 0 — sejajar CHECK
 * `payout_controls_max_batch_per_tick_positive`: batch nol membuat setiap
 * putaran mengambil nol order, yaitu payout mati diam-diam tanpa rem pernah
 * ditarik. Yang ingin mematikan payout punya tuas yang menyatakan dirinya.
 */
export interface ParsedLimits {
  limits: PayoutLimits
  errors: LimitsFormErrors
}

/**
 * Membaca KETIGA plafon saja, tanpa menyentuh alasan.
 *
 * Dipisah dari `buildLimitsBody` karena pratinjau "sebelum → sesudah" harus
 * hidup SEJAK angka pertama diketik — bukan baru setelah alasan sepuluh
 * karakter selesai ditulis. Menggabungkan keduanya membuat pratinjau kosong
 * justru pada saat operator sedang memutuskan angkanya.
 */
export function parseLimits(input: LimitsFormInput): ParsedLimits {
  const errors: LimitsFormErrors = {}

  const decimal = (raw: string, field: 'maxPerTxIdr' | 'maxDailyIdr'): string | null => {
    const value = raw.trim()
    if (value === '') return null
    if (!DECIMAL_PATTERN.test(value)) {
      errors[field] = 'Isi angka rupiah tanpa titik atau koma, mis. 50000000 — atau kosongkan untuk memakai bawaan server.'
      return null
    }
    return value
  }

  const maxPerTxIdr = decimal(input.maxPerTxIdr, 'maxPerTxIdr')
  const maxDailyIdr = decimal(input.maxDailyIdr, 'maxDailyIdr')

  let maxBatchPerTick: number | null = null
  const batchRaw = input.maxBatchPerTick.trim()
  if (batchRaw !== '') {
    const parsed = Number(batchRaw)
    if (!/^\d+$/.test(batchRaw) || !Number.isInteger(parsed) || parsed < 1) {
      errors.maxBatchPerTick = 'Isi bilangan bulat minimal 1 — atau kosongkan untuk memakai bawaan server. Nol bukan pilihan: itu mematikan pencairan tanpa rem pernah ditarik.'
    } else {
      maxBatchPerTick = parsed
    }
  }

  return { limits: { maxPerTxIdr, maxDailyIdr, maxBatchPerTick }, errors }
}

/**
 * Kosong berarti `null`, dan `null` BERARTI SESUATU: "kembali ke bawaan
 * server", bukan "jangan diubah" dan bukan "tidak diketahui". Itu arti yang
 * sama dengan kolom NULL di `payout_controls`, dan layar ini tidak boleh
 * memberinya arti ketiga.
 *
 * `maxBatchPerTick` minimal 1, bukan 0 — sejajar CHECK
 * `payout_controls_max_batch_per_tick_positive`: batch nol membuat setiap
 * putaran mengambil nol order, yaitu payout mati diam-diam tanpa rem pernah
 * ditarik. Yang ingin mematikan payout punya tuas yang menyatakan dirinya.
 */
export function buildLimitsBody(input: LimitsFormInput): BuildLimitsResult {
  const { limits, errors } = parseLimits(input)

  const reason = input.reason.trim()
  if (reason.length < PAYOUT_LIMITS_REASON_MIN) {
    errors.reason = `Alasan wajib, minimal ${PAYOUT_LIMITS_REASON_MIN} karakter setelah spasi di ujung dibuang.`
  } else if (reason.length > PAYOUT_LIMITS_REASON_MAX) {
    errors.reason = `Alasan maksimal ${PAYOUT_LIMITS_REASON_MAX} karakter.`
  }

  if (Object.keys(errors).length > 0) return { valid: false, errors }
  return { valid: true, body: { ...limits, reason } }
}

/** `true` kalau usulan ini tidak mengubah satu pun plafon. */
export function limitsUnchanged(current: PayoutLimits, next: PayoutLimits): boolean {
  return (
    current.maxPerTxIdr === next.maxPerTxIdr &&
    current.maxDailyIdr === next.maxDailyIdr &&
    current.maxBatchPerTick === next.maxBatchPerTick
  )
}

// ─── Mutasi ─────────────────────────────────────────────────────────────────

export type UpdateLimitsOutcome =
  | { outcome: 'PENDING_APPROVAL'; approval: ApprovalRequest }
  | { outcome: 'EXECUTED'; result: PayoutControls }

/**
 * Membedakan `202` (usulan dibuat) dari `200` (sudah berlaku) tanpa kode HTTP.
 *
 * Alasannya sama persis dengan `interpretResolveResponse` di Mint Bermasalah:
 * `apiFetch` hanya mengembalikan badan respons. Kedua bentuk saling lepas —
 * usulan punya `actionType` + `expiresAt`, keadaan plafon punya
 * `payoutsEnabled`. Bentuk yang bukan keduanya dilempar, tidak ditebak.
 *
 * Hari ini cabang `EXECUTED` TIDAK PERNAH tercapai: executor plafon menyatakan
 * `alwaysRequiresApproval = true` untuk arah perubahan apa pun. Ia tetap
 * dipetakan supaya kalau suatu saat tercapai, layar tidak salah membacanya
 * sebagai usulan yang menggantung.
 */
export function interpretLimitsResponse(data: unknown): UpdateLimitsOutcome {
  if (data && typeof data === 'object') {
    const body = data as Record<string, unknown>
    if (typeof body.actionType === 'string' && typeof body.expiresAt === 'string') {
      return { outcome: 'PENDING_APPROVAL', approval: data as ApprovalRequest }
    }
    if (typeof body.payoutsEnabled === 'boolean') {
      return { outcome: 'EXECUTED', result: data as PayoutControls }
    }
  }
  throw new Error(
    'Jawaban server tidak dikenali — tidak jelas apakah plafon sudah berubah atau sedang menunggu persetujuan. Periksa Persetujuan Orang Kedua sebelum mengirim ulang.'
  )
}

export function useUpdatePayoutLimits() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: LimitsFormInput) => {
      const built = buildLimitsBody(input)
      if (!built.valid) {
        throw new Error(
          built.errors.reason ??
            built.errors.maxPerTxIdr ??
            built.errors.maxDailyIdr ??
            built.errors.maxBatchPerTick ??
            'Isian tidak valid'
        )
      }
      const data = await apiFetch<unknown>(`${CONTROLS_PATH}/limits`, {
        method: 'POST',
        body: built.body,
      })
      return interpretLimitsResponse(data)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PAYOUT_CONTROLS_KEY })
      qc.invalidateQueries({ queryKey: APPROVALS_LIST_KEY })
    },
  })
}
