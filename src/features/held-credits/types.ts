// Kontrak `GET|POST /api/v1/held-credits` — "Mint Bermasalah" (USDX-341,
// `sot/bni-integration.md § 6`), plus gerbang maker-checker USDX-486.
//
// SUBJEKNYA KREDIT, BUKAN ORDER. Sebagian besar antrean ini justru kredit yang
// TIDAK menamai order mana pun (transfer bernominal salah): uang nasabah sudah
// masuk rekening dan tidak ada yang tahu ia melunasi apa. Ops yang memutuskan.

export type HeldCreditResolution = 'PAID' | 'FAILED'

/** Dari ledger mana baris ini datang. Menentukan cara membaca field lainnya. */
export type HeldCreditSource = 'BNI' | 'DURIANPAY_SNAP'

export interface HeldCreditReview {
  id: string
  action: HeldCreditResolution
  mintOrderId: string | null
  actorStaffId: string
  actorStaffName: string | null
  reason: string
  ipAddress: string | null
  createdAt: string
}

export interface HeldCreditOrder {
  id: string
  userId: string | null
  /** Null hanya di sisi repo; server selalu mengirim label untuk order partner. */
  userEmail: string | null
  customerName: string
  /** USDX yang dipesan. */
  amount: string
  /** Yang seharusnya ditransfer nasabah (`total_pay_idr`). */
  expectedAmountIdr: string | null
  uniqueCode: string | null
  paymentStatus: string
  safeStatus: string
  status: string
  heldReason: string | null
  heldAt: string | null
  expiresAt: string
  createdAt: string
}

export interface HeldCreditListItem {
  id: string
  source: HeldCreditSource
  /** Kenapa mesin tak bisa menyelesaikannya: NO_MATCHING_ORDER, LATE_PAYMENT, … */
  heldReason: string | null
  /** Yang benar-benar masuk, rupiah 2 desimal; null kalau bukan rupiah bulat. */
  receivedAmountIdr: string | null
  /** Persis seperti dikirim penyedia ("1640407.000" / "1640407.00"). */
  receivedAmountRaw: string
  accountFromTo: string | null
  senderName: string | null
  collectionAccountNo: string | null
  journalNum: string | null
  receivedAt: string
  /** Order pilihan mesin — null untuk kredit bernominal salah. */
  order: HeldCreditOrder | null
}

export interface HeldCreditDetail extends HeldCreditListItem {
  idempotencyKey: string | null
  requestUuid: string | null
  accountingFlag: string
  narrative1: string | null
  narrative2: string | null
  narrative3: string | null
  balance: string | null
  reversalFlag: string | null
  reversedJournal: string | null
  xTimestamp: string | null
  processedAt: string | null
  bankCode?: string | null
  failureReason?: string | null
  raw: Record<string, unknown>
  /** Selalu null untuk DURIANPAY_SNAP — ledger-nya belum punya kolom resolusi. */
  resolution: HeldCreditResolution | null
  resolvedAt: string | null
  resolvedBy: string | null
  resolvedMintOrderId: string | null
  reviews: HeldCreditReview[]
}

/** Badan `POST /api/v1/held-credits/{id}/resolve`. */
export interface ResolveHeldCreditBody {
  action: HeldCreditResolution
  /** Wajib untuk PAID kalau mesin tak menamai order; diabaikan untuk FAILED. */
  orderId?: string
  reason: string
}

/** Jawaban 200 — kredit selesai seketika (di bawah ambang maker-checker). */
export interface ResolvedHeldCredit {
  creditId: string
  resolution: HeldCreditResolution
  orderId: string | null
  orderStatus: string | null
  orderPaymentStatus: string | null
  resolvedAt: string
  resolvedBy: string
  resolvedByName: string
}

/** Panjang `reason` di `ResolveHeldCreditDto`. */
export const HELD_RESOLVE_REASON_MIN = 3
export const HELD_RESOLVE_REASON_MAX = 500

/** Ambang maker-checker, konstanta di kode backend (`approvals.types.ts`). */
export const MAKER_CHECKER_THRESHOLD_IDR = 10_000_000
