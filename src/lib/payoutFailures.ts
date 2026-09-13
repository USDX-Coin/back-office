/**
 * Aturan murni antrean "Pencairan Bermasalah" (USDX-662, `sot/bni-integration.md § 17`,
 * kontrak `sot/api/payout-failures.yaml`).
 *
 * Tiga hal di berkas ini ada karena salah mengerjakannya mahal:
 *
 *  1. AKSI MENGIKUTI `issueKind`, DAN ENUM-NYA TERBUKA. `PAYOUT_STUCK` tidak punya
 *     aksi sama sekali — transfernya mungkin masih berangkat, dan menyatakan
 *     "gagal" atasnya adalah cara termurah membayar dua kali. Jenis yang tidak
 *     dikenal diperlakukan sama: tanpa aksi (fail-closed), bukan tiga tombol.
 *
 *  2. KODE GALAT BERNAMA BISA DATANG DI `code` ATAU DI `message`. Backend melempar
 *     `new ConflictException("ALREADY_RESOLVED")`; filter exception-nya menaruh
 *     string itu di `message` dan menurunkan `code` dari status HTTP. Pembaca
 *     yang hanya melihat `code` akan jatuh ke pesan generik untuk kelima kode
 *     409 — tepat kasus yang peta galat ini ada untuk menjelaskan.
 *
 *  3. "SUDAH FINAL" DIBACA DARI `rejectedAt`. Submission tanpa `rejectedAt` belum
 *     terbukti ditolak — transfernya mungkin sudah berangkat (§ 17.2 #3). Itu
 *     jawaban atas pertanyaan yang harus dijawab ops sebelum menekan apa pun.
 */
import { ApiError } from './apiFetch'
import type { StatusConfig } from './status'
import type {
  PayoutIssueKind,
  PayoutResolution,
  PayoutSubmissionTrail,
  ResolvePayoutFailureBody,
} from './types'

// ─── Jenis masalah ──────────────────────────────────────────────────────────

const ISSUE_KIND_PILLS: Record<PayoutIssueKind, StatusConfig> = {
  PAYOUT_FAILED: {
    label: 'Payout gagal',
    variant: 'destructive',
    className: 'bg-destructive/10 text-destructive',
    dotClass: 'bg-destructive',
  },
  BURN_REJECTED: {
    label: 'Burn ditolak',
    variant: 'outline',
    className: 'bg-warning/10 text-warning',
    dotClass: 'bg-warning',
  },
  PAYOUT_STUCK: {
    label: 'Payout tertahan',
    variant: 'outline',
    className: 'bg-primary/10 text-primary',
    dotClass: 'bg-primary',
  },
}

/** Badge `issueKind`. Nilai tak dikenal dirender apa adanya, tanpa warna yang mengarang arti. */
export function payoutIssueKindPill(kind: string): StatusConfig {
  return (
    ISSUE_KIND_PILLS[kind as PayoutIssueKind] ?? {
      label: kind,
      variant: 'outline',
      className: 'bg-muted text-muted-foreground',
      dotClass: 'bg-muted-foreground',
    }
  )
}

/** Opsi filter `issueKind` — urutan = urutan § 17.4. */
export const PAYOUT_ISSUE_KIND_OPTIONS: { value: PayoutIssueKind; label: string }[] = [
  { value: 'PAYOUT_FAILED', label: ISSUE_KIND_PILLS.PAYOUT_FAILED.label },
  { value: 'BURN_REJECTED', label: ISSUE_KIND_PILLS.BURN_REJECTED.label },
  { value: 'PAYOUT_STUCK', label: ISSUE_KIND_PILLS.PAYOUT_STUCK.label },
]

/** `true` untuk nilai filter yang dikenal kontrak — nilai lain dari URL tidak dikirim. */
export function isPayoutIssueKind(value: string): value is PayoutIssueKind {
  return value in ISSUE_KIND_PILLS
}

/**
 * Kode mesin → kalimat. Kontraknya menyatakan kode ini "bukan untuk ditampilkan
 * mentah ke staf" dan daftarnya TERBUKA, jadi yang tidak dikenal dikembalikan
 * `null` — pemanggil merender kodenya sebagai teks sekunder, tidak menebak arti.
 */
