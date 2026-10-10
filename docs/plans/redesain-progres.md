# Redesain back-office fase 1 — SELESAI

Branch `wisnubarata111/back-office-redesain` (di-push, belum PR).
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

## Fase 2 (SOT PR #50, ⚠️ DRAF) — SELESAI dengan data tiruan

Kontrak: `USDX-Coin/sot#50` (`api/backoffice-transactions.yaml`,
`api/payment-methods.yaml`, `queue-counts.yaml`, `bni-integration.md § 4.3.11`).
Backend belum ada → semua endpoint baru dilayani MSW (`src/mocks/handlers.ts`)
dan mock e2e (`e2e/support/mock-api.ts`), dan terdaftar di
`scripts/backend-requirements.json` supaya `pnpm cek:backend` menahan merge.

1. **Transaksi gabungan** (`features/transactions/TransactionsPage.tsx`,
   menggantikan "User Transaction"): satu daftar MINT/REDEEM/uang masuk tanpa
   order dari `GET /api/v1/transactions`; dua tarikan `needsAction=true|false`
   (perlu tindakan di atas, terlama dulu; sisanya berhalaman). Tanpa nomor
   rekening. Saringan kontrak: jenis, tindakan, pemilik, `q` (≥ 3 huruf).
   Mint nyangkut = predikat server (2 jam sejak `paid_at`). Klik baris → panel
   kanan (`TransactionDetailPanel`) — dibangun dari baris list saja, jadi
   membuka panel tidak membaca PII. Tombol aksi membuka DIALOG ANTREAN ASAL yang
   sudah ada (`TransactionActionDialog`: setujui/tolak pencairan, kirim
   ulang/tandai manual/tutup pencairan bermasalah, terima/tolak uang masuk,
   perbaiki status) — detail antrean baru ditarik saat tombol ditekan.
   `PAYOUT_STUCK` = "dipantau" tanpa tombol; tindakan tak dikenal tanpa tombol.
   "Lihat rincian order" membuka modal detail lama (fee/spread/rekening).
   Badge menu = `queue-counts.transactionsNeedsAction` (kunci absen ⇒ badge
   disembunyikan, sesuai kontrak).
2. **Peleburan antrean lama**: strip "Perlu tindakan" (`LegacyQueueLinks`) dan
   halaman daftar lama dihapus; keempat antrean tidak ada di navigasi mana pun.
   Rutenya tetap hidup untuk tautan langsung ("Buka di antrean").
3. **Pengaturan → Metode Pembayaran** (`/settings/payment-methods`, Admin ubah,
   Developer baca): nyala/mati (alasan wajib; mematikan metode terakhir yang
   ditawarkan minta centang konfirmasi — M8), ubah biaya `FLAT_IDR`/`PERCENT` +
   batas per transaksi (Transfer BNI wajib, ≤ Rp 10 juta), ubah urutan (naik/
   turun, simpan sekali `PUT`), jejak perubahan dari `activity-logs`
   `resourceType=PAYMENT_METHOD` (Admin). Pengaman Transfer BNI: 409
   `PAYMENT_METHOD_PREREQUISITE_UNMET` tampil di dialog dalam kalimat biasa;
   mock meniru production yang belum menyatakan prasyarat D23.

Angka fase 2: `pnpm lint` 0 error (3 peringatan lama) · `pnpm test` 118 berkas /
2344 tes hijau (tes layar lama ikut terhapus bersama layarnya) · `pnpm build`
hijau · `E2E_PORT=5197 pnpm test:e2e` 121/121 hijau (spec USDX-206/245/547 milik
layar lama diganti `usdx-transaksi-gabungan.spec.ts`). Screenshot terang 1440 +
390 (108 berkas) → `scratchpad/redesain-f2/`.

### Pertanyaan terbuka untuk PM (SOT diam / bertentangan)

1. **Menu antrean lama**: SOT week2.md bilang keempat menu antrean lama "tetap
   ada di rilis ini; menyembunyikannya keputusan terpisah", sedangkan arahan PM
   sesi ini "dilebur lalu dihapus dari navigasi". Dikerjakan sesuai arahan PM
   (rute tetap hidup lewat URL). Perlu SOT disamakan.
2. **Jejak `PAYMENT_METHOD_REORDERED`**: kontrak tidak menyebut `resource_type`
   untuk baris urutan (hanya untuk UPDATED = `PAYMENT_METHOD`). Layar menyaring
   `resourceType=PAYMENT_METHOD`; kalau backend memakai nilai lain, perubahan
   urutan tidak muncul di jejak.
3. **Form Biaya** masih menampilkan PG fee VA/QRIS: SOT bilang dikeluarkan, tapi
   backend dev masih mewajibkannya di `POST /fee-config`. Tidak diubah sampai
   backend payment-methods naik (menghapusnya duluan membuat simpan biaya gagal).
4. **Detail baris uang masuk** (`INCOMING_UNMATCHED`): kontrak menunjuk
   `GET /api/v1/held-credits/{id}`; panel memakai data list + dialog resolve
   (yang menarik detail itu). Belum ada "rincian lengkap" terpisah untuk baris
   ini — konfirmasi apakah perlu.
