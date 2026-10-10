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

## Semua detail = modal tengah (GO PM 11 Okt) — SELESAI (11 Okt 2026)

Aturan: **klik baris di mana pun = modal tengah** (pola `RecordModal`), tabel tetap
lebar penuh, tidak ada lagi panel samping. Footer sticky (↑/↓ + "n dari N" di kiri,
aksi di kanan), URL sendiri per modal, info on-chain di Detail teknis.

- **Verifikasi** — klik baris langsung membuka `KycDetailModal` / `KybDetailModal` di
  `/verifikasi/:jenis/:id` (`/kyc/:id`, `/kyb/:id` tetap membuka modal yang sama).
  Kedua modal kini `RecordModal`: judul = nama, subjudul "Berkas verifikasi … · diajukan
  …", kotak status dalam kalimat (dulu hanya di panel), seksi Riwayat (diajukan +
  pengajuan ke-n, diperiksa oleh siapa + keputusannya), Detail teknis (ID berkas + salin,
  ID nasabah, status sistem), footer Lainnya ("Lihat profil nasabah" → `/users/:id`,
  pindah halaman, modal ikut tertutup) · Tolak (alasan ≥ 10, tidak berubah) · Setujui.
  ↑/↓ mengikuti urutan tabel (menunggu dulu, lalu riwayat), terkunci selama mutasi/unggahan.
  Audit PII tidak berubah: detail berkas tetap hanya ditarik saat modal berkas itu
  terbuka (satu tarikan per berkas yang dibuka; tabel nol). `VerificationDetailPanel` dihapus.
- **Daftar Nasabah** — klik baris membuka `CustomerModal` di **`/users?nasabah=:id`**
  (bukan `/users/:id`, karena rute itu halaman profil lengkap yang tetap ada; `?pilih=`
  lama masih dibaca). Isi dari baris `GET /api/v1/users` saja: status + kalimat, nama,
  email, telepon, jenis, status KYC, aktivasi, wallet ringkas + salin, riwayat akun,
  catatan, Detail teknis. Footer: Buka profil lengkap + tombol utama sesuai ringkasan +
  Lainnya (Lihat transaksinya · Ubah data nasabah · Hapus nasabah, konfirmasi inline di
  footer). **Transaksi terakhir TIDAK ditampilkan**: endpoint daftar tidak membawanya, dan
  `GET /users/:id` (yang punya `recentRequests`) mendekripsi telepon + menulis
  `pii_access_audit` — tidak ditarik per modal. `CustomerPanel` dihapus.
- **Jejak Audit** — modal punya URL `/jejak-audit/:id` (+ saringan & halaman di query,
  gerbang ADMIN sama) dan ↑/↓. Endpoint hanya punya `list`, jadi tautan menemukan barisnya
  hanya bila saringan/halamannya sama; kalau tidak, modal mengatakannya terus terang.
- **Komponen** — `components/detail-panel/` dihapus (DetailPanel, SplitView, tone).
  `ToneChip` → `components/ToneChip.tsx`, `GroupedTable` → `components/table/`,
  `PanelActions` → `components/record-modal/RecordActions.tsx` (khusus footer modal).
  Grep: tidak ada lagi layout tabel + panel; `Sheet` hanya dipakai `MobileNavDrawer`.
- Nama nasabah di modal Transaksi/OTC: tidak ada tautan profil sebelumnya, jadi tidak
  diubah. "Lihat profil nasabah" di modal berkas = pindah halaman, tidak bertumpuk.

**Cek akhir**: lint 0 error (3 warning lama) · unit 123 berkas / 2457 tes · build hijau ·
e2e 164/164 (`E2E_PORT=5199`) · `pnpm audit --audit-level=high` exit 0. Screenshot
light 1440 + 390 (+ dark 1440 modal nasabah & berkas) di `scratchpad/semua-modal/`.

Belum beres / catatan:
- Mock e2e tidak punya `GET /api/v1/kyb/:id`, jadi screenshot modal KYB menampilkan
  "Fitur ini belum aktif di server" (artefak mock; pola modalnya tetap terlihat).
