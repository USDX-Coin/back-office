# USDX Back Office

## Overview

Internal back office SPA for managing **OTC mint** and **burn** operations on the USDX stablecoin, plus directory management for end-customers and internal staff. Mint/burn requests follow the SoT phase-1 approval lifecycle (`PENDING_APPROVAL → APPROVED → EXECUTED`, plus `IDR_TRANSFERRED` for burn, terminal `REJECTED`).

**Brand:** USDX — sama dengan landing usdx.co.id sejak redesain fase 1 (Okt 2026): logo koin + lockup (`public/image/`), maroon `#800000` + emas `#e0a93c` (token terang + gelap di `src/index.css`), **Crimson Pro** untuk judul halaman & judul modal (`font-display`, hemat) + **Inter** untuk UI dan SEMUA angka (`tabular-nums`) + JetBrains Mono HANYA untuk hash/ID/alamat wallet/path API/JSON/nomor order (lihat § Tipografi). Tabel tetap tanpa garis antar-baris. Desain lama "Azure Horizon" (teal, Manrope) sudah PENSIUN — jangan dipakai lagi.

## Tech Stack

- **React 19** + **Vite 8** + **TypeScript 5.9** (strict mode)
- **TailwindCSS v4** — utility-first, configured via `@theme` in `src/index.css`
- **shadcn/ui** — accessible UI components (Radix UI primitives)
- **React Router v7** — SPA routing with `createBrowserRouter`
- **TanStack Query v5** — server state management
- **TanStack Table v8** — data table with server-side pagination/sorting/filtering
- **MSW v2** — mock API in development (handlers in `src/mocks/`)
- **Recharts** — grafik laporan (lazy-imported)
- **pnpm** — package manager
- **Vitest** — unit tests
- **Playwright** — E2E tests

## Menu Structure — redesain (keputusan PM 9–10 Okt 2026)

Sumber kebenaran menu: `src/components/layout/navItems.ts` (`NAV`, satu pohon
untuk Sidebar desktop DAN laci menu ponsel lewat `NavTree`). Enam menu utama,
grup bisa dilipat (pilihan buka/tutup diingat per peramban), badge antrean
dijumlah di nama grup saat grup tertutup:

