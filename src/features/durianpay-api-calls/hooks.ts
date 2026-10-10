import { useQuery } from '@tanstack/react-query'
import { apiFetch, apiFetchRaw } from '@/lib/apiFetch'
import {
  buildDurianpayApiCallQueryString,
  type DurianpayApiCallQuery,
} from '@/lib/durianpayApiCalls'
import type {
  DurianpayApiCallDetail,
  DurianpayApiCallListItem,
  PhaseOnePaginatedResponse,
} from '@/lib/types'

// ─────────────────────────────────────────────────────────────────────────────
// Log Panggilan DurianPay — `GET /api/v1/durianpay-api-calls` (+ `/:id`).
//
// DILAYANI MSW di browser: backendnya (branch
// `wisnubarata111/be-catat-log-panggilan-durianpay`) BELUM merge, jadi kedua
// path sengaja ABSEN dari `INTEGRATION_PATHS` — lihat catatannya di
// `src/mocks/browser.ts`.
//
// Matriks peran sisi server (`@Roles` di `durianpay-api-calls.controller.ts`):
//   BACA  list + detail   MANAGER, ADMIN, DEVELOPER   (STAFF → 403)
// Tidak ada satu pun endpoint tulis: modul ini read-only seluruhnya.
//
// TIDAK ADA `pii_access_audit` DI SINI, dan itu bukan kelalaian — service
// backendnya menjelaskannya sendiri: tabelnya tidak MEMUAT PII (nama orang dan
// nomor rekening sudah dibuang SEBELUM insert), jadi tidak ada dekripsi yang
// terjadi dan tidak ada akses PII yang bisa dicatat. Karena itu tidak ada
// disiplin "jangan refetch" seperti di /payout-failures atau /kyc: membaca ulang
// di sini tidak meninggalkan jejak palsu.
// ─────────────────────────────────────────────────────────────────────────────

const BASE_PATH = '/api/v1/durianpay-api-calls'

/** `GET /api/v1/durianpay-api-calls` — satu halaman, TERBARU dulu (urutan server). */
export function useDurianpayApiCalls(query: DurianpayApiCallQuery) {
  return useQuery({
    queryKey: ['durianpay-api-calls', 'list', query],
    queryFn: () =>
      apiFetchRaw<PhaseOnePaginatedResponse<DurianpayApiCallListItem>>(
        `${BASE_PATH}?${buildDurianpayApiCallQueryString(query)}`,
      ),
    // Halamannya terurut TERBARU dulu, jadi tiap panggilan baru menggeser seluruh
    // isi tabel satu baris ke bawah. Menarik ulang saat jendela kembali fokus
    // akan memindahkan baris yang sedang dibaca orang persis saat ia menoleh
    // kembali ke layarnya; tombol "Try again" dan pindah halaman tetap menarik
    // data segar kapan pun ia memintanya.
    refetchOnWindowFocus: false,
  })
}

/**
 * `GET /api/v1/durianpay-api-calls/:id` — satu panggilan, lengkap dengan badan
 * pesan yang sudah diredaksi.
 *
 * `staleTime: Infinity` karena barisnya TIDAK PERNAH berubah: pencatatnya hanya
 * meng-insert (`DurianpayApiCallLogRepository`), tidak ada satu pun jalur yang
 * meng-update sebuah panggilan yang sudah selesai. Satu-satunya yang bisa terjadi
 * kelak adalah barisnya dihapus penyapu retensi — dan itu 404, bukan isi yang
 * bergeser diam-diam.
 */
export function useDurianpayApiCallDetail(id: string | null) {
  return useQuery({
    queryKey: ['durianpay-api-calls', 'detail', id],
    queryFn: () => apiFetch<DurianpayApiCallDetail>(`${BASE_PATH}/${id}`),
    enabled: Boolean(id),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  })
}
