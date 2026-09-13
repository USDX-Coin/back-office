import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/apiFetch'
import type { QueueCounts } from '@/lib/types'

// ─────────────────────────────────────────────────────────────────────────────
// USDX-678 — hitungan antrean untuk badge sidebar (`sot/api/queue-counts.yaml`,
// `sot/bni-integration.md § 17.9`).
//
// Menggantikan badge yang menarik list `take=1`: list Pencairan Bermasalah dan
// Persetujuan Pencairan mendekripsi rekening dan menulis `pii_access_audit` per
// baris, jadi setiap tarikan badge mencatat akses PII yang tidak pernah terjadi
// (`conventions.md § Audit Akses PII` — "hitungan tidak boleh mendekripsi").
//
// DILAYANI MSW di browser sampai api-dev menyajikan USDX-676 (lihat
// `src/mocks/browser.ts`). Terbuka untuk semua peran back office.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Kunci cache — di-invalidate setelah resolve / approve / reject / ubah ambang,
 * karena masing-masing mengubah isi salah satu antrean.
 */
export const QUEUE_COUNTS_KEY = ['queue-counts'] as const

/**
 * `GET /api/v1/queue-counts`. Satu kunci untuk semua pemakai: `Sidebar` dan
 * `MobileNavDrawer` berbagi SATU request untuk kedua badge. `staleTime` 60 detik
 * menahannya dari tiap perpindahan halaman; tanpa refetch saat fokus.
 */
export function useQueueCounts() {
  return useQuery({
    queryKey: QUEUE_COUNTS_KEY,
    queryFn: () => apiFetch<QueueCounts>('/api/v1/queue-counts'),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  })
}