- ↑/↓ hanya di halaman tabel yang sedang dimuat (sama dengan Transaksi).
- Di ponsel, footer modal nasabah: tombol utama + Lainnya sebaris, "Buka profil
  lengkap" penuh di bawahnya (gaya `RecordActions` yang sama dengan OTC); modal berkas
  menumpuk tiga tombol penuh. Berfungsi, tapi bentuknya belum seragam.

## Bug menu + breadcrumb + Cadangan + audit Pengaturan (GO PM 11 Okt) — SELESAI (11 Okt 2026)

**1. Bug halaman terkunci setelah pindah lewat menu "Lainnya"**
- Penyebab: `DropdownMenu` Radix mode modal (bawaan) bertumpuk di atas `Dialog` modal. Item yang
  memanggil `navigate()` melepas menu dan dialog bersamaan; kunci `pointer-events: none` milik menu
  di `<body>` tidak pernah dikembalikan → sidebar/breadcrumb mati, konten tidak bisa digulir.
- Perbaikan di sumber: `modal={false}` di `RecordActions` (menu "Lainnya" semua modal), menu berkas
  Verifikasi (`BerkasParts`), dan `ProfileDropdown`. Dialog di bawahnya sudah mengunci halaman, jadi
  menu tidak perlu kunci kedua; fokus/Esc/panah tetap diurus Radix. Dipilih ketimbang menunda
  navigasi karena satu baris di satu tempat menutup semua item (sekarang dan nanti), tanpa timer.
- Ditemukan juga: menu profil navbar → Profil meninggalkan kunci GULIR (bukan pointer) — ikut beres.
- e2e `usdx-menu-navigasi.spec.ts`: 4 jalur menu + Esc tanpa memilih; cek `body`, gulir roda tetikus,
  klik link sidebar. Sebelum perbaikan: 2 jalur merah (Verifikasi, menu profil), sesudah: hijau.

**2. Breadcrumb bisa diklik** — `breadcrumbFor` → `{ label, to? }`; segmen ber-halaman = tautan, grup
dan segmen terakhir teks (`aria-current="page"`, `<nav aria-label>` + `<ol>`). Tombol dobel dihapus:
"Kembali ke daftar nasabah" (profil nasabah, dua cabang render), "Kembali" (Tambah berkas badan
usaha), "Antrean temuan" (Versi daftar sanksi).

**3. Cadangan & Atestasi** — atas: kartu saldo + "Catat entri"; bawah: tabel riwayat buku besar +
laporan atestasi ("Unggah laporan" di kanan atas). Kedua form di dialog (isi/validasi/idempotensi/
"periksa lalu catat" sama; konfirmasi bertumpuk). Klik baris = `RecordModal`
`/transparency/entri/:id` & `/transparency/laporan/:id` + ↑/↓; Cabut laporan di Lainnya.

**4. Audit layout Pengaturan + Keuangan** (screenshot `scratchpad/pengaturan-rapi/sebelum-*`/`sesudah-*`)

| Halaman | Hasil |
|---|---|
| Kurs, Biaya, Batas Safe Manager | form besar di samping kartu → kartu + tombol "Ubah …" kanan atas, form di `FormDialog` |
| Plafon Pencairan | form usulan di samping + riwayat kartu-kartu → kartu + "Ubah plafon", usulan di dialog, kartu "menunggu orang kedua" di halaman, riwayat tabel + modal `/plafon-pencairan/riwayat/:id` |
| Mode Mint | tombol geser di dasar kartu → kanan atas kartu |
| Cadangan & Atestasi | lihat butir 3 |
| Metode Pembayaran, Staf & Peran, Persetujuan Orang Kedua, Kontak Darurat, Jejak Audit, Log DurianPay, Rekening BNI, Laporan | dibiarkan — sudah satu pola (judul + aksi kanan atas, tabel/daftar, aksi lewat dialog/modal; BNI & Laporan = panel saringan, bukan form ubah) |

**Cek akhir**: lint 0 error (3 warning lama) · unit 123 berkas / 2474 tes · build hijau · e2e 174/174
(`E2E_PORT=5197`) · `pnpm audit --audit-level=high` exit 0.

