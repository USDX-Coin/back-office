import type { StatusConfig } from '@/lib/status'
import { formatIdrExact } from '@/lib/redeemApprovals'
import type { ApprovalActionType, ApprovalRequest, ApprovalStatus } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Menerjemahkan usulan maker-checker ke kalimat yang bisa diputuskan.
//
// Penyetuju tidak memutuskan "HELD_CREDIT_RESOLVE dengan payload {…}". Ia
// memutuskan "uang Rp 24 juta ini dilekatkan ke order itu". Berkas ini yang
// menjembataninya — dan ia GAGAL DENGAN JUJUR: payload datang dari kolom jsonb
// yang bisa saja ditulis versi kode lain, jadi tiap pembacaan diperiksa dan
// yang tak dikenali dirender mentah, bukan ditebak.
// ─────────────────────────────────────────────────────────────────────────────

const ACTION_TYPE_LABELS: Record<ApprovalActionType, string> = {
  HELD_CREDIT_RESOLVE: 'Selesaikan mint bermasalah',
  PAYOUT_CONTROLS_RELEASE: 'Lepas rem pencairan',
  PAYOUT_CONTROLS_LIMITS: 'Ubah plafon pencairan',
}

export function actionTypeLabel(actionType: string): string {
  return ACTION_TYPE_LABELS[actionType as ApprovalActionType] ?? actionType
}

export const APPROVAL_ACTION_TYPE_OPTIONS = (
  Object.keys(ACTION_TYPE_LABELS) as ApprovalActionType[]
).map((value) => ({ value, label: ACTION_TYPE_LABELS[value] }))

const STATUS_LABELS: Record<ApprovalStatus, string> = {
  PENDING: 'Menunggu orang kedua',
  APPROVED: 'Disetujui',
  REJECTED: 'Ditolak',
  EXPIRED: 'Kedaluwarsa',
}

export const APPROVAL_STATUS_OPTIONS = (Object.keys(STATUS_LABELS) as ApprovalStatus[]).map(
  (value) => ({ value, label: STATUS_LABELS[value] })
)

export function statusPill(status: ApprovalStatus): StatusConfig {
  switch (status) {
    case 'PENDING':
      return {
        label: STATUS_LABELS.PENDING,
        variant: 'outline',
        className: 'bg-warning/10 text-warning',
        dotClass: 'bg-warning',
      }
    case 'APPROVED':
      return {
        label: STATUS_LABELS.APPROVED,
        variant: 'default',
        className: 'bg-success/10 text-success',
        dotClass: 'bg-success',
      }
    case 'REJECTED':
      return {
        label: STATUS_LABELS.REJECTED,
        variant: 'destructive',
        className: 'bg-destructive/10 text-destructive',
        dotClass: 'bg-destructive',
      }
    case 'EXPIRED':
      return {
        label: STATUS_LABELS.EXPIRED,
        variant: 'secondary',
        className: 'bg-muted text-muted-foreground',
        dotClass: 'bg-muted-foreground',
      }
  }
}

/**
 * Keadaan yang schema backend sendiri sebut "WAJIB terlihat ops": persetujuan
 * sudah diberikan, aksinya tidak (atau belum) berjalan
 * (`approval-requests.ts` — `executed_at IS NULL AND status = 'APPROVED'`).
 * Tidak ada yang menayangkannya sebelum layar ini ada.
 */
export function isApprovedButNotExecuted(approval: ApprovalRequest): boolean {
  return approval.status === 'APPROVED' && approval.executedAt === null
}

/** Nominal yang dipertaruhkan, atau kalimat yang menyatakan ia memang tak ada. */
export function amountLabel(amountIdr: string | null): string {
  if (amountIdr === null) return 'Tanpa nominal'
  return formatIdrExact(amountIdr)
}

// ─── Pembacaan payload ──────────────────────────────────────────────────────

function readString(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key]
  return typeof value === 'string' ? value : null
}

function readNullableString(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key]
  if (value === null) return null
  return typeof value === 'string' ? value : null
}

/** Satu baris "label: nilai" yang dirender dialog/detail. */
export interface PayloadLine {
  label: string
  value: string
  /** Nilai mentah (id, kode) — dirender mono dan tidak boleh dipendekkan. */
  mono?: boolean
}

/**
 * Isi usulan sebagai baris yang bisa dibaca. `unknown` di ujung kanan berarti
 * bentuk payload-nya bukan yang dikenal versi ini — pemanggil lalu menampilkan
 * JSON mentahnya, karena menyetujui sesuatu yang tidak bisa ditampilkan adalah
 * persis kegagalan yang mekanisme empat mata dibuat untuk mencegah.
 */