const ISSUE_CODE_LABELS: Record<string, string> = {
  PROVIDER_REJECTED: 'Ditolak provider saat diserahkan',
  PROVIDER_FAILED: 'Provider menyatakan transfer gagal',
  BANK_CODE_UNSUPPORTED: 'Kode bank tidak didukung',
  PER_TX_CAP_EXCEEDED: 'Melebihi plafon per transaksi',
  BURN_AMOUNT_MISMATCH: 'Nominal burn tidak sama dengan snapshot order',
  BURN_WALLET_MISMATCH: 'Wallet burn bukan wallet order',
  // USDX-670: token yang dibakar bukan `contract_address` snapshot order — mis. token uji
  // dibakar atas order bertoken prod. Kasus yang paling perlu dijelaskan ke ops: nasabah bisa
  // menuntut rupiah sungguhan atas token yang tidak bernilai.
  BURN_CONTRACT_MISMATCH: 'Burn di alamat token yang bukan milik order',
  STALE_BURN: 'Burn lewat masa tenggang',
  SETTLE_TIMEOUT: 'Tidak ada jawaban final dari provider',
  // `sot/api/redeem-approvals.yaml § reject`: order yang DITOLAK di gerbang Persetujuan
  // Pencairan mendarat di sini sebagai PAYOUT_FAILED + OPS_REJECTED — alasannya ketikan ops.
  OPS_REJECTED: 'Ditolak ops di Persetujuan Pencairan',
}

export function payoutIssueCodeLabel(code: string | null): string | null {
  if (!code) return null
  return ISSUE_CODE_LABELS[code] ?? null
}

// ─── Aksi resolve ───────────────────────────────────────────────────────────

/**
 * Aksi yang sah per jenis (§ 17.4). `BURN_REJECTED` tanpa `RESENT` karena
 * ordernya belum pernah sampai ke payout; `PAYOUT_STUCK` dan jenis tak dikenal
 * tanpa aksi apa pun.
 */
export function allowedResolveActions(kind: string): readonly PayoutResolution[] {
  switch (kind) {
    case 'PAYOUT_FAILED':
      return ['RESENT', 'SETTLED_MANUAL', 'CLOSED']
    case 'BURN_REJECTED':
      return ['SETTLED_MANUAL', 'CLOSED']
    case 'PAYOUT_STUCK':
      return []
    default:
      return []
  }
}

/** Label tombol — kata kerja, karena ia yang akan terjadi. */
export const RESOLVE_ACTION_LABELS: Record<PayoutResolution, string> = {
  RESENT: 'Kirim ulang',
  SETTLED_MANUAL: 'Tandai dibayar manual',
  CLOSED: 'Tutup tanpa pembayaran',
}

/** Label jejak — bentuk lampau, karena ia yang sudah terjadi. */
const RESOLUTION_TRAIL_LABELS: Record<PayoutResolution, string> = {
  RESENT: 'Dikirim ulang',
  SETTLED_MANUAL: 'Dibayar di luar sistem',
  CLOSED: 'Ditutup tanpa pembayaran',
}

export function resolutionTrailLabel(action: string): string {
  return RESOLUTION_TRAIL_LABELS[action as PayoutResolution] ?? action
}

// ─── Validasi form resolve ──────────────────────────────────────────────────

/** `ResolvePayoutFailure.reason minLength: 10` (kontrak) — `@MaxLength(500)` di DTO backend. */
const PAYOUT_RESOLVE_REASON_MIN = 10
export const PAYOUT_RESOLVE_REASON_MAX = 500
/** `@MaxLength(100)` pada `externalRef` di DTO backend. */
export const PAYOUT_EXTERNAL_REF_MAX = 100

export interface ResolveFormInput {
  action: PayoutResolution
  reason: string
  externalRef: string
}

export type ResolveFormErrors = Partial<Record<'reason' | 'externalRef', string>>

type ResolveFormResult =
  | { valid: true; body: ResolvePayoutFailureBody }
  | { valid: false; errors: ResolveFormErrors }

/**
 * Form → body, atau galat per field.
 *
 * Nilai yang dikirim sudah di-trim: `"          "` lolos `@MinLength(10)` di server
 * tapi kosong bagi siapa pun yang membaca jejak append-only ini kelak.
 * `externalRef` hanya ikut pada `SETTLED_MANUAL` — backend mengabaikannya di
 * aksi lain, dan referensi yang tertinggal dari pilihan sebelumnya tidak boleh
 * tercatat sebagai bukti transfer yang tidak pernah ada.
 */
export function buildResolveBody(input: ResolveFormInput): ResolveFormResult {
  const errors: ResolveFormErrors = {}
  const reason = input.reason.trim()
  if (!reason) {
    errors.reason = 'Alasan wajib diisi'
  } else if (reason.length < PAYOUT_RESOLVE_REASON_MIN) {
    errors.reason = `Alasan minimal ${PAYOUT_RESOLVE_REASON_MIN} karakter — ia masuk jejak audit yang tidak bisa diubah`
  } else if (reason.length > PAYOUT_RESOLVE_REASON_MAX) {
    errors.reason = `Alasan maksimal ${PAYOUT_RESOLVE_REASON_MAX} karakter`
  }

  const externalRef = input.externalRef.trim()
  if (input.action === 'SETTLED_MANUAL') {
    if (!externalRef) {
      errors.externalRef = 'Nomor referensi transfer bank wajib diisi'
    } else if (externalRef.length > PAYOUT_EXTERNAL_REF_MAX) {
      errors.externalRef = `Nomor referensi maksimal ${PAYOUT_EXTERNAL_REF_MAX} karakter`
    }
  }

  if (errors.reason || errors.externalRef) return { valid: false, errors }
  return {
    valid: true,
    body:
      input.action === 'SETTLED_MANUAL'
        ? { action: input.action, reason, externalRef }
        : { action: input.action, reason },
  }
}