Belum beres / catatan:
- Breadcrumb hanya tampil ≥ lg (sejak awal). Di ponsel, jalan balik dari profil nasabah = menu laci
  atau tombol kembali peramban, karena tombol "Kembali" dihapus.
- Kontak Darurat & Staf masih ikon pensil/tong sampah per baris (bukan klik baris = modal): CRUD
  langsung, dibiarkan karena sudah jelas; kalau PM ingin seragam, itu langkah berikutnya.
- ↑/↓ di modal Cadangan/Plafon hanya di halaman tabel yang sedang dimuat (riwayat plafon = 10 terakhir).

## Sapu bersih: semua halaman ikut pola baru (GO PM 11 Okt) — SELESAI (11 Okt 2026)

Arahan PM: "pakai standar yang baru, pattern yang baru, kalau ada yang salah benerin, rapiin
semuanya sampai tuntas". Warna/desain pola baru tidak diubah. Screenshot light 1440 + 390
`scratchpad/sapu-bersih/sebelum-*` (56 layar) dan `sesudah-*` (59 layar, termasuk modal
Staf & Kontak Darurat yang baru).

**Tiga hal wajib**
1. **Kurs & Biaya** — judul = nama menu "Kurs & Biaya" + keterangan tab yang terbuka, LALU tab
   (Kurs · Biaya · Batas Safe Manager · Kontak Darurat) di bawahnya, seperti Transaksi. Judul
   per-tab yang dulu berganti-ganti dibuang (tab sudah menyebut dirinya; judul sama dengan
   sidebar + breadcrumb). Laporan ikut susunan yang sama ("Laporan" + tab). Gaya tab
   `SectionTabs` disamakan dengan `TabBar`. Kartu Kurs, Biaya, Batas Safe Manager, Mode Mint
   lebar penuh (grid 4 kolom ≥ lg). "Terakhir diubah (WIB)" = `formatDateTime`;
   `formatRelativeTime` lewat seminggu kini tanggal lengkap (`1 Feb 2026`, bukan "1 Mei").
   Mode batas "IDR" → "Rupiah (IDR)".
2. **Paginasi** — `components/table/TablePagination` satu-satunya pager ("1–8 dari 8" +
   « ‹ n / N ›): `DataTable`, `GroupedTable` (Transaksi, OTC, Verifikasi — rentang gabungan
   KYC+KYB dihitung jujur), buku besar + laporan atestasi Cadangan (atestasi memakai kalimat
   "n aktif di halaman ini · N laporan seluruhnya" karena baris dicabut disaring klien).
   Grep: tidak ada lagi "Halaman x dari y" / "Sebelumnya·Berikutnya" buatan sendiri.
3. **Jalan balik ponsel** — `MobileBackLink` di `MainLayout` (`lg:hidden`): satu tautan
   "‹ Induk" ke segmen ber-halaman terdekat dari `breadcrumbFor` yang sama. Profil nasabah →
   Daftar Nasabah, Tambah berkas badan usaha → Verifikasi, Versi daftar sanksi → Daftar
   Sanksi, antrean lama → Transaksi. Menu utama tanpa tautan; desktop tetap breadcrumb saja.

**Temuan sapu bersih**

