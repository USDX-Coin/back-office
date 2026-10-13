// Kontrak `GET|POST /api/v1/approvals` — maker-checker (USDX-486).
//
// Ini bukan fitur tambahan. POJK 4/2021 Penjelasan Pasal 5 mewajibkan "pihak
// yang melakukan input data berbeda dari pihak yang melakukan validasi data".
// Backend sudah menegakkannya di tiga lapisan (service, CHECK constraint
// `approval_requests_approver_differs_from_proposer`, dan klaim putusan di
// bawah advisory lock); yang hilang selama ini adalah pintunya.

/**
 * Jenis aksi yang tunduk empat mata. `pgEnum` di database, jadi nilai di luar
 * daftar ini ditolak sebelum sempat jadi usulan tanpa executor.
 *
 * `PAYOUT_CONTROLS_LIMITS` baru ada di branch backend
 * `wisnubarata111/be-tutup-lubang-jejak-dan-plafon` — layar ini tidak boleh
 * merge sebelum branch itu naik, karena menyaring dengan nilai enum yang belum
 * ada dijawab 400 oleh `@IsEnum` di `ListApprovalsDto`.
 */
export type ApprovalActionType =
  | 'PAYOUT_CONTROLS_RELEASE'
  | 'HELD_CREDIT_RESOLVE'
  | 'PAYOUT_CONTROLS_LIMITS'

/**
 * PENDING → APPROVED | REJECTED | EXPIRED. Ketiganya terminal: tidak ada jalan
 * kembali ke PENDING, termasuk untuk usulan yang gagal dieksekusi (ia tetap
 * APPROVED, dengan `executionError` terisi).
 */
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED'

export interface ApprovalRequest {
  id: string
  actionType: ApprovalActionType
  /** Argumen aksi apa adanya — beku sejak usulan dibuat (trigger 0066). */
  payload: Record<string, unknown>
  /** Nominal rupiah yang membuat aksi melewati ambang; null = aksi tak bernominal. */
  amountIdr: string | null
  status: ApprovalStatus
  proposerStaffId: string
  proposedAt: string
  expiresAt: string
  approverStaffId: string | null
  decidedAt: string | null
  decisionReason: string | null
  /** Terisi hanya kalau executor benar-benar selesai. */
  executedAt: string | null
  executionError: string | null
}

export interface ApprovalFilters {
  page?: number
  /** Nama parameter kontraknya `take` (cap 100). */
  take?: number
  status?: ApprovalStatus
  actionType?: ApprovalActionType
}

/** Batas panjang `reason` di `ApproveApprovalDto` / `RejectApprovalDto`. */
export const APPROVAL_REASON_MIN = 3
export const APPROVAL_REASON_MAX = 500