// ─── Jejak submission ───────────────────────────────────────────────────────

interface SubmissionSummary {
  total: number
  /** Percobaan yang TIDAK terbukti ditolak — transfernya mungkin sudah berangkat. */
  notProvenRejected: number
}

export function summarizeSubmissions(submissions: PayoutSubmissionTrail[]): SubmissionSummary {
  return {
    total: submissions.length,
    notProvenRejected: submissions.filter((s) => s.rejectedAt === null).length,
  }
}

// ─── Umur antrean ───────────────────────────────────────────────────────────

/**
 * Berapa lama order sudah menunggu di antrean: `"45 menit"`, `"6 jam"`, `"3 hari"`.
 * Jam dipakai sampai 48 jam — "1 hari" untuk 25 jam menyembunyikan setengah hari
 * seseorang menunggu uangnya.
 */
export function formatQueueAge(issueAt: string | null, now: Date = new Date()): string {
  if (!issueAt) return '—'
  const then = Date.parse(issueAt)
  if (Number.isNaN(then)) return '—'
  const minutes = Math.max(0, Math.floor((now.getTime() - then) / 60_000))
  if (minutes < 60) return `${minutes} menit`
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return `${hours} jam`
  return `${Math.floor(hours / 24)} hari`
}

// ─── Galat yang bisa dibaca manusia ─────────────────────────────────────────

/** Satu kalimat per kode bernama (`payout-failures.yaml § resolve`, `payout-failures.errors.ts`). */
const NAMED_ERROR_MESSAGES: Record<string, string> = {
  ALREADY_RESOLVED:
    'Order ini sudah diselesaikan orang lain. Muat ulang untuk melihat keputusan yang sudah diambil.',
  PAYOUT_DISABLED:
    'Rem payout sedang ditarik — kirim ulang tidak bisa dijalankan sampai payout dibuka lagi. Tandai dibayar manual dan tutup tetap bisa.',
  SUBMISSION_NOT_FINAL:
    'Provider belum memberi jawaban final atas transfer terakhir — tunggu jawabannya sebelum mengirim ulang atau menandai dibayar manual.',
  ACTION_NOT_ALLOWED_FOR_KIND:
    'Aksi ini tidak berlaku untuk jenis masalah order ini. Muat ulang — jenisnya mungkin sudah berubah.',
  BANK_ACCOUNT_NOT_OWNED:
    'Rekening pengganti bukan milik nasabah pemilik order. Rekening hanya boleh dipilih dari address book nasabah itu.',
  EXTERNAL_REF_REQUIRED: 'Nomor referensi transfer bank wajib diisi untuk menandai dibayar manual.',
  BANK_ACCOUNT_NOT_ALLOWED_FOR_ACTION: 'Rekening pengganti hanya boleh dipilih saat kirim ulang.',
}

/** Kode bernama yang berarti keadaan order di server sudah berubah — layar wajib menarik ulang. */
const STALE_STATE_CODES = new Set(['ALREADY_RESOLVED', 'ACTION_NOT_ALLOWED_FOR_KIND'])

function namedCode(err: ApiError): string | null {
  if (NAMED_ERROR_MESSAGES[err.code]) return err.code
  if (NAMED_ERROR_MESSAGES[err.message]) return err.message
  return null
}

/** Ubah kegagalan resolve menjadi kalimat yang memberi tahu apa yang harus dilakukan. */
export function payoutFailureErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const code = namedCode(err)
    if (code) return NAMED_ERROR_MESSAGES[code]!
    if (err.status === 403) {
      return 'Peran Anda tidak berwenang menuntaskan pencairan bermasalah. Kirim ulang, tandai dibayar manual, dan tutup hanya untuk Manager dan Admin.'
    }
    if (err.status === 404) {
      return 'Order ini tidak ada di antrean Pencairan Bermasalah. Muat ulang daftarnya.'
    }
    if (err.status >= 500) {
      return 'Server gagal memproses permintaan ini. Tidak ada yang berubah — coba lagi.'
    }
    return err.message
  }
  if (err instanceof Error) return err.message
  return 'Permintaan gagal.'
}

/** `true` kalau galatnya berarti data di layar sudah basi (409 keadaan berubah, atau 404). */
export function isStaleStateError(err: unknown): boolean {
  if (!(err instanceof ApiError)) return false
  if (err.status === 404) return true
  const code = namedCode(err)
  return code !== null && STALE_STATE_CODES.has(code)
}