| Menu | Isi | Catatan |
|------|-----|---------|
| **Ringkasan** `/ringkasan` | halaman pertama setelah masuk (semua peran): perlu tindakan (`queue-counts`, tautan ke tab "Perlu tindakan" Transaksi) · token (`dashboard/stats`: pasokan on-chain Polygon, saldo Safe Staf/Manager, kurs beli) · Rekening BNI (`bni-accounts/balances` HANYA lewat tombol "Cek saldo") · Cadangan (`transparency/ledger`, Admin & Developer, "dicatat manual, bukan saldo bank live") · saldo DurianPay "Belum tersedia" · OTC (angka `dashboard/stats` berlabel khusus OTC) | `/dashboard` (Beranda lama) dialihkan ke sini. Tidak ada angka karangan/tiruan untuk yang belum ada endpoint-nya |
| **Transaksi** `/transactions` | fase 2 (⚠️ DRAF SOT PR #50): SATU daftar mint + redeem + uang masuk tanpa order (`GET /api/v1/transactions`), tabel lebar penuh dengan tab **Perlu tindakan (n)** (bawaan, `needsAction=true`) / **Semua**; kolom Status · Jenis · Nasabah · Nominal · Referensi · Waktu (tanpa rekening). Klik baris → modal tengah `/transactions/:id` dengan aksi antrean asal di footer | Badge = `queue-counts.transactionsNeedsAction` (absen ⇒ disembunyikan). Tab "Selesai"/"Gagal" BELUM dibuat: `status` kontrak hanya satu nilai, sedangkan keduanya gabungan beberapa status (pertanyaan ke PM). Empat antrean lama (Persetujuan Pencairan, Pencairan Bermasalah, Mint Bermasalah, Perbaiki Status Nyangkut) dilebur ke sini, tidak di navigasi; rutenya hidup lewat URL ("Buka di antrean") |
| **OTC ▸** | Mint `/otc/mint` · Redeem `/otc/redeem` — masing-masing tabel sendiri (+ "Buat mint OTC" / "Buat redeem OTC"), badge per sub-menu (`/api/v1/requests?status=PENDING_APPROVAL,APPROVED&type=…&limit=1`); detail = modal tengah `/otc/{mint,redeem}/:id` dengan tanda tangan/eksekusi Safe di footer | `canAccessRequestList` (bukan STAFF). `/otc` (`?jenis=burn` → Redeem), `/otc/:id`, `/mint`, `/burn`, `/mint/:id`, `/burn/:id` dialihkan ke sub-menu (detail redeem yang dibuka di Mint pindah sendiri bila `type` ada di detail). `/multisig` tetap hidup via URL (halaman tanda tangan lengkap + Propose) |
| **Nasabah ▸** | Daftar Nasabah `/users` · Verifikasi `/verifikasi` · Daftar Sanksi `/screening` | Verifikasi = KYC perorangan + KYB badan usaha satu tabel; `/kyc`, `/kyb` dialihkan, `/kyc/:id` `/kyb/:id` membuka modal berkas lengkap (PII) di atas Verifikasi |
| **Keuangan ▸** | Rekening BNI `/bni-accounts` · Laporan `/reports/*` · Cadangan & Atestasi `/transparency` | |
| **Pengaturan ▸** | Kurs & Biaya `/settings/rate` (tab: Kurs · Biaya · Batas Safe Manager · Kontak Darurat) · Metode Pembayaran `/settings/payment-methods` (⚠️ DRAF SOT PR #50, Admin ubah / Developer baca) · Mode Mint · Plafon Pencairan · Staf & Peran `/staff` · Persetujuan Orang Kedua `/persetujuan` · Jejak Audit · Log DurianPay | Mode Mint & Plafon Pencairan terbuka untuk SEMUA peran (rem darurat) |

- **Beranda lama → Ringkasan**: `/dashboard` → `/ringkasan`; setelah login operator mendarat di Ringkasan (menu pertama).
- **Gerbang peran tidak berubah**: tiap `visibleWhen` sama dengan menu lama, dan gerbang rute tetap di `App.tsx`. Menu bukan satu-satunya gerbang.
- **Breadcrumb dari tabel menu** (`breadcrumbFor`), tidak pernah dari potongan URL — tidak ada slug/UUID di layar.
- **Pola modal detail tengah** (`src/components/record-modal/RecordModal.tsx`, 10 Okt 2026 — Transaksi & OTC): tabel lebar penuh, klik baris → modal di tengah dengan URL sendiri (deep link). Header = judul (Crimson 20/26) + subjudul; isi = `RecordStatus` ("Yang perlu kamu lakukan") lalu `DataSection`/`DataField` per seksi lalu "Detail teknis" terlipat; footer (`DialogFooter`, tidak ikut menggulir) = navigasi ↑/↓ + posisi "n dari N" di kiri, tombol aksi di kanan (aksi utama paling kanan). ↑/↓ (juga `k`/`j`) pindah ke baris sebelum/sesudahnya di daftar yang sedang tersaring tanpa menutup modal (`navigate(..., { replace: true })`); panah diabaikan saat fokus di isian atau saat dialog lain bertumpuk di atasnya. Aksi memakai dialog antrean asal (Tolak tetap wajib alasan), detail antrean baru ditarik saat tombol ditekan. Pola yang sama dengan modal Log DurianPay.
- **Pola daftar + panel kanan** (`src/components/detail-panel/`): masih dipakai Verifikasi dan Daftar Nasabah (`?pilih=`). Panel samping Transaksi/OTC sudah dihapus (`TransactionDetailPanel`, `OtcDetailPanel`).
- **Bahasa**: kata sehari-hari, "mint" / "redeem" (bukan burn) di layar, tanpa enum mentah. Peran tampil sebagai kata (`formatRole`: Admin, Manager, Staf, Developer).
- **Halaman galat (Okt 2026), tidak ada lagi pengalihan diam-diam**:
  - **404**: `path: '*'` DI DALAM `MainLayout` → `NotFoundPage` (sidebar tetap, path yang dibuka ditulis mono kecil, tombol "Ke Ringkasan"). Pengalihan yang disengaja tetap rute sendiri: `/` dan `/dashboard` → Ringkasan, `/otc` `/otc/:id` `/mint` `/burn` (+`/:id`) → sub-menu OTC, `/kyc` `/kyb` → Verifikasi.
  - **403**: `RoleGuard` merender `ForbiddenPage` DI TEMPAT (URL tetap; "Kamu tidak punya akses ke halaman ini" + peran sebagai kata). `<Outlet />` tidak dirender, jadi halaman terlarang tidak pernah dipasang dan datanya tidak pernah diminta. Prop `redirectTo` DIHAPUS (dulu `/transactions`, dan `/screening` untuk `/screening/lists`). Gerbang perannya sendiri tidak berubah.
  - **Sesi habis**: 401 saat ada operator masuk (dibuktikan ulang lewat `/auth/me`, mekanisme `apiFetch` tidak berubah) → `sessionEnd = 'expired'` di `useAuth` → `ProtectedRoute` mengarahkan ke `/login?next=<path>` dengan state router `{ sessionExpired: true }` → kotak "Sesimu sudah habis, silakan masuk lagi." → setelah masuk kembali ke `next`. `next` divalidasi `safeNextPath` (`lib/nextPath.ts`): wajib `/…`, bukan `//`, tanpa `\`/karakter kontrol, origin tetap — `//evil.com`, `https://…`, `/\evil.com` jatuh ke Ringkasan. Keluar biasa (`sessionEnd = 'logout'`) → `/login` polos tanpa pesan dan tanpa `next`. Kunjungan tanpa sesi ke tautan langsung → `/login?next=…` tanpa pesan. Pesannya hanya dari state router, jadi tautan luar tidak bisa memunculkannya.

Tabel rute di bawah tetap berlaku per RUTE (perilaku, gerbang, kontrak). Kolom
"Section" dan "Menu label"-nya adalah susunan sidebar LAMA (sebelum fase 1) —
untuk letak menu sekarang, pakai tabel di atas.

| Route | Section | Menu label | Visibility | Purpose |
|-------|---------|------------|------------|---------|
| `/ringkasan` | *(menu pertama)* | Ringkasan | All roles | Halaman awal — lihat tabel menu di atas. Cadangan hanya ADMIN + DEVELOPER (`canManageSettings`, sama dengan gerbang `/transparency`); saldo BNI tidak ditarik otomatis |
| `/dashboard` | — | — | All roles | Dialihkan ke `/ringkasan` |
| `/users` | WORKSPACE | Users | All roles | Customer directory |
| `/users/:id` | — | — | All roles | Customer detail (deep link) |
| `/staff` | WORKSPACE | Staff | ADMIN | Staff directory + CRUD |
| `/mint` | OTC | Mint | All roles | Mint request list (table) — sidebar shows `(N)` PENDING_APPROVAL count |
| `/mint/new` | — | — | All except DEVELOPER | New mint OTC form |
| `/burn` | OTC | Burn | All roles | Burn request list (table) — sidebar shows `(N)` PENDING_APPROVAL count |
| `/burn/new` | — | — | All except DEVELOPER | New burn OTC form |
| `/multisig` | TREASURY | Multisig | ADMIN + DEVELOPER + MANAGER | Self-hosted Safe transaction queue (USDX-275) — tabs (All/Pending Sign/Ready to Execute/Confirming/Executed/Failed), search, safeType filter; connect wallet (wagmi/RainbowKit). **Propose** governance modal (USDX-280, ADMIN-only): blacklist/pause/setSupportedChain/grant-revoke-role/timelock → `POST /api/v1/multisig/propose`. Consumes `/api/v1/multisig/*` |
| `/multisig/:id` | — | — | ADMIN + DEVELOPER + MANAGER | Detail drawer — decoded TX + blind-sign cross-check vs linked intent + signers + on-chain links + **Sign** (owner, EIP-712 gasless) + **Execute** (execTransaction, simulate-gated to prevent GS013) + **Cancel** (admin/proposer). Network guard Polygon-137 |
| `/transactions` | CONSUMER | User Transaction | All roles | Consumer order list — mint (USDX-206) + redeem (USDX-245); read-only; filter type/status (contextual: RedeemStatus when type=REDEEM)/payment/safe + **Owner (partner / retail, USDX-547)**. **Partner column (USDX-547)**: its own column carrying `partners.display_name` + `partners.code`, **EMPTY for retail** — not "—" and not "N/A", both of which read as "this value failed to load". It answers the ops question the `(partner customer)` email marker does not: *which partner is this from*, because a partner order that goes wrong is chased with the PARTNER, never its customer. Partner-ness is decided by `partner_id`, NOT by the email marker — a partner's own (`onBehalfOf: SELF`) order carries a real email and still counts |
| `/transactions/:id` | — | — | All roles | Modal detail baris Transaksi (`TransactionDetailModal`, pola `RecordModal`) dari baris list; seksi "Rincian order" yang bisa dibuka-tutup DI DALAM modal (`OrderDetailSection` + `OrderDetailContent`, tidak ada modal kedua; `GET /orders/{id}` baru ditarik saat seksi dibuka, ↑/↓ menutupnya lagi) — MINT: fee/spread/revenue + idempotency key + on-chain/Safe links. REDEEM: spread jual + redeem/disbursement fee + net payout + bank (nama bank + nomor rekening penuh + nama pemilik — un-mask USDX-270) + redeem_id + burn_tx_hash + payout_ref (USDX-245). **Partner section (USDX-547, partner orders only)**: display name + code, on-behalf-of, `partner_customer_id`, and `external_reference` rendered IN FULL (never middle-truncated — it is the number the partner quotes when reporting a problem). Read-only (no approve) |
| `/kyc` | COMPLIANCE | KYC Review | All roles | KYC submission list (USDX-154) — sidebar shows `(N)` PENDING count |
| `/kyc/:id` | — | — | All roles | KYC detail modal — decrypted PII + photos + approve/reject (USDX-155); actions hidden unless PENDING, Developer view-only. **CDD block (USDX-545)**: occupation / source of funds / annual income / transaction purpose / NPWP / PEP status + relation. Enum values are copied value-for-value from `partner_customer_kyc` so retail and partner customers are judged on ONE CDD standard. `npwp` + `pepRelation` are PII → **role yang boleh MEMUTUSKAN** via `canReviewCustomerPii` (`src/lib/pii.ts`, USDX-610: STAFF / MANAGER / ADMIN; DEVELOPER masked). Angka itu bukan pelonggaran sepihak — ia menyamai `KYC_IDENTITY_PII_ROLES` di `kyc-backoffice.service.ts`, yang memang sudah mengirim plaintext-nya ke STAFF, dan `sot/conventions.md § Aturan Implementasi` ("backoffice KYC review (Staff/Manager/Admin)"). Gerbang ADMIN-saja yang lama membuat layar bertentangan dengan dirinya sendiri: NIK dan tanggal lahir utuh di sebelah `***` untuk nama gadis ibu kandung. Yang tersamar melihat `***` + keterangan "not shown to your role", sementara field yang memang kosong menampilkan em dash — "withheld" dan "not collected" tidak boleh terbaca sama. The section renders even when the whole block is empty (pre-USDX-545 customers) with an explicit note, so a reviewer cannot mistake missing CDD for a complete record. **Field POJK 8/2023 (USDX-587)**: identitas Pasal 25 (1) a angka 1 (`nationality` — bukan duplikat `country`: kewarganegaraan orangnya vs negara alamatnya, `gender`, `maritalStatus`, `mothersMaidenName`, `aliasName`) di grid identitas supaya bisa dicocokkan baris demi baris dengan KTP yang terpampang di bawahnya, plus `netWorthRange` (angka 4 separuh kedua), `sourceOfWealth` (**Pasal 37 (1) d**, EDD PEP — bukan Pasal 25) dan `employerAddress`/`employerPhone` (butir g) di blok CDD. `occupation` kini 99 nilai Permendagri 109/2019 dan ditampilkan sebagai **label** (`Pegawai Negeri Sipil (PNS)`), bukan kode enum — petugas mencocokkannya dengan kolom "Pekerjaan" di KTP-el. `mothersMaidenName` / `aliasName` / `employerAddress` / `employerPhone` ikut gerbang PII yang sama dengan `npwp`. **Dua kejanggalan disorot, tidak memblokir Approve**: (a) pekerjaan kode Permendagri 48–63 (jabatan publik = cakupan PEP domestik Pasal 2 (2) b) tapi `pepStatus === false` — `null` TIDAK dihitung, itu "belum ditanya" bukan jawaban yang bertentangan, dan menghitungnya akan memasang banner pada setiap berkas lama sekaligus; (b) `pepStatus === true` tanpa `sourceOfWealth`, karena Pasal 37 (1) d mewajibkan EDD-nya menganalisis sumber dana DAN sumber kekayaan. Keduanya sah setelah diperiksa, jadi yang wajib adalah petugas MELIHATNYA — tombol yang mati justru membuat ia mencari jalan memutar. **Alasan tolak minimal 10 karakter setelah trim (USDX-610)**, angka yang sama dengan KYB, ditegakkan di dialog, lagi di `useRejectKyc`, lagi di `RejectKycDto` + service, dan lagi oleh CHECK `kyc_rejected_requires_reason` — batas lamanya `1` menerima alasan "x", yang lalu dikirim ke nasabah lewat email `kyc-rejected.html` dan membuatnya mengunggah ulang berkas yang sama persis. **Panel status screening (USDX-610, `ScreeningSubjectPanel`)**: hasil DTTOT & DPPSPM berkas ini dibaca dari `GET /api/v1/screening/results?subjectType=KYC&subjectId=` — endpoint terpisah, BUKAN field baru di response KYC, karena tiap pembacaan KYC menulis satu baris `pii_access_audit` sementara membaca hasil screening tidak. Panelnya **tidak pernah memblokir Approve** (fail-open tetap keputusan yang berlaku); yang diperbaiki adalah lolosnya yang diam-diam |
| `/kyb` | COMPLIANCE | KYB Review | All roles | **KYB review queue (USDX-546)** — business-entity due diligence, sidebar shows `(N)` PENDING count. MANUAL flow (keputusan Mas Yan: KYB partner manual, bukan API): a LEGAL_ENTITY *account* can already be created via `POST /api/v1/users`, what was missing is somewhere to keep the entity's CDD data. The queue shows `users.name` + account email + legal form + status + submission count: `GET /api/v1/kyb` carries NO ciphertext column, so the registered entity name and the NIB are not in the list payload and cannot be searched. LIVE on the real backend since 28 Aug 2026 (PR #271 migration `0077` + PR #275) — the KYB MSW handlers were deleted |
| `/kyb/new` | — | — | All except DEVELOPER | KYB manual-entry form — entity fields + UBO repeater (declared ownership may not exceed 100%) + legal-entity account picker (`entityType=LEGAL_ENTITY`, deliberately NOT `UserPicker`, which filters `kycStatus=VERIFIED` and would return nothing for an entity awaiting KYB) |
| `/kyb/:id` | — | — | All roles | KYB detail modal — entity block, UBO cards (`identityNumber` is PII → ADMIN only), eight FIXED document slots each with their own **three-step upload** (`presign` → `PUT` the bytes to storage with the ticket's headers verbatim → `attach` the object key; backend PR #275) shown only while the record is PENDING and only to STAFF / MANAGER / ADMIN, mirroring both server gates — this is what lets a record reach VERIFIED at all, since approve refuses with `409 KYB_DOCUMENTS_INCOMPLETE` until akta · NIB · NPWP · KTP pengurus are on file — plus laporan keuangan · struktur manajemen · struktur kepemilikan when the entity is neither micro/small nor a perseroan perorangan (USDX-605, POJK 8/2023 Pasal 27 (1)), approve / **reject with a MANDATORY reason of at least 10 characters** (`RejectKybDto @MinLength(10)` plus two DB CHECKs), enforced in the dialog, again in `useRejectKyb`, and again by the API — a dialog-only guard is bypassed by any other caller and the trail then carries a reasonless rejection. **Kartu UBO lengkap Pasal 33 ayat (3) (USDX-587)**: huruf a (identitas — alias, tempat/tanggal lahir, kewarganegaraan, jenis kelamin, status perkawinan, pekerjaan, alamat & telepon tempat kerja), b & c (profil finansial UBO SENDIRI, bukan badan usahanya), d (`legalRelationship` + dokumennya) dan e (pernyataan nasabah), plus `cascadeStep` — langkah Pasal 33 yang dipakai sampai pada orang ini, yaitu pertanyaan pertama pemeriksa dan satu-satunya yang tidak bisa dijawab dari sisa kartunya. Empat kolom saja tidak cukup: **ayat (12)** mewajibkan PJK MENOLAK hubungan usaha kalau identitas UBO tidak bisa diyakini. Dua keadaan disorot di kartunya — jenis hubungan hukum terisi tapi dokumennya `null` (huruf d meminta hubungan itu "ditunjukkan dengan" berkas), dan pernyataan nasabah hilang — yang approve TIDAK tahan, dan kartunya mengatakan itu: kontraknya menyatakan huruf e sengaja tanpa gerbang otomatis — dan **keduanya diam untuk role yang memang tidak pernah diberi presigned URL**, karena di situ `null` tidak membuktikan apa pun. Tingkat badan usaha: `incorporationPlace` dirender BERPASANGAN dengan `establishmentDate` (angka 5 berbunyi "tempat **dan** tanggal", jadi butir itu harus terbaca utuh atau terbaca separuh), `sourceOfFunds` + `transactionPurpose` (angka 8 & 9), dan `isMicroOrSmall` ditulis sebagai KONSEKUENSINYA, bukan sebagai sel `true`/`false`: ia menentukan set dokumen wajib (Pasal 27 (1) huruf a untuk semua korporasi, huruf b menambah enam lagi), dan `null` diperiksa sebagai bukan mikro/kecil — keliru menuntut dokumen bisa diperbaiki petugas, keliru melepasnya ketahuan saat diperiksa OJK. **Panel status screening (USDX-610)** sama dengan layar KYC, cakupannya badan usahanya (`subjectType=KYB`): hasil UBO tersimpan sebagai `subjectType=KYC_UBO` dan endpoint hasil hanya menyaring satu `subjectId` per permintaan, sementara `LIST_UNAVAILABLE` adalah keadaan DAFTARNYA pada saat pemeriksaan — kalau DPPSPM tak terbaca untuk badan usahanya, ia juga tak terbaca untuk para UBO-nya di pemeriksaan yang sama |
| `/screening` | COMPLIANCE | Screening | All roles | **Antrean temuan screening DTTOT & DPPSPM (USDX-588)** — POJK 8/2023 Pasal 53, satu-satunya temuan audit CDD yang wajib DAN bersanksi administratif. Sidebar `(N)` menghitung temuan yang MASIH MENAHAN subjeknya. Dua sifat kontrak membentuk seluruh layarnya: (1) `screening_results` **tidak menyimpan nama nasabah** — tabelnya append-only (dua trigger DB menolak UPDATE/DELETE), jadi PII di sana jadi PII yang tidak bisa dihapus sweeper retensi; identitas subjek diambil terpisah lewat `subjectType` + `subjectId`; (2) **entri daftar bukan PII** — DTTOT/DPPSPM publikasi publik yang justru disebar agar dicocokkan, jadi ia tampil apa adanya, tidak lewat `presentPii`. `open=true` berarti "masih menahan", BUKAN "belum disentuh": server menyaring `POTENTIAL_MATCH` + keputusan yang bukan `CLEARED`, jadi temuan yang sudah diputus `CONFIRMED_MATCH` tetap di antrean karena subjeknya masih tertahan — kolom Keputusan yang memisahkan keduanya |
| `/screening/:id` | — | — | All roles | Layar banding — data nasabah vs entri daftar **berdampingan**, karena satu-satunya pertanyaan yang dijawab petugas adalah "apakah ini pihak yang sama". Dua keputusan (`CLEARED` / `CONFIRMED_MATCH`) dengan **alasan wajib min. 10 karakter**, ditegakkan di dialog, lagi di `useDecideScreening`, dan lagi oleh API + CHECK DB — alasan inilah "hasil analisis" yang Pasal 63 ayat (2) huruf c wajibkan ditatausahakan. DEVELOPER view-only (403). Sisi nasabah dibaca dari `GET /api/v1/kyc/{id}` / `kyb/{id}` dengan **kunci cache yang sama** dengan layar review KYC/KYB, supaya satu perbuatan tidak jadi dua baris `pii_access_audit`. **`KYC_UBO` dinyatakan tidak bisa ditelusuri**: tidak ada endpoint yang mengambil satu baris `kyc_ubo` dan temuan tidak membawa id KYB induknya — panel kosong akan terbaca sebagai "nasabah tanpa data" |
| `/screening/lists` | COMPLIANCE | *(tombol di /screening)* | **ADMIN + MANAGER** (RoleGuard) | Versi daftar sanksi + impor + pemindaian ulang. Lebih ketat daripada memutus satu temuan karena keduanya mengubah DASAR penilaian SELURUH nasabah sekaligus (`screening.controller.ts`); digerbangi di ROUTE, bukan hanya tombolnya. Impor tiga langkah (buat `DRAFT` → unggah entri bertahap → aktifkan) karena body JSON dibatasi 100 kB sementara daftar DTTOT jauh lebih besar. Berkas dibaca dan **divalidasi seluruhnya di browser** sebelum panggilan pertama (`previewSanctionCsv`) — tidak ada endpoint untuk menghapus versi DRAFT, jadi berkas cacat di baris 4.000 akan meninggalkan versi setengah terisi yang tidak bisa dibersihkan. Tiap potongan membawa baris header sendiri. Mengaktifkan versi selalu **menawarkan pemindaian ulang** (Pasal 53 ayat (3): pemeriksaan wajib sejak daftar DITERIMA, bukan hanya saat onboarding); `truncated: true` menawarkan lanjutan |
| `/redeem-approvals` | CONSUMER | Persetujuan Pencairan | **All roles** (no `RoleGuard`); Setujui / Tolak / ubah ambang = **MANAGER + ADMIN** | **Antrean gerbang pencairan redeem (USDX-669, kontrak `sot/api/redeem-approvals.yaml`)** — layar back-office pertama di repo ini yang MENGELUARKAN rupiah. Sidebar `(N)` menghitung pencairan yang menunggu keputusan — `redeemApprovalsOpen` dari `GET /api/v1/queue-counts` (USDX-678), bukan list `take=1`. Tiga sifat kontrak membentuk layarnya: (1) **menyetujui bukan mengirim** — `RedeemApprovalOutcome.status` tetap `BURNED` setelah APPROVED karena persetujuan hanya membuka gerbang dan Disbursement Trigger menjemput ordernya pada tick berikutnya, jadi tidak ada satu pun kata "terkirim" di layar ini; yang diperingatkan adalah transfer ke rekening SALAH yang tidak bisa ditarik kembali. (2) **`bankAccountName` adalah nama menurut BANK** (jawaban account-inquiry saat create), bukan ketikan nasabah, jadi ia dirender BERDAMPINGAN dengan `customerName` di tabel dan di kedua dialog — kalau berbeda, perbedaan itu sendiri yang ops diminta nilai, dan layar yang menampilkan salah satunya menyembunyikan justru pertanyaan yang membuat gerbang ini ada; kalau sama, itu satu pemeriksaan yang lolos dan juga dikatakan. (3) **nomor rekening PENUH di tabel**, tidak dipotong dan tidak disamarkan — `***` membuat gerbang ini teater, dan menyembunyikannya di detail berarti ops membuka sepuluh modal untuk sepuluh baris lalu menekan Setujui tanpa membukanya. Kolom **`burnTxHash` bertautan explorer ada DI TABEL** (kontrak `d7cee13` memindahkannya ke list item setelah PR ini melaporkan kekurangannya): menariknya lewat `GET /:id` per baris berarti satu baris `pii_access_audit` per baris — mencatat akses PII untuk orang yang tidak sedang membuka PII siapa pun. Baris antrean tidak membawa `chain`, jadi tautannya hanya dibangun kalau `GET /api/v1/chains` menjawab TEPAT SATU rantai; lebih dari satu ⇒ hash tetap terbaca tanpa tautan, karena tautan ke explorer rantai yang salah menjawab "transaksi tidak ditemukan" untuk burn yang ada. `null` dirender "belum tercatat", bukan em dash — antrean ini hanya memuat order yang sudah `BURNED`, jadi em dash akan terbaca "belum dibakar" dan menahan pencairan atas alasan yang tidak ada. Urutan TERLAMA dulu (`burned_at` asc) keputusan fairness server; kontraknya tidak punya parameter saring maupun urut, jadi toolbar-nya hanya membawa popover Kolom — `DataTable` yang tanpa `filterToolbar` merender kotak Search + dua isian tanggal yang menulis `?search=`/`?startDate=` ke URL, dan endpoint ini mengabaikan ketiganya (kontrol yang membuat operator mengira antreannya tersaring padahal tidak). Dialog **Setujui** membaca `GET /:id` (menulis satu baris `pii_access_audit` — itulah arti jejaknya: seorang manusia benar-benar membuka rekening tujuan sebelum melepas uangnya) untuk rincian bruto − biaya = diterima, kurs terpakai dan tautan burn ke explorer; kegagalan memuatnya **tidak** memblokir Setujui karena seluruh dasar keputusan sudah ada di baris antrean, dan tombol mati akan menahan pencairan nasabah atas alasan yang tidak ada hubungannya dengan mereka. Dialog **Tolak** menuntut `reason` (3..500, batas KONTRAK, bukan yang lebih ketat) dan menyatakan dua akibat yang paling mudah dikira sebaliknya: order mendarat di antrean "Pencairan Bermasalah" untuk dituntaskan (menolak BUKAN membatalkan — USDX nasabah sudah terbakar permanen) dan nasabah TIDAK dinotifikasi otomatis. **Ambang nominal** (`/api/v1/redeem-approval-controls`, GET semua peran / PUT MANAGER+ADMIN, `reason` wajib masuk `activity_log` bersama nilai lama & baru) duduk DI ATAS tabel, bukan di halaman Settings terpisah: server menyaring antrean dengan `netPayoutIdr > ambang`, jadi antrean kosong bisa berarti "tidak ada pencairan" ATAU "ambangnya melewatkan semuanya" — dua keadaan yang terlihat identik tanpa angka itu di layar yang sama, dan empty state-nya menyebut ambang aktifnya dalam TIGA cabang, bukan dua: `0` / di atas `0` / **belum diketahui** — menggabungkan yang ketiga dengan cabang nol membuat layar menegaskan sebagai fakta bahwa setiap pencairan akan muncul di sini padahal `GET controls` baru saja gagal, dan kartu di atasnya sudah membedakan ketiganya. `0` bukan "gerbang mati" melainkan keadaan PALING KETAT (semua wajib disetujui, nilai bawaan migrasi, fail-closed), jadi teksnya selalu menyebut AKIBAT bukan angka, dan **setiap perubahan yang bukan pengetatan menuntut konfirmasi eksplisit** yang menyebut kedua nilainya — termasuk perubahan yang ARAHNYA tidak bisa dipastikan karena nilai sekarang tak terbaca (`requiresRaiseConfirmation` ditulis sebagai daftar-tolak: hanya `lowered` dan `unchanged` lewat, jadi `invalid` menahan alih-alih melepas) — AC menyebut kasus dari-nol, dan ini supersetnya karena naik dari Rp 1 juta ke Rp 1 miliar juga melepas rupiah yang sebelumnya dilihat manusia; menurunkannya jalan langsung, mengetatkan tidak boleh lebih sulit daripada melonggarkan. Uang SELALU string lewat BigInt sen (`src/lib/redeemApprovals.ts`). **MSW-served** sampai backend USDX-668 naik (lalu enam path masuk `INTEGRATION_PATHS` dan handlernya dihapus) |
| `/payout-failures` | TREASURY | Pencairan Bermasalah | **All roles** (no `RoleGuard`); Kirim ulang / Tandai dibayar manual / Tutup = **MANAGER + ADMIN** | **Antrean payout redeem bermasalah (USDX-662, `sot/bni-integration.md § 17`, kontrak `sot/api/payout-failures.yaml`)** — USDX nasabah sudah terbakar dan rupiahnya belum sampai. Tiga populasi SATU layar (`issueKind`: `PAYOUT_FAILED` / `BURN_REJECTED` / `PAYOUT_STUCK`, D22-b), urut TERLAMA dulu dari server; satu-satunya kendali filter `issueKind` (nilai URL yang tak dikenal kontrak tidak dikirim). Sidebar `(N)` = `payoutFailuresOpen` dari `GET /api/v1/queue-counts` (USDX-678, `sot/api/queue-counts.yaml`) — BUKAN list `take=1`, yang mendekripsi rekening dan menulis `pii_access_audit` per baris; tampil untuk semua peran. Duduk di section TREASURY di bawah Rekening BNI, sesuai Linear ("sidebar TREASURY/OPS") — § 17.9 menyebut "satu grup dengan Mint Bermasalah", menu yang tidak ada di back-office ini. Kolom: masuk antrean, badge jenis + label `issueCode` (kode mesin tak dikenal dirender sebagai kodenya, tidak ditebak artinya — daftar kontrak terbuka), nominal IDR/USDX eksak (`formatIdrExact`/`formatUsdxExact`, kolom `redeem_orders` yang sama), rekening PENUH + nama menurut bank, pemilik (`ownerLabel` apa adanya — server sudah me-mask email untuk non-ADMIN; order partner ditandai), umur antrean. List DAN detail menulis `pii_access_audit` per order, jadi tidak ada query yang refetch saat fokus |
| `/payout-failures/:id` | — | — | All roles | Modal detail di atas antrean (filter & halaman ikut kembali saat ditutup): penyebab + keterangan provider/scanner, nominal & kurs snapshot, rekening, tx burn bertautan explorer (rantai dari `detail.chain`), **SELURUH submission** dengan ringkasan yang menjawab "pernahkah ada transfer yang berangkat?" — belum pernah diserahkan / semua terbukti ditolak / N belum terbukti ditolak (`rejectedAt` null = belum final, sama dengan `SUBMISSION_NOT_FINAL` backend) — dan jejak review append-only (order yang pernah di-RESENT lalu gagal lagi membawa jejak lamanya, § 17.2 #4). **Aksi per jenis (§ 17.4)**: `PAYOUT_FAILED` → kirim ulang · tandai dibayar manual · tutup; `BURN_REJECTED` → tanpa kirim ulang; `PAYOUT_STUCK` → TIDAK ada aksi, dijelaskan (transfernya masih mungkin berangkat); jenis tak dikenal → tanpa aksi (fail-closed). Nilai `action` di wire = **`RESENT`** (kontrak + DTO), bukan `RESEND` seperti kata kerja di tiket. Dialog resolve BERSARANG di dalam konten modal (Esc menutup lapisan atas dulu; saat terbuka Radix menandai modal di bawahnya `aria-hidden`, jadi test mencari dialog lewat judulnya): alasan ≥ 10 karakter setelah trim + `externalRef` wajib pada `SETTLED_MANUAL`, ditegakkan di dialog (submit MATI sampai sah) DAN di `useResolvePayoutFailure`. **`RESENT` tanpa isian ketik rekening sama sekali** (§ 17.5, D22) — rekening pengganti hanya DIPILIH dari `detail.replacementBankAccounts` (USDX-678): dropdown `ReplacementAccountSelect` (Radix Select) dengan opsi bank · nomor penuh · nama · label, rekening yang sama dengan tujuan saat ini (dicocokkan bank + nomor, `findCurrentReplacementAccount`) ditandai "rekening saat ini" dan terpilih ⇒ `bankAccountId` tidak dikirim; memilih rekening lain ⇒ `bankAccountId` terkirim dan kalimat konsekuensi menyebut rekening baru + rekening yang digantikan. Tujuan saat ini yang tak lagi ada di address book tetap ditawarkan sebagai pilihan pertama. Daftar kosong ⇒ tanpa pemilih; kalimatnya partner → selesaikan lewat partner, retail → nasabah menambahkan rekening lewat app. `409 BANK_ACCOUNT_NOT_OWNED` dijelaskan di dialog. Detail tanpa `replacementBankAccounts` (backend sebelum USDX-677; kontrak tidak mewajibkannya, dan build yang di-deploy tidak memakai MSW) dinormalisasi jadi `[]` di `usePayoutFailureDetail` — ketiga dialog tetap jalan, Kirim ulang ke rekening yang sama (review #105). Galat 403/409 tampil DI DALAM dialog (bukan toast); kode bernama dibaca dari `code` ATAU `message` karena `ConflictException("ALREADY_RESOLVED")` di backend menjadi `{ code: "CONFLICT", message: "ALREADY_RESOLVED" }`; 409 yang berarti keadaan berubah (`ALREADY_RESOLVED`, `ACTION_NOT_ALLOWED_FOR_KIND`, 404) menarik ulang detail + antrean. **MSW-served** sampai api-dev menyajikan modul USDX-471 (13 Sep 2026 masih 404) — lalu ketiga path masuk `INTEGRATION_PATHS`, handler tetap untuk Vitest |
| `/durianpay-api-calls` | TROUBLESHOOTING | Log DurianPay | **MANAGER + ADMIN + DEVELOPER** (RoleGuard) | **Log Panggilan DurianPay** — jejak SETIAP panggilan yang kita kirim ke DurianPay, sukses maupun gagal, beserta jawabannya. **Belum punya kontrak SOT**: endpointnya (`GET /api/v1/durianpay-api-calls` + `/:id`) hidup di branch backend `wisnubarata111/be-catat-log-panggilan-durianpay` yang BELUM merge, jadi bentuk responsenya dibaca dari modul itu. Read-only seluruhnya (dua GET, nol aksi). Digerbangi di MENU dan di ROUTE dengan daftar peran yang sama seperti `@Roles` backendnya — STAFF dijawab 403, dan menu yang muncul lalu ditolak terbaca sebagai layar rusak. Kolom utama menjawab kapan · apa yang dipanggil · berhasil atau tidak · kenapa gagal · order mana tanpa istilah SNAP; path mentah tetap ada sebagai baris kedua. Empat vonis, bukan tiga: HTTP 2xx yang `responseCode`-nya tidak berawalan `2` dirender "Ditolak di dalam jawaban", mengikuti `summarize()` backend. Kode angka (`2002700`, `5002701`) tampil utuh + keterangan bahasa yang hanya membaca tiga digit pertama. Badan pesan mentah ada di Collapsible "Detail teknis" (tertutup bawaan) dengan peringatan eksplisit saat badannya terpotong di 16 KiB, penanda balasan non-JSON, arti `[REDACTED:SECRET]`/`[REDACTED:PII]`, dan kalimat bahwa **header HTTP tidak pernah disimpan**. Tanpa kotak cari teks bebas — backend tidak punya; tujuh saringan kontraknya saja, dan isian tanggal distempel +07:00. MSW-served sampai PR backendnya merge |
| `/settings/rate` | SETTINGS | Rate | ADMIN + DEVELOPER (update is ADMIN-only) | View / update base rate + spread **beli/jual** (USDX-207) |
| `/settings/fee` | SETTINGS | Fee | ADMIN + DEVELOPER (update is ADMIN-only) | View / update fee config — mint fee % + PG fee VA flat / QRIS % (USDX-207) + redeem fee % + disbursement fee flat (USDX-245) + **Minimum Mint (Rp) (USDX-637)** + **Minimum Redeem (Rp) (USDX-682)**; POST = full 7-field snapshot, 422 VALIDATION_ERROR; non-admin read-only. Kedua minimum pindah dari konstanta backend ke kolom `fee_configs` (`min_mint_idr` USDX-635, `min_redeem_idr` USDX-682) supaya bisa digeser tanpa deploy — lantai keras Rp 10.000 divalidasi di klien DAN di server, dan pesan 422 tampil **inline di field yang namanya disebut server**, bukan sebagai toast yang keburu hilang sebelum operator selesai membaca. `minRedeemIdr` **wajib** di `PUT/POST /api/v1/fee-config`: form yang tidak mengirimnya ditolak 422, artinya menyimpan fee config yang LAMA pun gagal — bukan cuma minimum redeemnya yang tidak tersimpan |
| `/settings/mint-mode` | SETTINGS | Mode Mint | **Semua role** (geser ke mode uji: MANAGER + ADMIN; kembali ke PROD: STAFF ke atas) | **Mode mint PROD/UJI (USDX-639)** — mode menentukan TOKEN MANA yang dicetak untuk uang yang benar-benar masuk, jadi mode uji yang menyala tanpa disadari berarti user membayar uang asli dan menerima token uji. Kartu menampilkan mode aktif + alasan + siapa yang menggeser + `expiresAt` dari `GET /api/v1/mint-mode`. Asimetri sengaja: menyalakan sulit (dialog dengan alasan WAJIB + durasi 1–24 jam, MANAGER/ADMIN), mematikan mudah (satu konfirmasi, STAFF ke atas). **Banner merah global** dirender di `MainLayout` — jadi ada di SEMUA halaman dan bertahan melewati pergantian rute — tanpa tombol tutup, dan mengikuti jawaban SERVER, bukan jam browser: kalau `expiresAt` lewat tapi server masih menjawab `TEST`, banner tetap menyala (query mem-polling 60 dtk), karena menyembunyikannya lebih awal mengklaim mint sudah normal padahal yang membuktikannya belum berubah. **Daftar akses (USDX-639 tambahan lingkup 11 Sep 2026 + USDX-636 § 3)**: dialog mengisi `allowedEmails` — selama mode uji, hanya email pada daftar itu yang bisa mint, sisanya melihat pemberitahuan pemeliharaan (`503 MINT_UNDER_MAINTENANCE`). **Daftar kosong = TIDAK ADA yang bisa mint**, dan dialog menyatakan itu sebagai AKIBATNYA, bukan sebagai aturan — "kosong" paling mudah dibaca terbalik jadi "semua boleh", dan salah paham ke arah itu berarti orang asing membayar uang sungguhan lalu menerima token uji. Kartu menampilkan daftarnya selama mode uji supaya "siapa yang bisa mint sekarang" terjawab tanpa membuka dialog, banner menyebut jumlahnya (nol = "tertutup untuk semua user"), dan kembali ke PROD membuang daftarnya. **Alamat bundle uji adalah ISIAN, bukan env (USDX-654)**: dialog mengirim `testUsdxAddress` / `testStaffSafeAddress` / `testManagerSafeAddress`, dan tanpa ketiganya server SELALU menolak — mode uji tidak bisa dinyalakan sama sekali. Validasi klien menuntut **ejaan ber-checksum EIP-55**, sama dengan gerbang pertama server (`isChecksumAddress`) dan sengaja BERBEDA dari `validateUserAddressField` yang longgar untuk alamat dompet nasabah: alamat huruf kecil semua ditolak, dan klien TIDAK membetulkannya sendiri karena menormalkan justru menghapus satu-satunya pemeriksaan yang menangkap salah ketik satu karakter. **Safe staff uji BOLEH sama dengan Safe manager uji (USDX-655)** — bundle dev memang memakai satu alamat untuk keduanya, dan aturan kembar yang menolaknya membuat mode uji tidak pernah bisa dinyalakan; lubang "dua antrean logis di atas satu Safe fisik" ditutup di akarnya oleh backend dengan mengunci antrean propose pada ALAMAT Safe, bukan tipe. Yang tetap ditolak klien: token uji sama dengan alamat Safe uji mana pun (itu bukan dua antrean, melainkan alamat yang tidak mungkin benar); tabrakan dengan alamat PRODUKSI tetap milik server, karena klien tidak menebak alamat produksi. Kartu menampilkan ketiganya selama mode uji, dipersingkat dengan alamat penuh di `title` dan tertaut ke block explorer dari `GET /api/v1/chains`. `422` (`MINT_MODE_TEST_ENV_INCOMPLETE` — satu kode untuk lima sebab: bentuk alamat, alamat produksi belum terkonfigurasi, tabrakan alamat, kunci signer uji, pemeriksaan on-chain) tampil DI DALAM dialog dengan pesan server apa adanya; `error.details` dibaca sebagai daftar env HANYA kalau ia memang array string — bentuk lain diabaikan, bukan ditebak. Satu-satunya entri SETTINGS yang terbuka untuk semua role: gerbang section dipindah ke item (preseden TREASURY USDX-631) supaya STAFF yang menyadari mode uji menyala bisa sampai ke tombol yang mematikannya |
| `/settings/threshold` | SETTINGS | Threshold | ADMIN + DEVELOPER (update is ADMIN-only) | View / update Safe routing threshold |
| `/transparency` | COMPLIANCE | Transparency | ADMIN + DEVELOPER via `RoleGuard` (recording is ADMIN-only) | Append-only **reserve ledger** — entry history table (event date / type / amount / reason / recorded by / recorded at, server-paginated), reserve balance read from the response's `balance` field, and an add-entry form (SEED/ADJUSTMENT, negative amounts allowed as corrections, reason min 10 chars and no control/bidi characters, non-future `occurredAt` judged in WIB) behind a confirm dialog that restates the amount and the resulting balance. POST carries an **`idempotencyKey`** (16-200 chars) minted once per form-filling attempt and re-sent unchanged on retry — **201** = new entry, **200** = safe replay of the SAME content, both success, while the same key with **different** content is **409 `LEDGER_IDEMPOTENCY_KEY_CONFLICT`** (nothing written) and is handled as an actionable failure: reload the balance, show it, then offer to re-send under a new key. After any non-422 failure the balance is re-read and shown before a retry is offered, and a commit is blocked while the balance is unknown. Monthly attestation PDFs use the three-step upload (`upload-url` with a REQUIRED `{ period, sizeBytes }` → `PUT` to storage using the ticket's `headers` verbatim → register `fileKey`), capped at **5 MiB** and content-sniffed for a real PDF header; the list is server-paginated and revoked reports are filtered out. Contract: `catatan/KONTRAK-API-TRANSPARANSI.md` |
| `/bni-accounts` | TREASURY | Rekening BNI | **All roles incl. STAFF** (no `RoleGuard`; TREASURY section is now gated per ITEM — Multisig keeps ADMIN+DEVELOPER+MANAGER) | **Saldo LIVE + mutasi dari SALINAN USDX, tiga rekening BNI** (USDX-631 + USDX-692, `sot/bni-integration.md § 16` + amandemen D24 `§ 16.8`, kontrak `sot/api/bni-accounts.yaml` rev 2026-09-18). Tiga kartu saldo dari satu `GET /bni-accounts/balances` — state per kartu `loading / ok / bank-rejected / unavailable`, label dari `GET /bni-accounts` (env, tanpa bank) supaya tetap bernama saat bank gagal; 503 "belum aktif" / 502 "coba lagi" / 429 "terlalu sering"; satu tombol **Tarik ulang saldo**. **Panel mutasi (D24)**: bank hanya melayani mutasi HARI BERJALAN (temuan T13), jadi bni-service merekamnya tiap 10 menit dan **Tarik membaca salinan itu — nol kontak bank** (`GET /bni-accounts/{accountNo}/statement`). Dropdown rekening mulai kosong, `DateRangeFields` maks 31 hari & tidak masa depan (WIB, default hari ini dihitung saat tombol ditekan), jenis Semua/Masuk/Keluar. Header hasil = parameter yang DITERAPKAN · **"direkam s/d DD/MM/YYYY HH:mm WIB"** (`recordedThrough`; null → "belum pernah direkam") · `pullId` ber-tooltip "pullId (korelasi activity_log)" — baca salinan tidak menghubungi bank, jadi tidak ada baris `api_call_log`; tooltip header SALDO tetap "activity_log ↔ api_call_log". **Banner "Riwayat tersedia sejak …"** bila `startDate < historyAvailableSince` (atau null); rentang yang seluruhnya sebelum tanggal itu menampilkan banner SEBAGAI GANTI state kosong — rentang yang tak tercakup salinan bukan "tidak ada mutasi". **Penanda selisih**: satu peringatan per `gaps[]` (rantai saldo membuktikan ada mutasi tak terekam) dengan dua waktu pengapit + selisih bertanda dalam mata uang rekening, **tanpa tombol tutup/abaikan** (K15; tombol unggah = fase 2, belum bertiket). **Segarkan dari bank** (`POST …/statement/refresh`, semua role) aktif hanya bila rekening sudah dipilih — sasarannya rekening TERAPAN bila ada hasil di layar, selain itu rekening yang dipilih di form; Tarik dan Segarkan saling menonaktifkan selama salah satunya berjalan: satu tarikan hari ini yang DISIMPAN ke salinan → toast "N mutasi baru terekam" / "Tidak ada mutasi baru" + `refetch()` query mutasi dengan parameter terapan (bukan isi form; sebelum Tarik pertama tak ada yang dibaca ulang); gagal (EOD bank ±23:10–00:20 WIB → alasan bank apa adanya; 429; 503) tampil inline dan **tabel salinan tetap tampil**. Ringkasan **"menurut salinan USDX"** (saldo awal / total masuk / total keluar / saldo akhir — dihitung dari seluruh baris rentang, mengabaikan filter jenis) + jumlah baris + satu baris anomali; tabel `DataTable` paginasi KLIEN + kolom **Sumber** (`BANK` / `UNGGAHAN`, enum terbuka), kunci baris = `id` salinan (baris `MALFORMED` → "—", di bawah); **Unduh CSV** seluruh hasil (BOM, D/C, nominal tanpa tanda, kolom Sumber). Query: `retry:false`, `staleTime:Infinity`, tanpa refetch fokus, `gcTime:0`, timeout browser 45 s. MSW-served (termasuk `statement/refresh` berkeadaan + skenario EOD/429) sampai backend dev menyajikan USDX-691 (lalu tambah ke `INTEGRATION_PATHS`, langkah post-merge CR USDX-689) |
| `/settings/oncall` | SETTINGS | On-Call | **ADMIN only — including read** | Kontak on-call insiden uang (USDX-485, audit P1-18). CRUD nama / peran / kanal (PHONE·EMAIL·SLACK) / kategori insiden. Backend menyisipkan kontak yang cocok kategorinya ke dalam isi alarm kondisi uang; nol kontak → alarm tetap terkirim dengan peringatan eksplisit. Lebih ketat dari Settings lain karena `contactValue` bisa berupa nomor telepon (PII → ADMIN saja per `sot/conventions.md § Audit Akses PII`) dan daftarnya menentukan siapa yang boleh menarik rem darurat payout |
| `/profile` | *(navbar dropdown)* | Profile | All roles | Operator profile |
| `/` | — | — | All roles | Dialihkan ke `/ringkasan` (pengalihan sengaja) |
| `*` | — | — | All roles | 404 `NotFoundPage` di dalam layout (tanpa sesi → Login dulu dengan `?next=`) |

Ponsel: tombol menu di Navbar membuka `MobileNavDrawer` yang memakai `NavTree` yang sama dengan Sidebar — tidak ada BottomNav lagi. Profil lewat `ProfileDropdown` di Navbar.

## Project Structure

```
├── CLAUDE.md              # This file
├── docs/
│   ├── brainstorms/       # Design brainstorm outputs
│   ├── plans/             # Implementation plans
│   └── reviews/           # Code review reports
├── e2e/                   # Playwright E2E tests
├── public/
│   └── mockServiceWorker.js  # MSW service worker
├── src/
│   ├── App.tsx            # Router + providers (QueryClient, AuthProvider)
│   ├── main.tsx           # Entry point, MSW init in dev mode
│   ├── index.css          # @theme tokens merek usdx.co.id (maroon/emas, Crimson Pro + Inter), terang + gelap
│   ├── components/
│   │   ├── ui/            # shadcn/ui primitives (do not edit directly)
│   │   ├── layout/        # Navbar, Sidebar + MobileNavDrawer (keduanya NavTree), navItems.ts (NAV 5 menu + breadcrumbFor + formatRole), useNavBadges, MainLayout (memasang banner mode uji mint), AuthGuard
│   │   ├── record-modal/  # RecordModal (+ RecordStatus) — modal detail tengah Transaksi & OTC: footer aksi menempel, navigasi ↑/↓
│   │   ├── TabBar.tsx     # Tab di atas tabel (Transaksi): garis bawah, angka Inter tabular
│   │   ├── detail-panel/  # Pola daftar + panel kanan (Verifikasi, Daftar Nasabah): SplitView, DetailPanel (+ ToneChip, PanelSection), PanelActions (satu tombol utama + Lainnya + konfirmasi inline; `bare` untuk footer RecordModal), GroupedTable (grup "Perlu tindakan" / riwayat; `hideLabel` untuk tabel satu grup)
│   │   ├── Avatar.tsx     # Initials + fixed-palette avatar
│   │   ├── FieldError.tsx # Inline form error primitive
│   │   ├── TableEmptyState.tsx  # Table empty-state primitive
│   │   ├── CustomerTypeahead.tsx  # Shared customer lookup (Unit 9+)
│   │   ├── OnChainLinks.tsx  # TxHashLink cell (clickable short tx hash) + resolveOnChainLinks — On-chain tx / Safe tx columns
│   │   ├── DateRangeFields.tsx  # Two date inputs + range rules (lib/dateRange) — reports toolbar + BNI statement panel
│   │   ├── StatusPill.tsx # Label badge for a StatusConfig (tanpa titik)
│   │   ├── DataList.tsx   # DataSection/DataField — label–nilai di modal/sheet
│   │   ├── FormLayout.tsx # FormSection/FormField/FormFooter — form gaya Stripe
│   │   ├── OptionCombobox.tsx # Combobox cmdk untuk pilihan tetap yang panjang
│   │   ├── ErrorNotice.tsx # Kotak galat: kalimat dari lib/errorMessages + Detail teknis
│   │   └── DataTable.tsx  # Shared generic table with filter-toolbar slot
│   ├── features/
│   │   ├── auth/          # LoginPage (+ kotak "sesi habis", `?next=` tervalidasi)
│   │   ├── errors/        # NotFoundPage (404, `*`) + ForbiddenPage (403, dirender RoleGuard) — keduanya di atas components/RouteNotice
│   │   ├── users/         # UsersPage (daftar + CustomerPanel kanan, ?pilih=) + UserDetailPage + hooks
│   │   ├── staff/         # StaffPage + modal + hooks
│   │   ├── overview/      # OverviewPage + hooks (useDashboardStats) — Ringkasan /ringkasan, halaman awal
│   │   ├── otc/           # OtcPage({type}) + OtcDetailModal + OtcRoute + OtcLegacyRedirect + hooks (/otc/mint, /otc/redeem) — satu halaman per jenis, status tanda tangan dari /multisig lewat safeTxHash, tanda tangan/eksekusi di footer modal via useSafeTxSigning
│   │   ├── verification/  # VerificationPage + VerificationDetailPanel (/verifikasi) — KYC + KYB satu tabel, panel ringkas TANPA membaca PII
│   │   ├── mint/          # MintFormPage + hooks (/mint/new; daftar lama dialihkan ke /otc)
│   │   ├── burn/          # BurnFormPage + form/info panel + hooks (/burn/new; daftar lama dialihkan ke /otc)
│   │   ├── transactions/  # TransactionsPage (Transaksi gabungan, SOT PR #50: tab + tabel lebar penuh) + TransactionDetailModal (RecordModal) + TransactionActionDialog (dialog antrean asal) + OrderDetailSection/OrderDetailContent (rincian order di dalam modal) + hooks
│   │   ├── payment-methods/ # PaymentMethodsPage + PaymentMethodDialogs + hooks (/settings/payment-methods, SOT PR #50)
│   │   ├── redeem-approvals/ # RedeemApprovalsPage + RedeemApprovalControlsCard + ApproveRedeemDialog + RejectRedeemDialog + PayoutDestinationSummary + columnConfig + hooks (USDX-669, /redeem-approvals) — gerbang ops sebelum rupiah redeem keluar + ambang nominal
│   │   ├── payout-failures/ # PayoutFailuresPage + PayoutFailureDetailModal + ResolvePayoutFailureDialog + ReplacementAccountSelect + SubmissionTrail + ResolutionTrail + filterDefs + hooks (USDX-662, /payout-failures) — antrean Pencairan Bermasalah + resolve per issueKind + pemilih rekening pengganti RESENT (USDX-678)
│   │   ├── durianpay-api-calls/ # DurianpayApiCallsPage + DurianpayApiCallDetailModal + filterDefs + hooks (/durianpay-api-calls) — Log Panggilan DurianPay, read-only, MANAGER/ADMIN/DEVELOPER; kontraknya dibaca dari branch backend yang belum merge
│   │   ├── queue-counts/  # useQueueCounts (USDX-678, GET /api/v1/queue-counts) — badge sidebar Pencairan Bermasalah + Persetujuan Pencairan tanpa PII
│   │   ├── kyc/           # KycDetailModal (dibuka dari /kyc/:id di atas Verifikasi) (PII/photos/CDD/approve/reject/audit) + hooks (USDX-154/155/545)
│   │   ├── kyb/           # KybDetailModal (dari /kyb/:id di atas Verifikasi) + KybFormPage + LegalEntityPicker + hooks (USDX-546) — manual entity due diligence; LIVE on the real backend, no MSW handlers
│   │   ├── rate/          # RatePage + cards/forms (settings/rate) — base rate + spread beli/jual
│   │   ├── fee/           # FeeConfigPage + card/form (settings/fee) — mint fee % + PG fee VA/QRIS (USDX-207) + redeem fee % + disbursement fee flat (USDX-245) + minimum mint Rp (USDX-637) + minimum redeem Rp (USDX-682, field wajib di BE); full 7-field snapshot
│   │   ├── mint-mode/     # MintModePage + MintModeCard + MintTestModeDialog + MintTestModeBanner + hooks (settings/mint-mode) — mode mint PROD/UJI + banner merah global (USDX-639)
│   │   ├── threshold/     # ThresholdPage + cards/forms (settings/threshold)
│   │   ├── bni-accounts/  # BniAccountsPage + BalanceCards + StatementPanel + StatementResultsHeader + StatementNotices + StatementRefreshButton + StatementTable + hooks/errors/statementCopy/statementCsv (USDX-631 + USDX-692, /bni-accounts — saldo LIVE + mutasi dari salinan USDX)
│   │   ├── transparency/  # TransparencyPage + ReserveBalanceCard + LedgerEntryForm + LedgerConfirmDialog + LedgerHistoryTable + AttestationSection + upload/revoke dialogs (/transparency)
│   │   ├── screening/     # ScreeningQueuePage + ScreeningDecisionModal + SanctionListsPage + SanctionListImportDialog + ScreeningSubjectPanel (USDX-610, dipasang di modal review KYC & KYB) + hooks (USDX-588) — antrean & keputusan screening DTTOT/DPPSPM, impor daftar, pemindaian ulang
│   │   ├── chains/        # useChainConfig hook (GET /api/v1/chains — explorer + Safe addresses)
│   │   ├── multisig/      # MultisigListPage + MultisigDetailSheet + tabs + wallet actions (USDX-275) — self-hosted Safe queue, connect-wallet (wagmi/RainbowKit), sign EIP-712 + execute + simulate guard
│   │   └── profile/       # ProfilePage
│   ├── lib/               # Shared utilities
│   │   ├── auth.tsx       # AuthProvider + useAuth hook (+ `sessionEnd`: expired / logout)
│   │   ├── nextPath.ts    # safeNextPath + loginPathWithNext — tujuan setelah login, anti open redirect
│   │   ├── types.ts       # Staff, Customer, OTC types, DashboardSnapshot
│   │   ├── validators.ts  # Pure form validators
│   │   ├── format.ts      # formatAmount, formatDate, formatShortDate, formatRelativeTime, shortHash, formatBniPostDate/formatBankAmount/formatWibDateTime/formatWibDayMinute/formatIsoDayDmy (BNI)
│   │   ├── dateRange.ts   # validateDateRange / inclusiveDaySpan — pure range rules (maxDays inclusive, maxDate)
│   │   ├── status.ts      # OTC status config + helpers
│   │   ├── screening.ts   # Label enum screening + skor + pembaca/pemotong CSV daftar sanksi (USDX-588)
│   │   ├── pii.ts         # canReviewCustomerPii (STAFF/MANAGER/ADMIN, fail-closed, USDX-610) + presentPii/PII_MASK/PII_WITHHELD_LABEL + PARTNER_CUSTOMER_EMAIL_LABEL
│   │   ├── cdd.ts         # CDD / KYB enum label maps + labelFor fallback (USDX-545/546)
│   │   ├── csv.ts         # CSV export (formula-injection guard, `\r` quoted, opt-in UTF-8 BOM)
│   │   ├── explorerUrl.ts # Block explorer deep-links (base URL from /api/v1/chains)
│   │   ├── safeUrl.ts     # Safe Wallet UI deep-links (buildSafeUrl, safeTxUrl)
│   │   ├── chainLinks.ts  # findChainConfig + resolveOnChainLinks (composes explorer/safe URLs)
│   │   ├── transparency.ts # exact BigInt-cents money math + WIB day helpers + attestation revoke filter
│   │   ├── redeemApprovals.ts # USDX-669 — uang IDR eksak (BigInt sen, ejaan id-ID), arah perubahan ambang + gerbang konfirmasi kenaikan, validasi alasan (3..500 dari kontrak), pesan galat manusia per kode lalu per status
│   │   ├── durianpayApiCalls.ts # Log Panggilan DurianPay — path→kalimat, vonis empat keadaan (2xx yang ditolak di dalam amplop), keterangan responseCode tanpa menebak arti per kasus, tanggal WIB +07:00, pembaca badan terpotong / non-JSON
│   │   ├── backofficeTransactions.ts # label jenis/tindakan/status Transaksi gabungan + query builder
│   │   ├── paymentMethods.ts # label, validasi biaya/batas/alasan, isLastOffered (Metode Pembayaran)
│   │   ├── errorMessages.ts # Peta galat API → kalimat (humanizeError); errorToast.ts = toastError
│   │   ├── payoutFailures.ts # USDX-662 — aksi sah per issueKind (enum terbuka, fail-closed), buildResolveBody (alasan ≥10, externalRef SETTLED_MANUAL), peta galat code-ATAU-message, ringkasan submission, umur antrean
│   │   └── utils.ts       # cn() class name utility
│   ├── mocks/             # MSW mock API
│   │   ├── handlers.ts    # REST handlers + inline settlement simulator
│   │   ├── data.ts        # Mock data factories
│   │   ├── server.ts      # MSW node server (for tests)
│   │   └── browser.ts     # MSW browser worker (for dev)
│   └── test/              # Test setup + utilities
```

## Commands

```bash
pnpm cek:backend    # WAJIB sebelum merge ke dev — lihat di bawah
pnpm dev            # Start dev server with MSW (localhost:5173)
pnpm build          # Type check + production build
pnpm lint           # ESLint check
pnpm preview        # Preview production build
pnpm test           # Run unit tests (Vitest)
pnpm test:watch     # Run unit tests in watch mode
pnpm test:e2e       # Run Playwright E2E tests
pnpm test:all       # Run all tests (unit + E2E)
```

## Urutan merge: backend dulu, baru back-office

Beberapa layar di repo ini memanggil endpoint yang **belum ada di server**. MSW
menutupinya di `pnpm dev` dan di Vitest, tapi **MSW tidak jalan di build yang
di-deploy** — jadi kalau repo ini merge duluan, menunya muncul lalu dijawab 404,
dan itu terbaca sebagai layar rusak, bukan sebagai fitur yang belum naik.

```bash
pnpm cek:backend                      # default api-dev
pnpm cek:backend https://api.usdx.co.id
```

Exit 0 = aman di-merge. Exit 1 = ada endpoint wajib yang belum naik, dan
skripnya menyebut branch backend mana yang harus merge dulu. Daftarnya di
`scripts/backend-requirements.json`.

Probe-nya dikirim **tanpa auth**, dan itu disengaja: `404` berarti endpointnya
memang tidak ada, `401`/`403` berarti ada dan cuma minta login. Jadi
pemeriksaannya tidak butuh kredensial apa pun.

Yang **tidak bisa** dibuktikan skrip ini: kebutuhan berupa *parameter* atau
*field* baru pada endpoint yang sudah lama ada. Di situ server menjawab `401`
entah parameternya didukung atau tidak. Butir seperti itu ditandai
**🔎 KONFIRMASI MANUAL** alih-alih diberi lampu hijau palsu — periksa sendiri
bahwa branch backend-nya sudah naik.

Sebelumnya yang menjaga urutan ini cuma komentar di kode. Komentar tidak bisa
gagal; perintah dengan exit code bisa.

## Architecture Principles

- **Feature-based organization** — each feature owns its pages, modals, hooks, and types
- **Shared components in `src/components/`** — only truly reusable components go here
- **Business logic in `src/lib/`** — pure functions, testable without React
- **Server state via TanStack Query** — no manual fetch + useState patterns
- **URL-driven table state** — filters, pagination, sort persisted in URL search params
- **Mock-first development** — MSW handlers serve as API contract definition

## Conventions

### Naming

- Components: PascalCase files + default export (`UsersPage.tsx` → `export default function UsersPage()`)
- Hooks: camelCase files (`hooks.ts` → `export function useCustomers()`)
- Utilities: camelCase files (`format.ts` → `export function formatAmount()`)
- Types: PascalCase interfaces/types (`Customer`, `OtcStatus`)
- Tests: `__tests__/` folder next to source, named `*.test.ts(x)`
- E2E tests: `e2e/*.spec.ts`

### Test Convention

```typescript
describe('functionName', () => {
  describe('positive', () => {
    test('should ...', () => {})
  })
  describe('negative', () => {
    test('should ...', () => {})
  })
  describe('edge cases', () => {
    test('should ...', () => {})
  })
})
```

### Form / modal conventions

- Forms validate on blur after first interaction; re-validate on change once a field is touched; submit revalidates all
- Modals use shadcn `Dialog`; Esc / outside-click disabled while a mutation is in flight
- Submit button shows spinner + "Submitting…" during mutation
- On success: modal closes, form resets to initial state, focus returns to first field
- On error: toast fires; modal stays open with error visible; form values preserved

### Data Flow

```
Page → useQuery hook → fetch() → MSW handler (dev) / Real API (prod)
Page → useMutation hook → fetch() → MSW handler / Real API
  └→ onSuccess: invalidateQueries → refetch list + dashboard
```

### Color System (merek usdx.co.id, redesain fase 1)

Token di `src/index.css` (`:root` terang, `.dark` gelap). Pakai nama token
Tailwind (`bg-primary`, `text-gold`, …), bukan hex.

| Token | Terang | Pemakaian |
|-------|--------|-----------|
| `primary` | maroon `#800000` | tombol utama, menu aktif, tautan; di gelap diangkat ke merah muda terang dengan teks gelap di atasnya |
| `gold` / `gold-soft` / `gold-foreground` | emas `#e0a93c` | aksen merek, isian "Yang perlu kamu lakukan" |
| `success` / `warning` / `destructive` | — | chip status (lewat `ToneChip` / `StatusPill`) |
| `font-display` | Crimson Pro | judul halaman (`PageHeader`), judul modal/dialog/sheet (`DialogTitle`, `SheetTitle`), dan wordmark USDX di Sidebar/Navbar — tidak untuk isi |

Tidak ada gradien CTA lagi (`bg-blue-pulse` milik Azure Horizon sudah pensiun).

### Tipografi — token per peran (audit font 10 Okt 2026)

Skala di `src/index.css` (`--text-*: initial`, jadi ukuran di luar daftar ini
gagal dikompilasi). 11px (`text-2xs`) dan 18px (`text-lg`) DIBUANG, begitu juga
`text-xl`/`text-2xl`; `src/__tests__/theme.test.tsx` menjaga keduanya.
`tailwind-merge` di `lib/utils.ts` mengenal token baru sebagai UKURAN (kalau
tidak, `cn('text-label', 'text-muted-foreground')` membuang ukurannya).

| Peran | Kelas | Ukuran |
|-------|-------|--------|
| Judul halaman | `font-display text-page-title` | Crimson Pro 28/32 600 (`PageHeader`) |
| Judul modal/dialog/sheet | `font-display text-dialog-title` | Crimson Pro 20/26 600 (`DialogTitle`, `SheetTitle`) |
| Judul seksi | `text-section` | Inter 14/20 600 (`DataSection`, `FormSection`, `CardTitle`) |
| Badan & form | `text-base` | Inter 14/22 |
| Teks tabel | `text-sm` | Inter 13/20, kolom utama `font-medium` |
| Meta / waktu | `text-xs` | Inter 12/18 |
| Label, kepala kolom, badge/status | `text-label` | Inter 12/16 500 |
| Uang di tabel | `text-money` (atau `font-semibold`) | Inter 13/20 600 |
| Uang besar | `text-money-lg` | Inter 24/28 600 -0.01em — tanpa `leading-none`, tanpa `tracking-tight` |

- **Angka** (uang, kurs, plafon, angka laporan, waktu, "x menit lagi", paginasi
  "1–8 dari 8", hitungan) = Inter + `tabular-nums`. Ejaan Indonesia di mana pun
  (`51.249,75`, termasuk Cadangan).
- **JetBrains Mono HANYA** untuk hash, ID, alamat wallet, path API, JSON / nilai
  mentah di "Detail teknis", nomor order/referensi — `font-mono text-xs
  text-muted-foreground`.
- **Satu gaya status**: `STATUS_CHIP_BASE` (`lib/statusChip.ts`) dipakai `Badge`,
  `StatusPill`, `ToneChip`, dan badge status lokal — sudut kecil, tanpa titik,
  `font-sans text-label`.
- **Tanpa enum mentah ke admin**: kode yang belum punya label tampil
  `UNKNOWN_CODE_LABEL` ("Belum dikenali", `lib/status.ts`) dengan kodenya di
  `title` dan di "Detail teknis".

### Mint/Burn Request Lifecycle (sot/phase-1.md § Flow MINT/BURN OTC)

```
operator submits form
      │
      ▼
[ PENDING_APPROVAL ] ── reject ──▶ [ REJECTED ] (terminal)
      │
      ▼ (Safe approves + executes on-chain)
[ APPROVED ] ──▶ [ EXECUTED ] (mint terminal)
                       │
                       ▼ (burn only — operator wires IDR to user bank)
                 [ IDR_TRANSFERRED ] (burn terminal)
```

Sidebar `(N)` badge counts requests with status `PENDING_APPROVAL`. Counts are queried per type (mint/burn) via `/api/v1/requests?type={kind}&status=PENDING_APPROVAL`.

## Security

- CSP meta tag in `index.html` restricts script/style/font/connect sources.
  **Anything the app `fetch`es needs its host in `connect-src`** — `img-src` does
  not cover it. Guarded by `src/__tests__/csp.test.ts`, which reads the shipped
  policy off disk, because neither jsdom nor MSW enforces CSP and no integration
  test can catch a missing origin (USDX-292 Polygon RPC, then the transparency
  upload host)
- Security headers in `vite.config.ts`: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`
  — `pnpm dev` / `preview` only; the deployed build sends none of them
- Anti-clickjacking in the build itself: `main.tsx` does not render when the page is
  loaded inside a frame (`src/lib/frameGuard.ts`, WSTG-CLNT-09)
- Auth is mocked via localStorage — **not production-ready**
- All `target="_blank"` links should include `rel="noopener noreferrer"`
- `?next=` di `/login` hanya diikuti bila `safeNextPath` membuktikannya path internal (anti open redirect; `src/lib/__tests__/nextPath.test.ts` + e2e `usdx-halaman-galat.spec.ts`)
- No `dangerouslySetInnerHTML`, no `eval()`, no `innerHTML`
- CSV export escapes cells starting with `=`, `+`, `-`, `@` to prevent formula injection

## Known v1 Risks (mock-only; documented intentionally)

1. **Any non-empty email + password authenticates** (R64). Production must replace with real IdP.
2. **No RBAC** — all five menus are visible and fully functional for any authenticated user.
3. **OTC submissions run with no approver, no cap, no confirmation** — any operator can mint/redeem unbounded volume.
4. **Staff invites have no authorization check** — any operator can invite a Super Admin.
5. **localStorage staffId is user-tamperable** via DevTools; no impact in mock mode (auth already permissive), but must be replaced by server-side session validation pre-production.
6. **Clipboard-hijack wallet substitution** is not mitigated (no confirmation modal); address validation is checksum-only.

## Adding a New Feature

1. Create `src/features/{name}/` with page, hooks, and modal components
2. Add route in `src/App.tsx` under the protected routes
3. Add nav item in `src/components/layout/navItems.ts` (single nav tree for Sidebar + mobile drawer)
4. Add MSW handlers in `src/mocks/handlers.ts`
5. Add mock data factory in `src/mocks/data.ts`
6. Write unit tests colocated in `__tests__/` for business logic and page integration
7. If the feature adds a critical flow, extend `e2e/smoke.spec.ts`

# Source of Truth

Folder `sot/` contains the project spec. Read before coding. Never edit `sot/`.

**If spec is unclear — ask the PM, don't assume.**

## Key files for this repo:

- `sot/phase-1.md` — backoffice pages, role system, mint/burn flows
- `sot/conventions.md` — API response format, naming conventions, status enums
- `sot/openapi.yaml` — API contract (all endpoints + request/response shapes)

## Critical rules:

- API responses follow `{ status, metadata, data, error }` format — handle accordingly
- Role-based UI: hide/show elements based on staff role from `/api/v1/auth/me`
- Address validation: checksummed EVM format (use viem)
- Status enums for requests: see `sot/conventions.md` § Status Enums
- SOT is authoritative — if your implementation differs from SOT, your code adjusts (not SOT)

## PR Description

Saat buat PR, generate description mengikuti format di `sot/templates/pr-template.md`. Ini wajib — PM review berdasarkan structure ini.

Key points:
- Selalu include "PM Action Items" section (bisa "None")
- Selalu include "SoT Alignment" table — cross-check setiap field/endpoint vs SOT
- Jika implement sesuatu yang TIDAK ada di SOT → masukkan ke "Known Drift > Needs PM Action" dengan category ❓ Decision
- Jika ada AC yang belum bisa dicapai → mark ⏳ Deferred dengan reason
- Jika ada action yang harus dilakukan SETELAH merge → masukkan "Post-Merge Actions"


# Source of Truth

Folder `sot/` contains the project spec. Read before coding. Never edit `sot/`.

**If spec is unclear — ask the PM, don't assume.**

## Key files for this repo:

- `sot/phase-1.md` — backoffice pages, role system, mint/burn flows
- `sot/conventions.md` — API response format, naming conventions, status enums
- `sot/openapi.yaml` — API contract (all endpoints + request/response shapes)

## Critical rules:

- API responses follow `{ status, metadata, data, error }` format — handle accordingly
- Role-based UI: hide/show elements based on staff role from `/api/v1/auth/me`
- Address validation: checksummed EVM format (use viem)
- Status enums for requests: see `sot/conventions.md` § Status Enums
- SOT is authoritative — if your implementation differs from SOT, your code adjusts (not SOT)

## PR Description

Saat buat PR, generate description mengikuti format di `sot/templates/pr-template.md`. Ini wajib — PM review berdasarkan structure ini.

Key points:
- Selalu include "PM Action Items" section (bisa "None")
- Selalu include "SoT Alignment" table — cross-check setiap field/endpoint vs SOT
- Jika implement sesuatu yang TIDAK ada di SOT → masukkan ke "Known Drift > Needs PM Action" dengan category ❓ Decision
- Jika ada AC yang belum bisa dicapai → mark ⏳ Deferred dengan reason
- Jika ada action yang harus dilakukan SETELAH merge → masukkan "Post-Merge Actions"
