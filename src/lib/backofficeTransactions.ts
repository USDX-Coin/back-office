// Daftar Transaksi gabungan back-office — ⚠️ DRAF SOT PR #50
// (`sot/api/backoffice-transactions.yaml`, `phase-2/week2.md § Backoffice —
// Transaksi (gabungan)`).
//
// List ini TIDAK punya aksi sendiri: setiap tindakan menunjuk antrean asal
// (`queue` + `refId`) dan aksinya memakai endpoint antrean yang sudah ada.
// Semua enum TERBUKA — nilai yang tidak dikenal tampil apa adanya, tanpa aksi.

import { getOrderStatusConfig } from './status'
import type { Tone } from './tone'
import type {
  BackofficeActionType,
  BackofficeTransactionAction,
  BackofficeTransactionItem,
  BackofficeTransactionKind,
  OrderStatus,
} from './types'

export const TRANSACTION_KIND_LABEL: Record<BackofficeTransactionKind, string> = {
  MINT: 'Mint',
  REDEEM: 'Redeem',
  // Kontrak: tampil sebagai jenis "Uang masuk" (week2.md).
  INCOMING_UNMATCHED: 'Uang masuk',
}

export function transactionKindLabel(kind: string): string {
  return TRANSACTION_KIND_LABEL[kind as BackofficeTransactionKind] ?? kind
}

/** Nama tindakan — sama dengan nama antrean asalnya di layar. */
export const ACTION_LABEL: Record<BackofficeActionType, string> = {
  PAYOUT_FAILURE: 'Pencairan bermasalah',
  REDEEM_APPROVAL: 'Perlu persetujuan pencairan',
  HELD_CREDIT: 'Uang masuk tertahan',
  MANUAL_SYNC: 'Mint nyangkut',
}

export function actionLabel(actionType: string): string {
  return ACTION_LABEL[actionType as BackofficeActionType] ?? actionType
}

export const KNOWN_ACTION_TYPES = Object.keys(ACTION_LABEL) as BackofficeActionType[]

export function isKnownActionType(actionType: string | null | undefined): actionType is BackofficeActionType {
  return Boolean(actionType) && (KNOWN_ACTION_TYPES as string[]).includes(actionType as string)
}

/** `PAYOUT_STUCK` read-only: kontrak minta "dipantau", bukan tombol aksi. */
export function isMonitorOnly(action: BackofficeTransactionAction): boolean {
  return action.actionType === 'PAYOUT_FAILURE' && action.payoutIssueKind === 'PAYOUT_STUCK'
}

/** Status baris → label + nada. `HELD` milik baris uang masuk. */
export function transactionStatus(row: Pick<BackofficeTransactionItem, 'status' | 'kind'>): {
  label: string
  tone: Tone
} {
  if (row.status === 'HELD') return { label: 'Tertahan', tone: 'act' }
  const cfg = getOrderStatusConfig(row.status as OrderStatus)
  const tone: Tone = /destructive/.test(cfg.className)
    ? 'bad'
    : /success/.test(cfg.className)
      ? 'ok'
      : 'wait'
  return { label: cfg.label, tone }
}

/** Kalimat "Yang perlu kamu lakukan" untuk tindakan utama. */
export function actionTodoText(action: BackofficeTransactionAction): string {
  switch (action.actionType) {
    case 'PAYOUT_FAILURE':
      return isMonitorOnly(action)
        ? 'Pencairan masih mungkin berangkat dari penyedia. Dipantau — belum ada yang bisa dilakukan dari sini.'
        : 'Rupiah nasabah belum sampai padahal USDX-nya sudah terbakar. Periksa penyebabnya, lalu kirim ulang, tandai dibayar manual, atau tutup.'
    case 'REDEEM_APPROVAL':
      return 'Pencairan ini menunggu persetujuan sebelum rupiahnya dikirim. Cocokkan rekening tujuan, lalu setujui atau tolak.'
    case 'HELD_CREDIT':
      return action.heldReason === 'LATE_PAYMENT'
        ? 'Transfer nasabah masuk setelah batas waktu bayar. Terima dan lekatkan ke order, atau tolak (refund manual).'
        : 'Ada uang masuk yang tidak bisa dicocokkan otomatis. Lekatkan ke order yang benar, atau tolak (refund manual).'
    case 'MANUAL_SYNC':
      return 'Mint sudah dibayar lebih dari 2 jam tapi statusnya belum selesai. Tempel tx hash eksekusinya untuk memperbaiki status.'
    default:
      return `Tindakan "${action.actionType}" belum dikenali layar ini. Buka antrean asalnya.`
  }
}

/** Nama yang tampil di kolom Nasabah. Uang masuk tanpa order memakai nama pengirim. */
export function transactionPartyName(row: BackofficeTransactionItem): string {
  if (row.kind === 'INCOMING_UNMATCHED') return row.senderName?.trim() || 'Pengirim tidak diketahui'
  return row.customerName?.trim() || row.userEmail || '—'
}

/** Rute detail lengkap di antrean asal — dipakai sebagai "Buka di antrean". */
export function queueHref(action: BackofficeTransactionAction): string | null {
  switch (action.queue) {
    case 'PAYOUT_FAILURES':
      return `/payout-failures/${action.refId}`
    case 'REDEEM_APPROVALS':
      return '/redeem-approvals'
    case 'HELD_CREDITS':
      return `/mint-bermasalah/${action.refId}`
    case 'MANUAL_SYNC':
      return '/manual-sync'
    default:
      return null
  }
}

/** Filter yang diterima `GET /api/v1/transactions` (subset yang dipakai layar). */
export interface TransactionsQuery {
  page?: number
  take?: number
  kind?: string[]
  needsAction?: boolean
  actionType?: string
  q?: string
  ownerType?: 'PARTNER' | 'RETAIL'
}

export function buildTransactionsQuery(f: TransactionsQuery): string {
  const sp = new URLSearchParams()
  if (f.page) sp.set('page', String(f.page))
  if (f.take) sp.set('take', String(f.take))
  for (const k of f.kind ?? []) sp.append('kind', k)
  if (f.needsAction !== undefined) sp.set('needsAction', String(f.needsAction))
  if (f.actionType) sp.set('actionType', f.actionType)
  // `q` 3–100 karakter (kontrak, 422 di luar itu) — yang lebih pendek tidak dikirim.
  const q = f.q?.trim()
  if (q && q.length >= 3) sp.set('q', q.slice(0, 100))
  if (f.ownerType) sp.set('ownerType', f.ownerType)
  return sp.toString()
}
