import type { QueryClient } from '@tanstack/react-query'

// ─────────────────────────────────────────────────────────────────────────────
// Satu kejadian uang, banyak layar.
//
// Menandatangani / mengeksekusi transaksi Safe, menuntaskan Mint Bermasalah,
// menyelesaikan Pencairan Bermasalah, menyetujui / menolak pencairan, atau
// mengeksekusi Perbaiki Status — semuanya mengubah status ORDER / permintaan
// OTC yang sama, dan order itu dirender di beberapa layar sekaligus: Transaksi
// gabungan, rincian order, OTC, Antrean Tanda Tangan, badge sidebar. Dulu tiap
// mutasi hanya menyegarkan kuncinya sendiri (mis. tanda tangan Safe hanya
// `['multisig', …]`), jadi Transaksi tetap "Menunggu pembayaran" sampai
// `staleTime` global 60 dtk lewat.
//
// Kuncinya ditulis MENTAH di sini, bukan diimpor dari fitur: lib tidak boleh
// bergantung ke `features/` (fitur-fitur itu sendiri mengimpor berkas ini).
// Kesamaannya dengan konstanta milik fitur dijaga test
// (`__tests__/moneyFlowViews.test.ts`).
//
// Yang SENGAJA tidak ada di daftar:
//   - detail Safe (`['multisig', 'detail', id]`) — mutasi Safe menyegarkan id
//     yang dikirimnya sendiri; detail lain dipoll selama belum final.
//   - `['multisig', 'safes']` — RPC lambat, tidak berubah karena kejadian uang.
//   - detail yang menulis `pii_access_audit` (rincian order redeem
//     `['orders', 'detail', id]`, KYC/KYB, Pencairan Bermasalah, Persetujuan
//     Pencairan, held-credits) — menandai SEMUANYA basi berarti order redeem
//     yang dibuka ulang dalam semenit ditarik lagi = satu baris audit ekstra
//     untuk kejadian (mis. propose governance) yang tidak menyentuh order itu.
//     Hanya rincian order yang MEMANG terkena (`orderId`) yang ditandai.
// ─────────────────────────────────────────────────────────────────────────────

export const MONEY_FLOW_VIEW_KEYS = [
  // Antrean Tanda Tangan + "x dari y" di OTC (`useOtcSafeQueue` ada di bawah
  // `['multisig', 'list']`) + angka tab.
  ['multisig', 'list'],
  ['multisig', 'count'],
  // Daftar order nasabah — DAFTAR saja; rincian lewat `orderId` di bawah.
  ['orders', 'list'],
  // Transaksi gabungan (`BACKOFFICE_TRANSACTIONS_KEY`).
  ['backoffice-transactions'],
  // Permintaan OTC: tabel, detail, angka sub-menu.
  ['requests'],
  // Badge sidebar (`QUEUE_COUNTS_KEY`) — `refetchOnWindowFocus: false` dan
  // Sidebar tidak pernah unmount, jadi tanpa ini angkanya membeku.
  ['queue-counts'],
] as const

/**
 * Tandai semua layar alur uang basi. Query yang sedang tampil ditarik ulang
 * sekarang; sisanya ditarik saat dibuka lagi. Dipanggil sesudah mutasi yang
 * mengubah status order / permintaan / transaksi Safe.
 *
 * `orderId` = order yang benar-benar terkena kejadian ini (mis.
 * `linkedOrderId` transaksi Safe, id order antrean redeem). Hanya rincian order
 * itu yang ditandai basi — lihat catatan `pii_access_audit` di atas.
 */
export function invalidateMoneyFlowViews(
  qc: QueryClient,
  { orderId }: { orderId?: string | null } = {},
): void {
  for (const queryKey of MONEY_FLOW_VIEW_KEYS) {
    void qc.invalidateQueries({ queryKey })
  }
  if (orderId) void qc.invalidateQueries({ queryKey: ['orders', 'detail', orderId] })
}

/**
 * `staleTime` untuk query alur uang yang dibaca ops sebelum bertindak (detail
 * Safe, detail permintaan OTC, daftar Transaksi gabungan): cache tetap dipakai
 * untuk menggambar seketika, tapi membuka ulang / kembali ke tab SELALU menarik
 * ulang. `staleTime` global 60 dtk (`App.tsx`) membuat modal yang dibuka ulang
 * dalam semenit memutar status lama tanpa request apa pun.
 *
 * JANGAN dipakai untuk query yang menulis `pii_access_audit` (rincian order
 * `GET /orders/{id}` untuk redeem, KYC/KYB, Pencairan Bermasalah, Persetujuan
 * Pencairan): tiap tarikan di sana adalah satu baris audit "staf membuka
 * rekening", jadi mereka sengaja tidak refetch lebih sering.
 */
export const MONEY_FLOW_STALE_TIME = 0
