// Antrean Tanda Tangan dalam bahasa ops (PM Okt 2026: "ops fokus ke transaksi,
// bukan on-chain"). Ops tidak perlu paham alamat, hash, calldata, nonce, atau
// EIP-712 untuk tahu APA yang sedang ditandatangani: siapa, berapa, untuk apa,
// statusnya apa. Nilai mentah tetap ada di "Detail teknis" — dilipat, bukan
// dibuang. Fungsi murni, tanpa React.

import type { SafeActivity, SafeTxListItem, SafeTxSigner, SafeType } from '@/lib/types'
import { getActivityLabel } from './status'

const ADDRESS_TAIL = /\s*(?:→|->|ke|to|untuk)\s*0x[0-9a-fA-F]{4,}\S*.*$/
const BARE_ADDRESS = /0x[0-9a-fA-F]{6,}\S*/g

/**
 * Judul aktivitas tanpa alamat: `"Mint 100 USDX → 0xAbc…"` → `"Mint 100 USDX"`.
 * Label kosong / hanya alamat → nama aktivitas dari enum (`Mint`, `Burn`, …).
 */
export function safeTxHeadline(activityLabel: string | null | undefined, activity: SafeActivity): string {
  const cleaned = (activityLabel ?? '')
    .replace(ADDRESS_TAIL, '')
    .replace(BARE_ADDRESS, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
  return cleaned || getActivityLabel(activity)
}

/** Nominal yang disebut label (`"Mint 100 USDX"` → `"100 USDX"`), atau `null`. */
export function safeTxAmount(activityLabel: string | null | undefined): string | null {
  const m = /(\d[\d.,]*)\s*USDX\b/i.exec(activityLabel ?? '')
  return m ? `${m[1]} USDX` : null
}

/** Safe sebagai kata: `STAFF` → "Safe Staf", `MANAGER` → "Safe Manager". */
export function safeTypeLabel(safeType: SafeType | string | null | undefined): string {
  if (safeType === 'STAFF') return 'Safe Staf'
  if (safeType === 'MANAGER') return 'Safe Manager'
  return safeType ? `Safe ${String(safeType).toLowerCase()}` : 'Safe'
}

/** Nama penanda tangan untuk layar; alamatnya hanya di Detail teknis. */
export function signerDisplayName(signer: SafeTxSigner, index: number): string {
  if (signer.staffName) return signer.staffName
  if (signer.isBackend) return 'Sistem (otomatis)'
  return `Pemilik Safe ${index + 1}`
}

/** Siapa yang mengajukan, sebagai kata. */
export function proposerLabel(
  item: Pick<SafeTxListItem, 'proposerType' | 'proposerAddress'>,
  signers?: SafeTxSigner[] | null,
): string {
  if (item.proposerType === 'BACKEND') return 'Sistem (otomatis)'
  const match = signers?.find((s) => s.address.toLowerCase() === item.proposerAddress.toLowerCase())
  return match?.staffName ?? 'Petugas'
}

/** Status dalam satu kalimat biasa — isi kotak status di modal. */
export function safeTxStatusSentence(
  item: Pick<SafeTxListItem, 'status' | 'signatureProgress'>,
  extra: { executedBy?: string | null } = {},
): string {
  const { collected, threshold } = item.signatureProgress
  const remaining = Math.max(threshold - collected, 0)
  switch (item.status) {
    case 'PENDING_SIGN':
      return remaining > 0
        ? `Menunggu ${remaining} tanda tangan lagi (${collected} dari ${threshold} sudah).`
        : 'Tanda tangan sedang dihitung ulang.'
    case 'READY_TO_EXECUTE':
      return 'Tanda tangan sudah lengkap. Tinggal dieksekusi.'
    case 'CONFIRMING':
      return 'Sudah dikirim, sedang menunggu konfirmasi jaringan.'
    case 'EXECUTED':
      return extra.executedBy ? `Sudah selesai, dieksekusi oleh ${extra.executedBy}.` : 'Sudah selesai dieksekusi.'
    case 'FAILED':
      return 'Eksekusi gagal. Lihat keterangan di bawah.'
    case 'CANCELLED':
      return 'Dibatalkan. Tidak ada yang perlu dilakukan.'
    default:
      return 'Statusnya belum dikenali.'
  }
}

// Alasan tombol mati dari `useSafeTxSigning` (hook-nya tidak diubah), diterjemahkan
// ke bahasa ops di layar ini saja. Kalimat yang tidak dikenal dibiarkan apa adanya.
const PLAIN_REASON: Record<string, string> = {
  'Memeriksa status owner Safe…': 'Memeriksa apakah wallet ini pemilik Safe…',
  'Status owner Safe tidak bisa diperiksa — coba lagi lewat tombol di bawah':
    'Belum bisa memastikan wallet ini pemilik Safe — tekan Coba lagi di atas.',
  'Wallet yang terhubung bukan owner Safe ini': 'Wallet yang terhubung bukan pemilik Safe ini.',
  'Hash SafeTx tidak cocok — tanda tangan dimatikan': 'Isi transaksi tidak cocok dengan server — dikunci.',
  'Centang dulu peringatan calldata tidak terbaca supaya bisa menandatangani':
    'Centang dulu peringatan "isi tidak terbaca" di atas.',
  'Exec payload belum tersedia': 'Data eksekusi belum tersedia dari server.',
  'Sedang disimulasikan…': 'Sedang diuji coba…',
  'Simulasi gagal — eksekusinya akan ditolak kontrak': 'Uji coba gagal — eksekusi akan ditolak.',
  'Simulasi tidak bisa dijalankan — RPC tidak terjangkau, coba lagi': 'Uji coba tidak bisa dijalankan — coba lagi.',
  'Menunggu hasil simulasi': 'Menunggu hasil uji coba.',
}

/** Alasan tombol mati dari hook → kalimat ops. */
export function plainReason(reason: string | null | undefined): string | null {
  if (!reason) return null
  return PLAIN_REASON[reason] ?? reason
}