5. **Kolom Partner**: list kontrak hanya membawa `partnerCode`, bukan nama
   tampilan partner seperti layar lama (USDX-547). Layar menampilkan kodenya.

## Fase 3 (arahan PM 10 Okt 2026) — SELESAI dengan data tiruan

Empat pekerjaan, satu commit per bagian (di-push, belum PR):

1. **Transaksi** (`0f7d4c3`) — panel samping dibuang. Tabel lebar penuh dengan
   tab **Perlu tindakan (n)** (bawaan, `needsAction=true`) / **Semua**; kolom
   Status · Jenis · Nasabah · Nominal (kanan, Inter tabular) · Referensi
   (nomor order, pendek) · Waktu; tanpa rekening. Klik baris → modal tengah
   `/transactions/:id` (`components/record-modal/RecordModal`, pola modal Log
   DurianPay): judul + subjudul, seksi label–nilai, Detail teknis, footer aksi
   antrean asal yang selalu terlihat (Setujui/Tolak pencairan, Kirim ulang /
   Tandai manual / Tutup, Terima/Tolak uang masuk, Perbaiki status, Lihat
   rincian order). Navigasi ↑/↓ (tombol + panah/`j`/`k`) di daftar yang sedang
   tersaring tanpa menutup modal. Detail antrean tetap ditarik saat tombol
   ditekan; badge menu tetap `transactionsNeedsAction`. `TransactionDetailPanel`
   dihapus; komponen `detail-panel/` tetap karena Verifikasi & Daftar Nasabah
   masih memakainya.
2. **OTC ▸ Mint / Redeem** (`5e4f7b9`) — grup menu, `/otc/mint` dan
   `/otc/redeem` masing-masing tabel sendiri + tombol buatnya, badge per
   sub-menu (`/api/v1/requests?…&type=`). Detail = modal tengah yang sama
   (`/otc/{mint,redeem}/:id`), tanda tangan/eksekusi Safe + konfirmasi di
   footer. `/otc`, `/otc/:id`, `/mint`, `/burn` (+ `/:id`) dialihkan;
   `?jenis=burn` → Redeem. `OtcDetailPanel` dihapus.
3. **Audit font** (`ccbd52d`) — token per peran di `src/index.css` (lihat
   CLAUDE.md § Tipografi): 11px & 18px dibuang, judul halaman Crimson 28/32,
   judul modal/dialog/sheet Crimson 20/26, seksi 14/20, label/badge 12/16 500,
   uang 13/20 & 24/28. `tracking-tight`/`leading-none` di angka dibuang,
   `tailwind-merge` mengenal token baru. JetBrains Mono **323 → 104** baris
   (keduanya termasuk 1 komentar): sisanya hash, ID, alamat wallet, path API, JSON/nilai mentah
   di Detail teknis, nomor order/referensi, nama kolom CSV. Satu gaya status
   (`STATUS_CHIP_BASE`). Cadangan kini `51.249,75`. Kode mentah → label
   (penyebab & status order Pencairan Bermasalah, sebab tertahan & status
   pembayaran Mint Bermasalah, aksi/objek Jejak Audit, kode metode
   pembayaran, penyedia & cara bayar rincian order, peran di Profil); kode
   asli di `title`/Detail teknis. `text-2xl` mati di Profil diperbaiki.
