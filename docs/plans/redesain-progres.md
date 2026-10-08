# Redesain back-office fase 1 — catatan progres

Branch `wisnubarata111/back-office-redesain` (lokal, belum di-push). Acuan:
mockup PM `scratchpad/mockup-inbox/index.html`, audit `scratchpad/laporan-bo/`.

## Sudah selesai (sudah di-commit)

1. `feat(brand)` — logo koin + lockup (byte-identik dari landing-page), token
   maroon #800000 / emas #e0a93c (terang + gelap), Inter + Crimson Pro +
   JetBrains Mono dari Google Fonts, CSP style-src/font-src dibuka.
2. `refactor(tipografi)` — PageHeader tanpa eyebrow/serif miring; label HURUF
   BESAR mono → Inter biasa (74 berkas).
3. `feat(panel)` — `components/detail-panel/` (DetailPanel, PanelActions +
   konfirmasi inline "Sudah benar semua?", SplitView, GroupedTable) + tes.
4. `feat(otc)` — `/otc` (mint + redeem OTC satu tabel, dua tarikan status CSV,
   status tanda tangan dari /multisig lewat safeTxHash, panel kanan dengan
   tanda tangan/eksekusi via `useSafeTxSigning`), /mint & /burn dialihkan.
5. `feat(verifikasi)` — `/verifikasi` gabung KYC + KYB, panel ringkas tanpa
   baca PII, berkas lengkap tetap di `/kyc/:id`, `/kyb/:id` (modal).
6. `feat(nasabah)` — Daftar Nasabah dengan panel (`?pilih=`), hapus inline.
7. `feat(menu)` — 5 menu utama (NavTree, grup bisa dilipat, badge jumlah),
   Beranda dihapus (→ /transactions), breadcrumb tanpa slug/UUID,
   `LegacyQueueLinks` di halaman Transaksi.
8. `fix(copy)` — temuan copy audit di layar fase 1 + komponen bersama.

Unit test terakhir: 118 file / 2368 tes hijau; lint 0 error; tsc bersih.

## Sedang dikerjakan (commit WIP)

- E2E: spec diperbarui untuk struktur baru — auth, otc (form → /otc), kyc
  (Verifikasi), users (panel + hapus inline), transactions; spec baru
  `e2e/usdx-otc-page.spec.ts`; `usdx-26-requests.spec.ts` dihapus (diganti).
  `e2e/support/mock-api.ts`: status CSV di /requests, /multisig (+ :id, safes),
  /kyb list.
- FilterPopover diberi max-height (tombol Terapkan dulu jatuh di luar layar).
- Verifikasi: riwayat default "semua keputusan" (VERIFIED + REJECTED via
  `useQueries`), supaya berkas yang baru diputus tetap terlihat.

## Langkah berikutnya

1. Lanjutkan perbaikan e2e yang masih merah (jalankan
   `E2E_PORT=5197 pnpm test:e2e`): usdx-631 (menu "Treasury" → grup Keuangan,
   title pullId lama), usdx-639 (MANAGER: menu "Pengaturan" → "Kurs & Biaya"),
   usdx-662 & usdx-678 (badge kini di menu Transaksi / LegacyQueueLinks),
   usdx-lebar-sel (halaman Mint/Burn OTC lama → /otc), usdx-245, usdx-547.
2. `pnpm lint && pnpm test && pnpm build` hijau.
3. Screenshot Playwright 1440 + 390, terang + gelap → `scratchpad/redesain-f1/`.
4. Perbarui CLAUDE.md (root, features, components, e2e) sesuai struktur baru.
5. Laporan akhir: daftar commit, per menu, yang ditunda ke fase 2, angka
   lint/test/build/e2e, path screenshot, ≤3 keputusan PM.
