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

## Revisi visual (feedback PM 9 Okt) — tahap A SELESAI

Lima poin PM, dan apa yang dikerjakan:

1. **Light mode netral.** Token abu dingin (kanvas #f6f7f9, kartu putih, garis
   #e5e7eb) sudah dari WIP; sisa rona maroon/krem di permukaan dibuang: kotak
   "Perkiraan pendapatan"/"Langkah berikutnya" di detail order, badge
   `bg-primary/10`, sorotan baris terpilih (kini abu + garis kiri gelap), hover
   tautan, kotak "Yang perlu kamu lakukan" di panel (kini netral, nada hanya di
   labelnya), label grup "Perlu tindakan" (tidak lagi maroon). Maroon tinggal di
   tombol utama, menu aktif, dan tautan. Sidebar + login memakai
   `logo-lockup.png` asli.
2. **Form gaya Stripe/Mercury** — `components/FormLayout.tsx` (`FormSection`,
   `FormField`, `FormFooter`): field dikelompokkan per bagian, label + keterangan
   di bawah label, galat di bawah isian, tombol di kanan bawah pada pita abu
   (tidak lagi selebar form). Dipakai form mint OTC, redeem OTC, kurs, biaya,
   batas Safe, entri cadangan.
3. **Dialog/sheet** — `components/DataList.tsx` (`DataSection`, `DataField`):
   satu pasangan label–nilai per baris, label kiri, garis tipis (container query:
   di wadah sempit label naik ke atas). Semua salinan lokal `Field`/`Section` di
   11 modal/sheet lama (detail order, pencairan bermasalah, mint bermasalah,
   persetujuan, jejak audit, KYC, KYB, sanksi, log DurianPay, multisig,
   rekening tujuan) mendelegasikan ke sini. Titik status di badge dibuang (pola
   Stripe: badge teks tanpa titik). Peran di dialog Staf tampil sebagai kata.
4. **Dropdown** — grep `<select` di `src/` = 0. Pilihan panjang (99 pekerjaan
   Permendagri di form KYB) → `components/OptionCombobox.tsx` (cmdk dengan
   kotak cari); `EnumSelect` otomatis memakainya bila opsinya > 15.
5. **Masalah diketahui:**
   - (a) **Akar "Isi transaksi tidak cocok dengan server"**: data tiruan e2e
     (`e2e/support/mock-api.ts`) memberi `safeTxHash` angka karangan
     `0x5555…`/`0x6666…`. Layar menghitung ulang hash EIP-712 SafeTx dari isi
     detailnya (to/value/data/operation/nonce + alamat Safe, chainId 137) lewat
     `safeTxHashMatches` sebelum mengizinkan tanda tangan — hash karangan tidak
     mungkin cocok. Layarnya benar (pagar anti blind-sign), datanya yang salah.
     Perbaikan: mock menghitung hash dengan `computeSafeTxHash` yang sama;
     e2e OTC kini menegaskan peringatan itu TIDAK muncul.
   - (b) **Tabel lama di ponsel**: `DataTable` di < 640px merender baris sebagai
     kartu (kolom pertama judul, sisanya label–nilai) — Transaksi, Staf, Jejak
     Audit, antrean lama, dst. tidak perlu digeser. Pilihan tampilan lewat
     `matchMedia` (`lib/useMediaQuery.ts`), jadi Vitest tetap melihat tabel.
   - (c) **Kode galat mentah** → peta terpusat `lib/errorMessages.ts`
     (`humanizeError`, `ErrorNotice`, `toastError`): login, Plafon, tanda tangan
     Safe, unduh CSV laporan, kontak darurat, nasabah (EMAIL/PHONE_ALREADY_REGISTERED,
     WALLET_ALREADY_EXISTS mengikuti kode backend). Kode server tetap ada di
     "Detail teknis". Yang SENGAJA tetap menampilkan pesan server apa adanya
     (terdokumentasi di CLAUDE.md): 422 mode uji mint, 422 per-field biaya,
     alasan bank BNI.
   - Panel detail di ponsel: bilah tombol yang menempel kini menutup celah
     padding `<main>` (isi panel dulu terlihat di bawah tombol).

Angka tahap A (9 Okt 2026): `pnpm lint` 0 error (3 peringatan lama) ·
`pnpm test` 118 berkas / 2368 tes hijau · `pnpm build` hijau ·
`E2E_PORT=5197 pnpm test:e2e` 137/137 hijau. Screenshot terang 1440 + 390
(96 berkas) → `scratchpad/redesain-f1b/`.