export function describePayload(
  actionType: string,
  payload: Record<string, unknown>
): { lines: PayloadLine[]; complete: boolean } {
  if (actionType === 'HELD_CREDIT_RESOLVE') {
    const action = readString(payload, 'action')
    const creditId = readString(payload, 'creditId')
    const reason = readString(payload, 'reason')
    if (!action || !creditId || !reason) return { lines: [], complete: false }
    const orderId = readNullableString(payload, 'orderId')
    return {
      lines: [
        {
          label: 'Keputusan atas kredit',
          value:
            action === 'PAID'
              ? 'TERIMA — uangnya diakui dan melunasi sebuah order'
              : action === 'FAILED'
                ? 'TOLAK — uangnya tidak diakui; pengembalian dana dikerjakan treasury secara manual'
                : action,
        },
        { label: 'Id kredit', value: creditId, mono: true },
        {
          label: 'Order yang ditunjuk pengusul',
          value: orderId ?? 'tidak ada — memakai order yang dicocokkan mesin',
          mono: orderId !== null,
        },
        { label: 'Alasan pengusul', value: reason },
      ],
      complete: true,
    }
  }

  if (actionType === 'PAYOUT_CONTROLS_RELEASE') {
    if (payload.payoutsEnabled !== true) return { lines: [], complete: false }
    return {
      lines: [
        {
          label: 'Yang akan berubah',
          value:
            'Rem pencairan DILEPAS — seluruh aliran rupiah keluar menyala kembali pada putaran berikutnya.',
        },
      ],
      complete: true,
    }
  }

  if (actionType === 'PAYOUT_CONTROLS_LIMITS') {
    const reason = readString(payload, 'reason')
    const batch = payload.maxBatchPerTick
    const batchOk = batch === null || (typeof batch === 'number' && Number.isInteger(batch))
    if (!reason || !batchOk) return { lines: [], complete: false }
    const perTx = readNullableString(payload, 'maxPerTxIdr')
    const daily = readNullableString(payload, 'maxDailyIdr')
    return {
      lines: [
        {
          label: 'Plafon per transaksi (sesudah)',
          value: perTx === null ? 'kembali ke bawaan server' : formatIdrExact(perTx),
        },
        {
          label: 'Plafon per hari (sesudah)',
          value: daily === null ? 'kembali ke bawaan server' : formatIdrExact(daily),
        },
        {
          label: 'Order per putaran (sesudah)',
          value: batch === null ? 'kembali ke bawaan server' : String(batch),
        },
        { label: 'Alasan pengusul', value: reason },
      ],
      complete: true,
    }
  }

  return { lines: [], complete: false }
}

/** Pesan galat server yang punya arti sendiri di layar ini. */
export function approvalErrorMessage(code: string, fallback: string): string {
  switch (code) {
    case 'SELF_APPROVAL_FORBIDDEN':
      return 'Ditolak: usulan tidak boleh diputuskan oleh pengusulnya sendiri. Percobaannya tercatat di Jejak Audit.'
    case 'APPROVAL_EXPIRED':
      return 'Usulan sudah lewat masa berlaku dan tidak bisa diputuskan lagi.'
    case 'APPROVAL_ALREADY_DECIDED':
      return 'Usulan ini sudah diputuskan orang lain — memutuskan ulang tidak menggandakan eksekusinya.'
    case 'APPROVAL_NOT_FOUND':
      return 'Usulan tidak ditemukan. Kemungkinan tautannya sudah basi.'
    default:
      return fallback
  }
}

/** Kode yang berarti "daftarnya sudah berubah" — cache wajib ditarik ulang. */
export function isStaleApprovalError(code: string): boolean {
  return (
    code === 'APPROVAL_EXPIRED' ||
    code === 'APPROVAL_ALREADY_DECIDED' ||
    code === 'APPROVAL_NOT_FOUND'
  )
}

// ─── Masa berlaku ───────────────────────────────────────────────────────────

/**
 * Sisa masa berlaku sebuah usulan, dibaca dari sisi orang yang harus memutuskan.
 *
 * Masa berlaku BUKAN hiasan: usulan yang menggantung selamanya adalah bom waktu
 * tersendiri — permintaan "lepas rem payout" dari insiden tiga bulan lalu tidak
 * boleh masih bisa disetujui hari ini oleh orang yang tak tahu konteksnya
 * (`approval-requests.ts`). Karena itu ia tampil sebagai hitung mundur, bukan
 * sebagai satu stempel waktu lagi yang harus dikurangi sendiri di kepala.
 */
export function formatExpiry(expiresAt: string, now: Date = new Date()): string {
  const expiry = Date.parse(expiresAt)
  if (Number.isNaN(expiry)) return '—'
  const minutes = Math.round((expiry - now.getTime()) / 60_000)
  if (minutes <= 0) {
    const lateMinutes = Math.abs(minutes)
    if (lateMinutes < 60) return `lewat ${lateMinutes} menit lalu`
    const lateHours = Math.floor(lateMinutes / 60)
    if (lateHours < 48) return `lewat ${lateHours} jam lalu`
    return `lewat ${Math.floor(lateHours / 24)} hari lalu`
  }
  if (minutes < 60) return `${minutes} menit lagi`
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return `${hours} jam lagi`
  return `${Math.floor(hours / 24)} hari lagi`
}

/** `true` kalau sisa waktunya di bawah dua jam — dirender sebagai peringatan. */
export function isExpirySoon(expiresAt: string, now: Date = new Date()): boolean {
  const expiry = Date.parse(expiresAt)
  if (Number.isNaN(expiry)) return false
  const remaining = expiry - now.getTime()
  return remaining > 0 && remaining <= 2 * 60 * 60 * 1000
}