4. **Ringkasan** (`41f6743`) — `/ringkasan`, menu pertama, halaman setelah
   login (`/dashboard` dialihkan). Data: `queue-counts`, `dashboard/stats`
   (pasokan on-chain Polygon, Safe Staf/Manager, kurs beli; angka OTC berlabel
   khusus OTC), saldo BNI hanya lewat **Cek saldo** (opsi query Rekening BNI,
   waktu tarikan tampil), cadangan (Admin & Developer, "dicatat manual oleh
   admin, bukan saldo bank live"), DurianPay "Belum tersedia".

Perbaikan dari screenshot: kartu saldo BNI dan Plafon Pencairan menumpuk
nominal (24px tidak muat dua kolom), pil status di judul dialog dipaksa Inter.

Angka fase 3: `pnpm lint` 0 error (3 peringatan lama) · `pnpm test` 119 berkas
/ 2363 tes hijau · `pnpm build` hijau (peringatan ukuran chunk lama) ·
`E2E_PORT=5197 pnpm test:e2e` 129/129 hijau dua kali berturut-turut (spec baru
`usdx-ringkasan.spec.ts`; modal Transaksi & OTC di spec masing-masing).
Screenshot terang 1440 + 390 → `scratchpad/redesain-f3/`.

### Pertanyaan terbuka untuk PM (fase 3)

1. **Tab "Selesai" / "Gagal" di Transaksi** belum dibuat: parameter `status`
   di `GET /api/v1/transactions` (SOT PR #50) hanya menerima SATU nilai,
   sedangkan "selesai" = `COMPLETED` (mint) + `PAYOUT_COMPLETE` (redeem) dan
   "gagal" = `FAILED` (mint) + `PAYOUT_FAILED` + `EXPIRED` (redeem).
   Perlu kontrak menerima beberapa `status` (atau nilai gabungan seperti
   `outcome=DONE|FAILED`) — mana yang dipilih?
2. **Navigasi ↑/↓** hanya di halaman daftar yang sedang dimuat (20 baris);
   di baris terakhir tombol "Berikutnya" mati, tidak pindah halaman otomatis.
3. **Total dibakar OTC** di Ringkasan = backend menjumlah `burn_requests`
   berstatus `EXECUTED` saja (bukan `IDR_TRANSFERRED`) — labelnya ditulis
   jujur ("berstatus Dieksekusi"); kalau maksudnya semua redeem OTC yang
   selesai, backend perlu diubah.
4. **Pasokan beredar** dijawab `"0"` oleh backend kalau rantai belum
   dikonfigurasi (`readTotalSupplyOrZero`) — layar tidak bisa membedakan nol
   sungguhan dari "belum dikonfigurasi".

### Belum dikerjakan / sengaja dibiarkan

- `unknownStatusLabel` ("Status belum dikenali (KODE)") untuk status yang
  belum ada di `types.ts` masih mencetak kodenya — perilaku lama untuk nilai
  masa depan, di luar daftar audit.
- Screenshot `m6-kyc-detail` menampilkan "Data tidak ditemukan" dan
  `m9-konfirmasi-kurs` tidak membuka dialog — artefak data tiruan skrip
  screenshot (sama seperti fase 2), bukan bug layar.

## Ops fokus + format waktu (GO PM 10 Okt) — SELESAI (11 Okt 2026)

Halaman galat (404/403/sesi habis) selesai di `ef8a717`; ops fokus di `958a790`;
format waktu WIP `08b853b` dituntaskan di `3d451aa` + `c0fc798` + commit penutup.

**A. Ops fokus ke transaksi**
- `/multisig/:id` = modal tengah `MultisigDetailModal` (pola `RecordModal walletSafe`):
  penanda tangan dengan nama + Sudah/Belum, satu tombol per tahap di footer sticky
  (Hubungkan wallet → Pindah ke Polygon → Tanda tangani → Eksekusi), jendela wallet
  RainbowKit bisa diklik (e2e). Isi transaksi yang tidak cocok dengan server memunculkan
  peringatan kalimat biasa dan mengunci tanda tangan + eksekusi.
- `useSafeTxSigning`: sejak sebelum ops-fokus (`958a790^`) hanya komentar yang berubah.
  (Terhadap `origin/dev` berkas ini baru seluruhnya — diekstrak dari `MultisigDetailSheet`
  di commit fase 1 PR ini, `76d6fdb`.)
- Sisir: Pencairan Bermasalah (tx burn), dialog Setujui pencairan, modal OTC (alamat
  Safe/nonce/hash) → Detail teknis; kolom "Bukti pembakaran" Persetujuan Pencairan dan
  kolom "Jaringan" + "Antrean tanda tangan" Perbaiki Status Nyangkut disembunyikan bawaan.
- Pengecualian yang disengaja: modal Ubah Tx Hash `/manual-sync` (isian tx hash + jaringan
  + tabel cocok per baris = pekerjaannya), alamat bundle uji Mode Mint (isian ops), wallet
  nasabah tujuan/sumber ringkas + salin (OTC, rincian order, Pencairan Bermasalah, panel
  nasabah), daftar wallet di profil nasabah + dialog lepas wallet (objek yang dikelola),
  form mint/redeem (isian), ID rekaman KYC/KYB/screening (bukan data on-chain).

**B. Format waktu seragam**
- Satu helper `formatDateTime` (`src/lib/format.ts`): `12 Sep 2026, 08:00:09`, WIB.
  "WIB" di judul kolom/label/keterangan kecil, tidak di nilai. Tanggal saja
  `formatDateOnly`/`formatIsoDayLong`; relatif tetap. `formatDate`/`formatWibDateTime` dihapus.
- Ikut spec (`sot/bni-integration.md`): tabel mutasi BNI + waktu pengapit selisih
  `YYYY-MM-DD HH:mm[:ss]`, "direkam s/d DD/MM/YYYY HH:mm WIB", "Riwayat tersedia sejak
  DD/MM/YYYY", CSV mutasi tidak berubah. Kartu saldo BNI (tidak diatur spec) pakai format seragam.
- Lebar kolom waktu Jejak Audit (176) dan Pencairan Bermasalah (168) disesuaikan — format
  baru lebih pendek dan tombol Detail sebelumnya terpotong di 1440.
- Sisa grep pola lama di kode UI: hanya spec BNI (sengaja) + komentar.

**Cek akhir**: lint 0 error (3 warning lama) · unit 2454/2454 · build hijau · e2e 158/158 ·
`pnpm audit --audit-level=high` exit 0. Screenshot light 1440 + 390 di
`scratchpad/ops-fokus/` (modal multisig, OTC, Transaksi, Jejak Audit, Pencairan Bermasalah).
