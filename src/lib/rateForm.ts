// Aturan murni form "Ubah kurs" (layar Kurs & Biaya).
//
// Dulu berkas ini bernama `bniRate.ts` dan memuat aturan isian "Kurs BNI dari
// wondr" (umur, rentang, payload). Isian itu dicabut di USDX-749 (keputusan PM
// 14 Okt 2026): Transfer BNI kini transfer USD tanpa kurs BNI. Yang tersisa
// hanya aturan payload markup Virtual Account.

/**
 * Nilai `gatewayMarkupPct` untuk body. Backend: tidak dikirim = tidak diubah.
 * Dikirim hanya bila berubah; kosong = 0 (default kontrak).
 */
export function gatewayMarkupPayload(input: string, current: string | null | undefined): string | undefined {
  const next = input.trim() || '0'
  if (current != null && current !== '' && Number(current) === Number(next)) return undefined
  return next
}
