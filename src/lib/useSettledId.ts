import { useEffect, useState } from 'react'

/** Jeda sebelum berkas berikutnya ditarik saat ↑/↓ ditekan beruntun. */
export const SETTLE_MS = 400

/**
 * Id yang boleh DITARIK, untuk detail yang tiap pembacaannya menulis satu baris
 * `pii_access_audit` (modal KYC/KYB). Menahan ↓ melewati banyak baris; tanpa
 * jeda tiap baris yang dilewati sekilas tercatat sebagai "dibuka", padahal
 * petugas tidak melihat PII siapa pun.
 *
 * - Membuka modal (dari `null`) dan menutupnya: langsung.
 * - Pindah ke id lain: `null` dulu (modal menampilkan kerangka memuat), lalu id
 *   baru setelah `ms` tanpa perpindahan lagi.
 * - `isReady(id)` benar (mis. detailnya sudah di cache, jadi tidak ada request
 *   dan tidak ada audit baru): langsung.
 *
 * Nilai dibuang SAAT RENDER, bukan di efek: tidak ada satu frame pun yang
 * memasangkan id baru dengan detail id lama.
 */
export function useSettledId(
  id: string | null,
  { ms = SETTLE_MS, isReady }: { ms?: number; isReady?: (id: string) => boolean } = {},
): string | null {
  const [settled, setSettled] = useState(id)
  const [prev, setPrev] = useState(id)
  if (id !== prev) {
    setPrev(id)
    setSettled(prev === null || id === null || isReady?.(id) ? id : null)
  }

  useEffect(() => {
    if (settled === id) return
    const t = setTimeout(() => setSettled(id), ms)
    return () => clearTimeout(t)
  }, [id, settled, ms])

  return settled
}
