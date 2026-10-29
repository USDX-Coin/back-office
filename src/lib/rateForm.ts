// Aturan murni form "Ubah kurs" (layar Kurs & Biaya).
//
// Dulu berkas ini bernama `bniRate.ts` dan memuat aturan isian "Kurs BNI dari
// wondr" (umur, rentang, payload). Isian itu dicabut di USDX-749 (keputusan PM
// 14 Okt 2026): Transfer BNI kini transfer USD tanpa kurs BNI. Isinya kini:
// payload markup Virtual Account, payload X mode kurs BNI (D28), dan pesan
// `422 RATE_SOURCE_UNAVAILABLE` saat pindah ke mode BNI ditolak.

import { ApiError } from './apiFetch'

/**
 * Nilai `gatewayMarkupPct` untuk body. Backend: tidak dikirim = tidak diubah.
 * Dikirim hanya bila berubah; kosong = 0 (default kontrak).
 */
export function gatewayMarkupPayload(input: string, current: string | null | undefined): string | undefined {
  const next = input.trim() || '0'
  if (current != null && current !== '' && Number(current) === Number(next)) return undefined
  return next
}

/**
 * Nilai `bniRateMaxDeviationPct` (X, D28) untuk body. Kontrak: dihilangkan =
 * X config aktif dibawa apa adanya. Isian diisi = dikirim apa adanya (juga saat
 * sama dengan X aktif — append-only, dan cek transisi D28-i memakai X dari
 * request yang sama); dikosongkan = tidak dikirim.
 */
export function bniDeviationPayload(input: string): string | undefined {
  const trimmed = input.trim()
  return trimmed === '' ? undefined : trimmed
}

/**
 * `422 RATE_SOURCE_UNAVAILABLE` (D28-i, `bni-integration.md` §20.4 rev-31):
 * pindah ke mode BNI ditolak. `error.details.reason` menentukan langkahnya —
 * `BNI_DEVIATION` → naikkan X lalu kirim ulang sesudah `quoteId` berikutnya
 * (cache bni-service ≤ 2 menit); alasan lain → BNI sedang tidak bisa diambil.
 * Galat lain → `null` (ditangani pesan umum form).
 */
export function rateSourceUnavailableMessage(err: unknown): string | null {
  if (!(err instanceof ApiError) || err.code !== 'RATE_SOURCE_UNAVAILABLE') return null
  const reason = (err.details as { reason?: unknown } | null | undefined)?.reason
  if (reason === 'BNI_DEVIATION') {
    return 'Kurs BNI ditolak pengaman pergeseran — naikkan batas pergeseran (X) lalu coba lagi dalam ±2 menit.'
  }
  return 'Kurs BNI sedang tidak bisa diambil, mode BNI belum bisa dipilih.'
}
