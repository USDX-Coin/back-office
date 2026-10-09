# Redesain back-office fase 1 — SELESAI

Branch `wisnubarata111/back-office-redesain` (lokal, belum di-push, belum PR).
Acuan: mockup PM `scratchpad/mockup-inbox/index.html`, audit `scratchpad/laporan-bo/`.

## Status: selesai (9 Okt 2026)

Angka terakhir:

- `pnpm lint` — 0 error, 3 peringatan (sudah ada sebelum redesain: `DataTable`
  TanStack `incompatible-library`, eslint-disable tak terpakai di `vite.config.ts`).
- `pnpm test` — 118 berkas / 2368 tes hijau.
- `pnpm build` — hijau (peringatan ukuran chunk > 500 kB, sudah ada sebelumnya).
- `E2E_PORT=5197 pnpm test:e2e` — 137/137 hijau, dua kali berturut-turut.
  Tidak ada spec `@integration` Playwright di repo ini.
- Screenshot 1440 + 390, terang + gelap, 19 layar + menu ponsel + login →
  `scratchpad/redesain-f1/` (79 berkas). Diambil dengan mock e2e
  (`installMockApi` + `RUTE_LEBAR_SEL` + rute plafon), bukan backend.

## Yang dikerjakan

1. `feat(brand)` — logo koin + lockup (byte-identik dari landing-page), token
   maroon #800000 / emas #e0a93c (terang + gelap), Inter + Crimson Pro +
   JetBrains Mono, CSP style-src/font-src dibuka.
2. `refactor(tipografi)` — satu gaya judul, label HURUF BESAR mono → Inter.
3. `feat(panel)` — `components/detail-panel/` (DetailPanel, PanelActions +
   konfirmasi inline, SplitView, GroupedTable).
4. `feat(otc)` — `/otc` mint + redeem satu tabel + tanda tangan di panel;
   `/mint`, `/burn` dialihkan.
5. `feat(verifikasi)` — `/verifikasi` gabung KYC + KYB; berkas lengkap tetap
   modal di `/kyc/:id`, `/kyb/:id`.
6. `feat(nasabah)` — Daftar Nasabah dengan panel (`?pilih=`), hapus inline.
7. `feat(menu)` — 5 menu utama, grup bisa dilipat, badge, Beranda dihapus,
   breadcrumb tanpa slug/UUID, `LegacyQueueLinks` di Transaksi.
8. `fix(copy)` — bahasa sehari-hari di layar fase 1 + komponen bersama.
9. Penutup (sesi ini):
   - e2e disesuaikan dengan navigasi baru (Rekening BNI di grup Keuangan,
     badge `nav-badge-transactions`, mode "Normal", grup Pengaturan, Beranda
     hilang) dan distabilkan terhadap data yang dimuat belakangan.
   - Panel detail: bilah tombol dulu jatuh di luar layar 1440×900 → tinggi
     panel kini mengikuti isi, dibatasi layar; di ponsel bilah tombol menempel
     di bawah.
   - Ponsel: tabel OTC/Verifikasi menyembunyikan kolom sekunder (jenis +
     nominal pindah ke bawah nama), lebar minimum 640px hanya ≥ sm → kolom
     Status terlihat tanpa geser.
   - Enum mentah: kolom Jenis di Transaksi ("MINT" → "Mint"), empty state
     Daftar Sanksi ("NO_MATCH" → "Tidak cocok"). Kolom KYC Nasabah dilebarkan.
   - CLAUDE.md root, `src/components`, `src/features`, `e2e` diperbarui.

## Ditunda ke fase 2

- Antrean lama (Persetujuan Pencairan, Pencairan Bermasalah, Mint Bermasalah,
  Perbaiki Status Nyangkut) masih halaman sendiri; dicapai lewat strip
  "Perlu tindakan" di Transaksi dan URL. Fase 2 meleburnya ke tabel Transaksi.
- Transaksi sendiri belum memakai panel kanan (masih modal detail lama).
- `/multisig` (halaman tanda tangan lengkap + Propose) tetap hidup via URL.

## Masalah yang diketahui

- Di mock e2e, panel OTC menampilkan "Isi transaksi tidak cocok dengan
  server" karena hash Safe di data mock tidak dihitung ulang — artefak mock,
  bukan bug layar; perlu dicek sekali di backend dev.
- Tabel lama berbasis `DataTable` (Transaksi, Staf, Jejak Audit, dst.) di
  ponsel tetap tabel yang digeser horizontal.
- Halaman Plafon Pencairan menampilkan pesan galat mentah dari server di
  kartu riwayat saat permintaan gagal (perilaku lama, bukan fase 1).
- Login menampilkan kode galat (`INVALID_CREDENTIALS (UNAUTHORIZED)`) di
  belakang kalimatnya (perilaku lama).
- Warna utama di tema gelap adalah maroon yang diangkat ke merah muda terang
  (kontras teks aman), bukan maroon gelap — perlu dikonfirmasi PM.

## Revisi visual (feedback PM 9 Okt) — WIP, belum selesai

Dihentikan di tengah karena laptop PM harus dimatikan. Lanjutkan 5 poin ini:
1. Light mode bersih & netral (latar abu dingin, kartu putih, tanpa rona merah/krem;
   maroon hanya aksi utama + penanda menu aktif); sidebar & login pakai logo-lockup.png asli.
2. Form dirombak gaya Stripe/Mercury (input putih, border 1px, radius 8, tinggi 40, label rapi,
   tombol kanan bawah, field dikelompokkan).
3. Dialog/Sheet/Popover & semua modal (termasuk antrean lama) dirombak.
4. Semua <select> native → shadcn Select; pilihan panjang → Combobox (cmdk).
5. Masalah diketahui: OTC "Isi transaksi tidak cocok dengan server" di mock; tabel lama geser
   di ponsel; kode galat mentah (login, Plafon) → pemetaan pesan terpusat.
Cek: lint/test/build/e2e hijau; screenshot light 1440 & 390 → scratchpad/redesain-f1b/.
