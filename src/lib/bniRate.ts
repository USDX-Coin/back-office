// Kurs beli Transfer BNI (D25 rev 2026-10-02, `sot/api/rate.yaml`,
// `bni-integration.md § 4.3.3`): admin menyalin kurs dari aplikasi wondr by
// BNI ke `bniBuyRate`; sistem mengisi `bniBuyRateUpdatedAt` saat angka itu
// disimpan. Aturan murni layar Kurs.

/** Batas umur sebelum kurs BNI diberi peringatan halus (tampilan saja — bukan aturan backend). */
export const BNI_BUY_RATE_STALE_MS = 24 * 60 * 60 * 1000

/** true kalau `updatedAt` lebih tua dari 24 jam dari `now`. Tak terbaca ⇒ false (tidak menebak). */
export function isBniBuyRateStale(updatedAt: string | null | undefined, now: Date = new Date()): boolean {
  if (!updatedAt) return false
  const t = new Date(updatedAt).getTime()
  if (!Number.isFinite(t)) return false
  return now.getTime() - t > BNI_BUY_RATE_STALE_MS
}

/**
 * Batas wajar kurs BNI (keputusan PM 13 Okt 2026, backend USDX-749): `bniBuyRate`
 * wajib berada dalam ±10% (inklusif) dari kurs dasar baris yang disimpan —
 * MANUAL = `manualRate` baris itu, DYNAMIC = kurs pasar saat disimpan. Di luar
 * itu server menjawab `422 BNI_BUY_RATE_OUT_OF_RANGE`. Klien hanya memberi
 * petunjuk; server yang menentukan (kurs pasar bisa bergeser).
 */
export const BNI_BUY_RATE_MAX_DEVIATION = 0.1

export function bniBuyRateRange(base: string | number | null | undefined): { min: number; max: number } | null {
  const b = typeof base === 'number' ? base : Number(base)
  if (base == null || base === '' || !Number.isFinite(b) || b <= 0) return null
  return { min: b * (1 - BNI_BUY_RATE_MAX_DEVIATION), max: b * (1 + BNI_BUY_RATE_MAX_DEVIATION) }
}

/** true hanya bila angka DAN rentang terbaca, dan angkanya di luar rentang. */
export function isBniBuyRateOutOfRange(raw: string, range: { min: number; max: number } | null): boolean {
  const n = Number(raw.trim())
  if (!range || raw.trim() === '' || !Number.isFinite(n)) return false
  return n < range.min || n > range.max
}

/**
 * Nilai `bniBuyRate` untuk body `POST /api/v1/rate`.
 *
 * Kontrak + backend: field yang DIHILANGKAN = tidak diubah (nilai + jam lama
 * dibawa); `null` eksplisit = dikosongkan; angka yang dikirim — sama sekalipun —
 * disimpan ulang dan `bniBuyRateUpdatedAt` bergeser. Karena itu angka yang sama
 * hanya dikirim bila admin menyatakan sudah mengecek ulang di wondr
 * (`reconfirmed`); menyimpan Y atau spread saja tidak boleh membuat kurs basi
 * tampak baru diperbarui.
 *
 * - `undefined` → jangan kirim (tidak berubah)
 * - `null`      → dikosongkan (Transfer BNI berhenti ditawarkan)
 * - string      → angka baru, atau angka sama yang dicek ulang
 */
export function bniBuyRatePayload(
  input: string,
  current: string | null | undefined,
  opts: { reconfirmed?: boolean } = {},
): string | null | undefined {
  const next = input.trim()
  const prev = current == null || current === '' ? null : current
  if (next === '') return prev === null ? undefined : null
  if (prev !== null && Number(prev) === Number(next)) return opts.reconfirmed ? next : undefined
  return next
}

/** Angka BNI di isian sama dengan yang berlaku (centang "sudah dicek ulang" relevan). */
export function isBniBuyRateUnchanged(input: string, current: string | null | undefined): boolean {
  const next = input.trim()
  return current != null && current !== '' && next !== '' && Number(next) === Number(current)
}

/**
 * Nilai `gatewayMarkupPct` untuk body. Backend: tidak dikirim = tidak diubah.
 * Dikirim hanya bila berubah; kosong = 0 (default kontrak).
 */
export function gatewayMarkupPayload(input: string, current: string | null | undefined): string | undefined {
  const next = input.trim() || '0'
  if (current != null && current !== '' && Number(current) === Number(next)) return undefined
  return next
}
