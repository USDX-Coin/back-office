// Metode Pembayaran — ⚠️ DRAF SOT PR #50 (`sot/api/payment-methods.yaml`,
// `bni-integration.md § 4.3.11`). Aturan murni layar Pengaturan → Metode
// Pembayaran. Semua enum TERBUKA: nilai tak dikenal tampil apa adanya.

import { formatIdrExact } from './redeemApprovals'
import type { PaymentMethod } from './types'

export const REASON_MIN = 10
export const REASON_MAX = 500
/** `BNI_TRANSFER_MAX_AMOUNT_POLICY_IDR` — plafon kebijakan (konstanta kode backend). */
export const BNI_TRANSFER_POLICY_MAX_IDR = 10_000_000
export const BNI_TRANSFER_CODE = 'BANK_TRANSFER_BNI_BNI'

const CHANNEL_LABEL: Record<string, string> = {
  VA: 'Virtual Account',
  BANK_TRANSFER: 'Transfer bank',
  QRIS: 'QRIS',
}

const PROVIDER_LABEL: Record<string, string> = {
  DURIANPAY_SNAP: 'DurianPay',
  DURIANPAY: 'DurianPay',
  BNI: 'BNI (langsung)',
  MOCK: 'Tiruan (dev/staging)',
}

const UNAVAILABLE_LABEL: Record<string, string> = {
  PROVIDER_NOT_CONFIGURED: 'Penyedianya tidak terpasang di server ini',
  NOT_SUPPORTED_BY_ADAPTER: 'Belum didukung kode yang sedang berjalan',
  BNI_BUY_RATE_MISSING: 'Kurs beli BNI belum diisi',
  BNI_PREREQUISITE_UNVERIFIED: 'Prasyarat keamanan BNI (allowlist IP) belum dinyatakan terpenuhi devops',
}

/** "Virtual Account NOBU", "Transfer bank BNI", "QRIS". */
export function paymentMethodLabel(m: Pick<PaymentMethod, 'channel' | 'bank'>): string {
  const channel = CHANNEL_LABEL[m.channel] ?? m.channel
  return m.bank ? `${channel} ${m.bank}` : channel
}

export function providerLabel(provider: string): string {
  return PROVIDER_LABEL[provider] ?? provider
}

export function unavailableReasonLabel(reason: string | null | undefined): string | null {
  if (!reason) return null
  return UNAVAILABLE_LABEL[reason] ?? reason
}

/** Ditawarkan ke nasabah ⟺ `enabled && available` (satu predikat kontrak). */
export function isOffered(m: PaymentMethod): boolean {
  return m.enabled && m.available
}

/**
 * M8: menonaktifkan metode TERAKHIR yang ditawarkan boleh, tapi back-office
 * wajib konfirmasi — FE menghitung dari list (kontrak PATCH).
 */
export function isLastOffered(target: PaymentMethod, all: PaymentMethod[]): boolean {
  return isOffered(target) && !all.some((m) => m.id !== target.id && isOffered(m))
}

/** Biaya per metode: rupiah tetap, atau persen atas subtotal. */
export function formatFee(m: Pick<PaymentMethod, 'feeType' | 'feeValue'>): string {
  if (m.feeType === 'FLAT_IDR') return formatIdrExact(m.feeValue)
  if (m.feeType === 'PERCENT') return `${trimDecimal(m.feeValue)}% dari subtotal`
  return `${m.feeValue} (${m.feeType})`
}

export function formatMaxAmount(maxAmountIdr: string | null | undefined): string {
  return maxAmountIdr ? formatIdrExact(maxAmountIdr) : 'Tanpa batas'
}

function trimDecimal(v: string): string {
  return v.includes('.') ? v.replace(/0+$/, '').replace(/\.$/, '').replace('.', ',') : v
}

export function validateReason(raw: string): { value: string; error: string | null } {
  const value = raw.trim()
  if (value.length < REASON_MIN) return { value, error: `Alasan minimal ${REASON_MIN} karakter.` }
  if (value.length > REASON_MAX) return { value, error: `Alasan maksimal ${REASON_MAX} karakter.` }
  return { value, error: null }
}

/** `FLAT_IDR`: rupiah ≥ 0, maks 2 desimal. `PERCENT`: 0–100, maks 4 desimal. */
export function validateFeeValue(feeType: string, raw: string): string | null {
  const v = raw.trim()
  if (feeType === 'FLAT_IDR') {
    return /^\d+(\.\d{1,2})?$/.test(v) ? null : 'Isi rupiah tanpa titik ribuan, maksimal 2 desimal (contoh 4000 atau 4000.50).'
  }
  if (feeType === 'PERCENT') {
    if (!/^\d+(\.\d{1,4})?$/.test(v)) return 'Isi persen dengan titik desimal, maksimal 4 desimal (contoh 0.7).'
    return Number(v) <= 100 ? null : 'Persen tidak boleh lebih dari 100.'
  }
  return 'Jenis biaya tidak dikenal.'
}

/**
 * Batas per transaksi (rev-17 R5). Kosong = tanpa batas (`null`), KECUALI
 * Transfer BNI: wajib diisi dan ≤ plafon kebijakan Rp 10 juta.
 */
export function validateMaxAmount(code: string, raw: string): { value: string | null; error: string | null } {
  const v = raw.trim()
  const isBni = code === BNI_TRANSFER_CODE
  if (v === '') {
    return isBni
      ? { value: null, error: 'Transfer BNI wajib punya batas per transaksi.' }
      : { value: null, error: null }
  }
  if (!/^\d+(\.\d{1,2})?$/.test(v) || Number(v) <= 0) {
    return { value: null, error: 'Isi rupiah lebih dari 0 tanpa titik ribuan, maksimal 2 desimal.' }
  }
  if (isBni && Number(v) > BNI_TRANSFER_POLICY_MAX_IDR) {
    return { value: null, error: 'Transfer BNI tidak boleh melebihi Rp 10.000.000 per transaksi (plafon kebijakan).' }
  }
  return { value: v.includes('.') ? v : `${v}.00`, error: null }
}