| Halaman / komponen | Masalah | Perbaikan |
|---|---|---|
| Persetujuan Orang Kedua, Log DurianPay, Pencairan Bermasalah, Mint Bermasalah, Daftar Sanksi | modal bentuk lama: tanpa ↑/↓, footer "Tutup" + aksi | `RecordModal` + `rowNav` (↑/↓, "n dari N"), aksi di kanan footer, tutup lewat X |
| Daftar Sanksi | membuka temuan membuang saringan URL (antrean kembali ke bawaan) | saringan ikut ke `/screening/:id?…` dan kembali saat ditutup; ID temuan ke Detail teknis; tanggal terbit daftar `25 Jan 2026` |
| Staf & Peran, Kontak Darurat | ikon pensil/tong sampah per baris | klik baris = `RecordModal` (`?staf=`, `?kontak=`), Ubah di footer, Nonaktifkan/Hapus di Lainnya |
| Staf, Kontak Darurat, Cadangan | status/kanal/kategori/jenis entri pakai Badge lokal (hijau custom, outline hitam) | `ToneChip` — satu gaya status |
| Mint Bermasalah, Pencairan Bermasalah | "WIB" ditempel di nilai waktu putusan | "diputus (WIB) 12 Sep 2026, 08:00:09" |
| Toast Setujui pencairan, Ajukan (multisig), kolom Integrasi Log DurianPay | enum mentah (`BURNED`, `Safe STAFF`, `LEGACY`) | label kata |
| Antrean Tanda Tangan | tab gaya sendiri (pil angka, garis token Azure lama), dua tombol utama | gaya `TabBar` + "(n)", Hubungkan Wallet = outline |
| Ajukan (multisig) | token Azure lama `surface-container`/`outline-variant` | token `muted`/`border` |
| Daftar Nasabah, Staf, Daftar Sanksi, Versi daftar, Kontak Darurat | tombol kepala halaman `h-7 text-xs` (lebih kecil dari halaman lain), aksi menumpuk vertikal | satu ukuran `sm`, aksi sebaris (`PageHeader` tidak menyusut) |
| Mint Bermasalah | kolom Detail terpotong di 1440 | lebar kolom dirapatkan |
| Profil akun | judul kartu "Kontak" pakai `text-xs` | `text-section` |
| `DataTable` di ponsel | kosong/galat dirender di tabel lebar → kalimat terpotong | kotak keadaan saja di < 640px |

Diperiksa dan sudah sesuai (tanpa perubahan): `<select` native 0; `DropdownMenu` yang
memindah halaman semua `modal={false}` (ThemeToggle tidak memindah halaman); `Sheet` hanya
laci menu; ukuran teks di luar token 0 (Tailwind menolak kompilasi); judul halaman/dialog
semua `font-display` token; `font-mono` sisanya hash/ID/path/JSON/nomor order/nomor jurnal
BNI; format waktu lama hanya pengecualian spec BNI + `HH:MM WIB` banner mode uji; waktu
"menurut bank" BNI tanpa detik karena bank hanya mengirim menit.

**Keputusan Kontak Darurat & Staf**: disamakan ke "klik baris = modal + aksi di footer".
Barisnya punya detail (ID, dibuat/diubah, peran/kanal sebagai kode) yang tidak muat di
kolom, dan dua ikon per baris adalah satu-satunya sisa pola lama. Dialog ubah/nonaktifkan/
hapus lama tetap dipakai apa adanya (peringatan kategori yatim tetap). URL pakai query
(`?staf=`, `?kontak=`) seperti Daftar Nasabah, jadi rute & gerbang peran di `App.tsx` tidak
berubah. **Sengaja dibiarkan**: Persetujuan Pencairan (Tolak/Setujui per baris — rekening
penuh wajib terlihat di tabel, dialog Setujui yang membaca detail = "modal"-nya, USDX-669)
dan Metode Pembayaran (sakelar + Ubah biaya per baris adalah pekerjaannya).

**Cek akhir**: lint 0 error (3 warning lama) · unit 125 berkas / 2490 tes · build hijau ·
e2e 182/182 (`E2E_PORT=5196`, spec baru `usdx-sapu-bersih.spec.ts`) ·
`pnpm audit --audit-level=high` exit 0.

Belum beres / catatan:
- Screenshot modal OTC & Daftar Sanksi di skrip screenshot tidak terbuka (baris pertama
  `GroupedTable` = judul kelompok; data MSW screening kosong) — artefak skrip; modal OTC
  dijaga e2e `usdx-otc-page.spec.ts`.
- ↑/↓ di modal tetap hanya di halaman tabel yang sedang dimuat.
- Versi daftar sanksi & Perbaiki Status di screenshot = "Data ini gagal dimuat" (MSW tidak
  menyajikan endpoint itu) — tampilan galatnya sendiri sudah seragam.
