import { heldReasonLabel } from '@/features/held-credits/labels'
import {
  isPayoutIssueKind,
  payoutIssueCodeLabel,
  payoutIssueKindPill,
  resolutionTrailLabel,
} from '@/lib/payoutFailures'
import { UNKNOWN_CODE_LABEL } from '@/lib/status'
import type { OrderTimelineEvent, OrderTimelineEventCode } from '@/lib/types'

/**
 * Riwayat status order (`OrderDetail.timeline`) dalam kalimat operator.
 *
 * Kode kejadian berasal dari backend dan daftarnya bisa bertambah lebih dulu
 * daripada layar ini — kode yang belum dikenal TIDAK membuat modal mogok,
 * ia dirender "Kejadian belum dikenali" dengan kodenya di `title`.
 */

const EVENT_LABELS: Record<OrderTimelineEventCode, string> = {
  // MINT
  ORDER_CREATED: 'Order dibuat',
  PAYMENT_SELECTED: 'Nasabah memilih metode bayar',
  CREDIT_HELD: 'Uang masuk ditahan',
  CREDIT_RESOLVED: 'Uang masuk diselesaikan manual',
  PAID: 'Pembayaran diterima',
  SAFE_PROPOSED: 'Mint diajukan ke antrean tanda tangan',
  SAFE_SIGNED: 'Mint ditandatangani',
  SAFE_EXECUTED: 'USDX dicetak di blockchain',
  SAFE_FAILED: 'Pencetakan USDX gagal',
  SAFE_CANCELLED: 'Antrean tanda tangan dibatalkan',
  ORDER_FAILED: 'Order gagal',
  ORDER_EXPIRED: 'Order kedaluwarsa',
  // REDEEM
  BURN_SUBMITTED: 'Nasabah mengirim transaksi pembakaran',
  BURN_SIGN_ABANDONED: 'Nasabah batal menandatangani pembakaran',
  BURNED: 'USDX dibakar di blockchain',
  PAYOUT_APPROVED: 'Pencairan disetujui',
  PAYOUT_REJECTED: 'Pencairan ditolak',
  PAYOUT_SUBMITTED: 'Transfer rupiah dikirim ke penyedia pencairan',
  PAYOUT_SUBMISSION_REJECTED: 'Transfer rupiah ditolak penyedia pencairan',
  PAYOUT_ISSUE: 'Pencairan bermasalah',
  PAYOUT_REVIEW: 'Pencairan bermasalah ditangani',
  PAYOUT_COMPLETED: 'Rupiah dikirim ke rekening nasabah',
}

const CREDIT_RESOLVED_DETAIL: Record<string, string> = {
  PAID: 'ditandai lunas',
  FAILED: 'ditandai gagal',
}

/** Info di belakang " · " pada `PAYOUT_REVIEW` — kata yang sama dengan `ResolutionTrail`. */
const PAYOUT_REVIEW_INFO_LABEL: Record<string, string> = {
  RESENT: 'Referensi baru',
  SETTLED_MANUAL: 'Referensi transfer bank',
}

export const UNKNOWN_EVENT_LABEL = `Kejadian ${UNKNOWN_CODE_LABEL.toLowerCase()}`

export interface TimelineEntryView {
  /** Apa yang terjadi, dalam kalimat. */
  text: string
  /** Kode kejadian mentah bila belum dikenal — untuk `title`, tidak dicetak. */
  unknownCode: string | null
  /** Siapa yang melakukannya; `null` = tidak ditulis (otomatis / nasabah). */
  actor: string | null
  /** Sebab dari kode mesin (`reasonCode`), sudah diterjemahkan bila dikenal. */
  cause: string | null
  /** Alasan/catatan teks bebas. */
  note: string | null
  /** Nomor referensi (mono) beserta labelnya. */
  reference: { label: string; value: string } | null
  /** Info tambahan lain yang tidak punya tempat khusus. */
  info: string | null
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

/** Kode alasan mesin → kalimat lewat peta yang sudah ada; tak dikenal = kodenya. */
export function timelineReasonLabel(code: string): string {
  return heldReasonLabel(code) ?? payoutIssueCodeLabel(code) ?? code
}

function isKnownEvent(code: string): code is OrderTimelineEventCode {
  return Object.prototype.hasOwnProperty.call(EVENT_LABELS, code)
}

/** `"RESENT · ref-123"` → `{ action: 'RESENT', info: 'ref-123' }`. */
function splitReviewDetail(detail: string): { action: string; info: string | null } {
  const at = detail.indexOf(' · ')
  if (at === -1) return { action: detail.trim(), info: null }
  return { action: detail.slice(0, at).trim(), info: clean(detail.slice(at + 3)) }
}

function noteWithoutCode(reason: string | null, reasonCode: string | null): string | null {
  if (!reason) return null
  if (!reasonCode) return reason
  if (reason === reasonCode) return null
  if (reason.startsWith(`${reasonCode}:`)) return clean(reason.slice(reasonCode.length + 1))
  return reason
}

export function describeTimelineEvent(ev: OrderTimelineEvent): TimelineEntryView {
  const reasonCode = clean(ev.reasonCode)
  const reason = clean(ev.reason)
  const detail = clean(ev.detail)

  const view: TimelineEntryView = {
    text: UNKNOWN_EVENT_LABEL,
    unknownCode: null,
    actor: clean(ev.actorName),
    cause: reasonCode ? timelineReasonLabel(reasonCode) : null,
    // `reason` bisa berisi kode mesin yang sama dengan `reasonCode`, atau `"KODE: rincian"` —
    // kodenya sudah tampil sebagai sebab, jadi hanya rinciannya yang dicetak.
    note: noteWithoutCode(reason, reasonCode),
    reference: null,
    info: detail,
  }

  if (!isKnownEvent(ev.event)) {
    view.unknownCode = ev.event
    return view
  }

  view.text = EVENT_LABELS[ev.event]

  switch (ev.event) {
    case 'CREDIT_RESOLVED': {
      const outcome = detail ? CREDIT_RESOLVED_DETAIL[detail] : undefined
      if (outcome) {
        view.text = `${view.text}, ${outcome}`
        view.info = null
      }
      break
    }
    case 'SAFE_SIGNED':
      // `actorName` null di sini = tanda tangan backend (`is_backend`), kata yang
      // sama dengan `signerDisplayName` di Antrean Tanda Tangan.
      view.actor = view.actor ?? 'Sistem (otomatis)'
      break
    case 'PAYOUT_SUBMITTED':
    case 'PAYOUT_SUBMISSION_REJECTED':
      if (detail) {
        view.reference = { label: 'Referensi', value: detail }
        view.info = null
      }
      break
    case 'PAYOUT_ISSUE':
      // `detail` = payout_issue_kind. Jenis yang belum dikenal tidak dicetak
      // mentah — sebabnya tetap terbaca dari `reasonCode`.
      if (detail && isPayoutIssueKind(detail)) {
        view.text = `${view.text}: ${payoutIssueKindPill(detail).label.toLowerCase()}`
      }
      view.info = null
      break
    case 'PAYOUT_REVIEW': {
      if (!detail) break
      const { action, info } = splitReviewDetail(detail)
      const label = resolutionTrailLabel(action)
      if (label !== action) {
        view.text = `Pencairan ${label.toLowerCase()}`
        view.info = null
        if (info) view.reference = { label: PAYOUT_REVIEW_INFO_LABEL[action] ?? 'Referensi', value: info }
      }
      break
    }
  }

  return view
}
