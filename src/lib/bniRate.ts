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
 * Nilai `bniBuyRate` untuk body `POST /api/v1/rate`.
 *
 * Kontrak: field yang DIHILANGKAN = nilai config aktif dibawa apa adanya dan
 * `bniBuyRateUpdatedAt` tidak bergeser. Karena itu field ini hanya dikirim bila
 * admin benar-benar mengubah angkanya — menyimpan Y atau spread saja tidak
 * boleh membuat kurs BNI yang basi tampak baru diperbarui.
 *
 * - `undefined` → jangan kirim (tidak berubah)
 * - `null`      → dikosongkan (Transfer BNI berhenti ditawarkan)
 * - string      → angka baru
 */
export function bniBuyRatePayload(
  input: string,
  current: string | null | undefined,
): string | null | undefined {
  const next = input.trim()
  const prev = current == null || current === '' ? null : current
  if (next === '') return prev === null ? undefined : null
  if (prev !== null && Number(prev) === Number(next)) return undefined
  return next
}
