# USDX Back Office

## Overview

Internal back office SPA for managing **OTC mint** and **burn** operations on the USDX stablecoin, plus directory management for end-customers and internal staff. Mint/burn requests follow the SoT phase-1 approval lifecycle (`PENDING_APPROVAL → APPROVED → EXECUTED`, plus `IDR_TRANSFERRED` for burn, terminal `REJECTED`).

**Brand:** USDX | **Design system:** Azure Horizon (teal-anchored, Manrope + Inter, no-line tables) — see `back-office-usdx/azure_horizon/DESIGN.md` for the full spec.

## Tech Stack

- **React 19** + **Vite 8** + **TypeScript 5.9** (strict mode)
- **TailwindCSS v4** — utility-first, configured via `@theme` in `src/index.css`
- **shadcn/ui** — accessible UI components (Radix UI primitives)
- **React Router v7** — SPA routing with `createBrowserRouter`
- **TanStack Query v5** — server state management
- **TanStack Table v8** — data table with server-side pagination/sorting/filtering
- **MSW v2** — mock API in development (handlers in `src/mocks/`)
- **Recharts** — Dashboard volume trend chart (lazy-imported)
- **pnpm** — package manager
- **Vitest** — unit tests
- **Playwright** — E2E tests

## Menu Structure (per Linear USDX-50 + sot/phase-1.md § Sidebar)

Sidebar groups three sections: **WORKSPACE**, **OTC**, **SETTINGS**.

| Route | Section | Menu label | Visibility | Purpose |
|-------|---------|------------|------------|---------|
| `/dashboard` | WORKSPACE | Dashboard | All roles | KPIs, recent activity |
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
| `/transactions/:id` | — | — | All roles | Order detail modal — MINT: fee/spread/revenue + idempotency key + on-chain/Safe links. REDEEM: spread jual + redeem/disbursement fee + net payout + bank (nama bank + nomor rekening penuh + nama pemilik — un-mask USDX-270) + redeem_id + burn_tx_hash + payout_ref (USDX-245). **Partner section (USDX-547, partner orders only)**: display name + code, on-behalf-of, `partner_customer_id`, and `external_reference` rendered IN FULL (never middle-truncated — it is the number the partner quotes when reporting a problem). Read-only (no approve) |
| `/kyc` | COMPLIANCE | KYC Review | All roles | KYC submission list (USDX-154) — sidebar shows `(N)` PENDING count |
| `/kyc/:id` | — | — | All roles | KYC detail modal — decrypted PII + photos + approve/reject (USDX-155); actions hidden unless PENDING, Developer view-only. **CDD block (USDX-545)**: occupation / source of funds / annual income / transaction purpose / NPWP / PEP status + relation. Enum values are copied value-for-value from `partner_customer_kyc` so retail and partner customers are judged on ONE CDD standard. `npwp` + `pepRelation` are PII → **role yang boleh MEMUTUSKAN** via `canReviewCustomerPii` (`src/lib/pii.ts`, USDX-610: STAFF / MANAGER / ADMIN; DEVELOPER masked). Angka itu bukan pelonggaran sepihak — ia menyamai `KYC_IDENTITY_PII_ROLES` di `kyc-backoffice.service.ts`, yang memang sudah mengirim plaintext-nya ke STAFF, dan `sot/conventions.md § Aturan Implementasi` ("backoffice KYC review (Staff/Manager/Admin)"). Gerbang ADMIN-saja yang lama membuat layar bertentangan dengan dirinya sendiri: NIK dan tanggal lahir utuh di sebelah `***` untuk nama gadis ibu kandung. Yang tersamar melihat `***` + keterangan "not shown to your role", sementara field yang memang kosong menampilkan em dash — "withheld" dan "not collected" tidak boleh terbaca sama. The section renders even when the whole block is empty (pre-USDX-545 customers) with an explicit note, so a reviewer cannot mistake missing CDD for a complete record. **Field POJK 8/2023 (USDX-587)**: identitas Pasal 25 (1) a angka 1 (`nationality` — bukan duplikat `country`: kewarganegaraan orangnya vs negara alamatnya, `gender`, `maritalStatus`, `mothersMaidenName`, `aliasName`) di grid identitas supaya bisa dicocokkan baris demi baris dengan KTP yang terpampang di bawahnya, plus `netWorthRange` (angka 4 separuh kedua), `sourceOfWealth` (**Pasal 37 (1) d**, EDD PEP — bukan Pasal 25) dan `employerAddress`/`employerPhone` (butir g) di blok CDD. `occupation` kini 99 nilai Permendagri 109/2019 dan ditampilkan sebagai **label** (`Pegawai Negeri Sipil (PNS)`), bukan kode enum — petugas mencocokkannya dengan kolom "Pekerjaan" di KTP-el. `mothersMaidenName` / `aliasName` / `employerAddress` / `employerPhone` ikut gerbang PII yang sama dengan `npwp`. **Dua kejanggalan disorot, tidak memblokir Approve**: (a) pekerjaan kode Permendagri 48–63 (jabatan publik = cakupan PEP domestik Pasal 2 (2) b) tapi `pepStatus === false` — `null` TIDAK dihitung, itu "belum ditanya" bukan jawaban yang bertentangan, dan menghitungnya akan memasang banner pada setiap berkas lama sekaligus; (b) `pepStatus === true` tanpa `sourceOfWealth`, karena Pasal 37 (1) d mewajibkan EDD-nya menganalisis sumber dana DAN sumber kekayaan. Keduanya sah setelah diperiksa, jadi yang wajib adalah petugas MELIHATNYA — tombol yang mati justru membuat ia mencari jalan memutar. **Alasan tolak minimal 10 karakter setelah trim (USDX-610)**, angka yang sama dengan KYB, ditegakkan di dialog, lagi di `useRejectKyc`, lagi di `RejectKycDto` + service, dan lagi oleh CHECK `kyc_rejected_requires_reason` — batas lamanya `1` menerima alasan "x", yang lalu dikirim ke nasabah lewat email `kyc-rejected.html` dan membuatnya mengunggah ulang berkas yang sama persis. **Panel status screening (USDX-610, `ScreeningSubjectPanel`)**: hasil DTTOT & DPPSPM berkas ini dibaca dari `GET /api/v1/screening/results?subjectType=KYC&subjectId=` — endpoint terpisah, BUKAN field baru di response KYC, karena tiap pembacaan KYC menulis satu baris `pii_access_audit` sementara membaca hasil screening tidak. Panelnya **tidak pernah memblokir Approve** (fail-open tetap keputusan yang berlaku); yang diperbaiki adalah lolosnya yang diam-diam |
| `/kyb` | COMPLIANCE | KYB Review | All roles | **KYB review queue (USDX-546)** — business-entity due diligence, sidebar shows `(N)` PENDING count. MANUAL flow (keputusan Mas Yan: KYB partner manual, bukan API): a LEGAL_ENTITY *account* can already be created via `POST /api/v1/users`, what was missing is somewhere to keep the entity's CDD data. The queue shows `users.name` + account email + legal form + status + submission count: `GET /api/v1/kyb` carries NO ciphertext column, so the registered entity name and the NIB are not in the list payload and cannot be searched. LIVE on the real backend since 28 Aug 2026 (PR #271 migration `0077` + PR #275) — the KYB MSW handlers were deleted |
| `/kyb/new` | — | — | All except DEVELOPER | KYB manual-entry form — entity fields + UBO repeater (declared ownership may not exceed 100%) + legal-entity account picker (`entityType=LEGAL_ENTITY`, deliberately NOT `UserPicker`, which filters `kycStatus=VERIFIED` and would return nothing for an entity awaiting KYB) |
| `/kyb/:id` | — | — | All roles | KYB detail modal — entity block, UBO cards (`identityNumber` is PII → ADMIN only), eight FIXED document slots each with their own **three-step upload** (`presign` → `PUT` the bytes to storage with the ticket's headers verbatim → `attach` the object key; backend PR #275) shown only while the record is PENDING and only to STAFF / MANAGER / ADMIN, mirroring both server gates — this is what lets a record reach VERIFIED at all, since approve refuses with `409 KYB_DOCUMENTS_INCOMPLETE` until akta · NIB · NPWP · KTP pengurus are on file — plus laporan keuangan · struktur manajemen · struktur kepemilikan when the entity is neither micro/small nor a perseroan perorangan (USDX-605, POJK 8/2023 Pasal 27 (1)), approve / **reject with a MANDATORY reason of at least 10 characters** (`RejectKybDto @MinLength(10)` plus two DB CHECKs), enforced in the dialog, again in `useRejectKyb`, and again by the API — a dialog-only guard is bypassed by any other caller and the trail then carries a reasonless rejection. **Kartu UBO lengkap Pasal 33 ayat (3) (USDX-587)**: huruf a (identitas — alias, tempat/tanggal lahir, kewarganegaraan, jenis kelamin, status perkawinan, pekerjaan, alamat & telepon tempat kerja), b & c (profil finansial UBO SENDIRI, bukan badan usahanya), d (`legalRelationship` + dokumennya) dan e (pernyataan nasabah), plus `cascadeStep` — langkah Pasal 33 yang dipakai sampai pada orang ini, yaitu pertanyaan pertama pemeriksa dan satu-satunya yang tidak bisa dijawab dari sisa kartunya. Empat kolom saja tidak cukup: **ayat (12)** mewajibkan PJK MENOLAK hubungan usaha kalau identitas UBO tidak bisa diyakini. Dua keadaan disorot di kartunya — jenis hubungan hukum terisi tapi dokumennya `null` (huruf d meminta hubungan itu "ditunjukkan dengan" berkas), dan pernyataan nasabah hilang — yang approve TIDAK tahan, dan kartunya mengatakan itu: kontraknya menyatakan huruf e sengaja tanpa gerbang otomatis — dan **keduanya diam untuk role yang memang tidak pernah diberi presigned URL**, karena di situ `null` tidak membuktikan apa pun. Tingkat badan usaha: `incorporationPlace` dirender BERPASANGAN dengan `establishmentDate` (angka 5 berbunyi "tempat **dan** tanggal", jadi butir itu harus terbaca utuh atau terbaca separuh), `sourceOfFunds` + `transactionPurpose` (angka 8 & 9), dan `isMicroOrSmall` ditulis sebagai KONSEKUENSINYA, bukan sebagai sel `true`/`false`: ia menentukan set dokumen wajib (Pasal 27 (1) huruf a untuk semua korporasi, huruf b menambah enam lagi), dan `null` diperiksa sebagai bukan mikro/kecil — keliru menuntut dokumen bisa diperbaiki petugas, keliru melepasnya ketahuan saat diperiksa OJK. **Panel status screening (USDX-610)** sama dengan layar KYC, cakupannya badan usahanya (`subjectType=KYB`): hasil UBO tersimpan sebagai `subjectType=KYC_UBO` dan endpoint hasil hanya menyaring satu `subjectId` per permintaan, sementara `LIST_UNAVAILABLE` adalah keadaan DAFTARNYA pada saat pemeriksaan — kalau DPPSPM tak terbaca untuk badan usahanya, ia juga tak terbaca untuk para UBO-nya di pemeriksaan yang sama |
| `/screening` | COMPLIANCE | Screening | All roles | **Antrean temuan screening DTTOT & DPPSPM (USDX-588)** — POJK 8/2023 Pasal 53, satu-satunya temuan audit CDD yang wajib DAN bersanksi administratif. Sidebar `(N)` menghitung temuan yang MASIH MENAHAN subjeknya. Dua sifat kontrak membentuk seluruh layarnya: (1) `screening_results` **tidak menyimpan nama nasabah** — tabelnya append-only (dua trigger DB menolak UPDATE/DELETE), jadi PII di sana jadi PII yang tidak bisa dihapus sweeper retensi; identitas subjek diambil terpisah lewat `subjectType` + `subjectId`; (2) **entri daftar bukan PII** — DTTOT/DPPSPM publikasi publik yang justru disebar agar dicocokkan, jadi ia tampil apa adanya, tidak lewat `presentPii`. `open=true` berarti "masih menahan", BUKAN "belum disentuh": server menyaring `POTENTIAL_MATCH` + keputusan yang bukan `CLEARED`, jadi temuan yang sudah diputus `CONFIRMED_MATCH` tetap di antrean karena subjeknya masih tertahan — kolom Keputusan yang memisahkan keduanya |
| `/screening/:id` | — | — | All roles | Layar banding — data nasabah vs entri daftar **berdampingan**, karena satu-satunya pertanyaan yang dijawab petugas adalah "apakah ini pihak yang sama". Dua keputusan (`CLEARED` / `CONFIRMED_MATCH`) dengan **alasan wajib min. 10 karakter**, ditegakkan di dialog, lagi di `useDecideScreening`, dan lagi oleh API + CHECK DB — alasan inilah "hasil analisis" yang Pasal 63 ayat (2) huruf c wajibkan ditatausahakan. DEVELOPER view-only (403). Sisi nasabah dibaca dari `GET /api/v1/kyc/{id}` / `kyb/{id}` dengan **kunci cache yang sama** dengan layar review KYC/KYB, supaya satu perbuatan tidak jadi dua baris `pii_access_audit`. **`KYC_UBO` dinyatakan tidak bisa ditelusuri**: tidak ada endpoint yang mengambil satu baris `kyc_ubo` dan temuan tidak membawa id KYB induknya — panel kosong akan terbaca sebagai "nasabah tanpa data" |
| `/screening/lists` | COMPLIANCE | *(tombol di /screening)* | **ADMIN + MANAGER** (RoleGuard) | Versi daftar sanksi + impor + pemindaian ulang. Lebih ketat daripada memutus satu temuan karena keduanya mengubah DASAR penilaian SELURUH nasabah sekaligus (`screening.controller.ts`); digerbangi di ROUTE, bukan hanya tombolnya. Impor tiga langkah (buat `DRAFT` → unggah entri bertahap → aktifkan) karena body JSON dibatasi 100 kB sementara daftar DTTOT jauh lebih besar. Berkas dibaca dan **divalidasi seluruhnya di browser** sebelum panggilan pertama (`previewSanctionCsv`) — tidak ada endpoint untuk menghapus versi DRAFT, jadi berkas cacat di baris 4.000 akan meninggalkan versi setengah terisi yang tidak bisa dibersihkan. Tiap potongan membawa baris header sendiri. Mengaktifkan versi selalu **menawarkan pemindaian ulang** (Pasal 53 ayat (3): pemeriksaan wajib sejak daftar DITERIMA, bukan hanya saat onboarding); `truncated: true` menawarkan lanjutan |
| `/settings/rate` | SETTINGS | Rate | ADMIN + DEVELOPER (update is ADMIN-only) | View / update base rate + spread **beli/jual** (USDX-207) |
| `/settings/fee` | SETTINGS | Fee | ADMIN + DEVELOPER (update is ADMIN-only) | View / update fee config — mint fee % + PG fee VA flat / QRIS % (USDX-207) + redeem fee % + disbursement fee flat (USDX-245); POST = full 5-field snapshot, 422 VALIDATION_ERROR; non-admin read-only |
| `/settings/threshold` | SETTINGS | Threshold | ADMIN + DEVELOPER (update is ADMIN-only) | View / update Safe routing threshold |
| `/transparency` | COMPLIANCE | Transparency | ADMIN + DEVELOPER via `RoleGuard` (recording is ADMIN-only) | Append-only **reserve ledger** — entry history table (event date / type / amount / reason / recorded by / recorded at, server-paginated), reserve balance read from the response's `balance` field, and an add-entry form (SEED/ADJUSTMENT, negative amounts allowed as corrections, reason min 10 chars and no control/bidi characters, non-future `occurredAt` judged in WIB) behind a confirm dialog that restates the amount and the resulting balance. POST carries an **`idempotencyKey`** (16-200 chars) minted once per form-filling attempt and re-sent unchanged on retry — **201** = new entry, **200** = safe replay of the SAME content, both success, while the same key with **different** content is **409 `LEDGER_IDEMPOTENCY_KEY_CONFLICT`** (nothing written) and is handled as an actionable failure: reload the balance, show it, then offer to re-send under a new key. After any non-422 failure the balance is re-read and shown before a retry is offered, and a commit is blocked while the balance is unknown. Monthly attestation PDFs use the three-step upload (`upload-url` with a REQUIRED `{ period, sizeBytes }` → `PUT` to storage using the ticket's `headers` verbatim → register `fileKey`), capped at **5 MiB** and content-sniffed for a real PDF header; the list is server-paginated and revoked reports are filtered out. Contract: `catatan/KONTRAK-API-TRANSPARANSI.md` |
| `/settings/oncall` | SETTINGS | On-Call | **ADMIN only — including read** | Kontak on-call insiden uang (USDX-485, audit P1-18). CRUD nama / peran / kanal (PHONE·EMAIL·SLACK) / kategori insiden. Backend menyisipkan kontak yang cocok kategorinya ke dalam isi alarm kondisi uang; nol kontak → alarm tetap terkirim dengan peringatan eksplisit. Lebih ketat dari Settings lain karena `contactValue` bisa berupa nomor telepon (PII → ADMIN saja per `sot/conventions.md § Audit Akses PII`) dan daftarnya menentukan siapa yang boleh menarik rem darurat payout |
| `/profile` | *(navbar dropdown)* | Profile | All roles | Operator profile |

Mobile BottomNav: Dashboard / Mint / Burn / More. The More drawer holds Users / Staff (ADMIN) / Rate (ADMIN+DEV) / Threshold (ADMIN+DEV) / Profile.

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
│   ├── index.css          # Azure Horizon @theme tokens
│   ├── components/
│   │   ├── ui/            # shadcn/ui primitives (do not edit directly)
│   │   ├── layout/        # Navbar, Sidebar, MainLayout, BottomNav, AuthGuard
│   │   ├── Avatar.tsx     # Initials + fixed-palette avatar
│   │   ├── FieldError.tsx # Inline form error primitive
│   │   ├── TableEmptyState.tsx  # Table empty-state primitive
│   │   ├── CustomerTypeahead.tsx  # Shared customer lookup (Unit 9+)
│   │   ├── OnChainLinks.tsx  # TxHashLink cell (clickable short tx hash) + resolveOnChainLinks — On-chain tx / Safe tx columns
│   │   └── DataTable.tsx  # Shared generic table with filter-toolbar slot
│   ├── features/
│   │   ├── auth/          # LoginPage
│   │   ├── dashboard/     # DashboardPage + hooks
│   │   ├── users/         # UsersPage + UserDetailPage + hooks
│   │   ├── staff/         # StaffPage + modal + hooks
│   │   ├── mint/          # MintListPage + MintFormPage + hooks
│   │   ├── burn/          # BurnListPage + BurnFormPage + form/info panel + hooks
│   │   ├── transactions/  # TransactionsListPage + OrderDetailModal (fee/spread/revenue) + hooks — read-only consumer orders: mint (USDX-206) + redeem (USDX-245)
│   │   ├── kyc/           # KycListPage + KycDetailModal (PII/photos/CDD/approve/reject/audit) + hooks (USDX-154/155/545)
│   │   ├── kyb/           # KybListPage + KybDetailModal + KybFormPage + LegalEntityPicker + hooks (USDX-546) — manual entity due diligence; LIVE on the real backend, no MSW handlers
│   │   ├── rate/          # RatePage + cards/forms (settings/rate) — base rate + spread beli/jual
│   │   ├── fee/           # FeeConfigPage + card/form (settings/fee) — mint fee % + PG fee VA/QRIS (USDX-207) + redeem fee % + disbursement fee flat (USDX-245, full 5-field snapshot)
│   │   ├── threshold/     # ThresholdPage + cards/forms (settings/threshold)
│   │   ├── transparency/  # TransparencyPage + ReserveBalanceCard + LedgerEntryForm + LedgerConfirmDialog + LedgerHistoryTable + AttestationSection + upload/revoke dialogs (/transparency)
│   │   ├── screening/     # ScreeningQueuePage + ScreeningDecisionModal + SanctionListsPage + SanctionListImportDialog + ScreeningSubjectPanel (USDX-610, dipasang di modal review KYC & KYB) + hooks (USDX-588) — antrean & keputusan screening DTTOT/DPPSPM, impor daftar, pemindaian ulang
│   │   ├── chains/        # useChainConfig hook (GET /api/v1/chains — explorer + Safe addresses)
│   │   ├── multisig/      # MultisigListPage + MultisigDetailSheet + tabs + wallet actions (USDX-275) — self-hosted Safe queue, connect-wallet (wagmi/RainbowKit), sign EIP-712 + execute + simulate guard
│   │   └── profile/       # ProfilePage
│   ├── lib/               # Shared utilities
│   │   ├── auth.tsx       # AuthProvider + useAuth hook
│   │   ├── types.ts       # Staff, Customer, OTC types, DashboardSnapshot
│   │   ├── validators.ts  # Pure form validators
│   │   ├── format.ts      # formatAmount, formatDate, formatShortDate, formatRelativeTime, shortHash
│   │   ├── status.ts      # OTC status config + helpers
│   │   ├── screening.ts   # Label enum screening + skor + pembaca/pemotong CSV daftar sanksi (USDX-588)
│   │   ├── pii.ts         # canReviewCustomerPii (STAFF/MANAGER/ADMIN, fail-closed, USDX-610) + presentPii/PII_MASK/PII_WITHHELD_LABEL + PARTNER_CUSTOMER_EMAIL_LABEL
│   │   ├── cdd.ts         # CDD / KYB enum label maps + labelFor fallback (USDX-545/546)
│   │   ├── csv.ts         # CSV export (with formula-injection guard)
│   │   ├── explorerUrl.ts # Block explorer deep-links (base URL from /api/v1/chains)
│   │   ├── safeUrl.ts     # Safe Wallet UI deep-links (buildSafeUrl, safeTxUrl)
│   │   ├── chainLinks.ts  # findChainConfig + resolveOnChainLinks (composes explorer/safe URLs)
│   │   ├── transparency.ts # exact BigInt-cents money math + WIB day helpers + attestation revoke filter
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
pnpm dev            # Start dev server with MSW (localhost:5173)
pnpm build          # Type check + production build
pnpm lint           # ESLint check
pnpm preview        # Preview production build
pnpm test           # Run unit tests (Vitest)
pnpm test:watch     # Run unit tests in watch mode
pnpm test:e2e       # Run Playwright E2E tests
pnpm test:all       # Run all tests (unit + E2E)
```

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

### Color System (Azure Horizon)

| Token | Hex | Usage |
|-------|-----|-------|
| `primary` | `#006780` | Dark teal anchor, headings, active states |
| `primary-container` | `#1eaed5` | Cyan action accent, CTA gradient endpoint |
| `surface` | `#f5fafd` | Page background |
| `surface-container-low` | `#eff4f7` | Sidebar, grouping surfaces |
| `surface-container-lowest` | `#ffffff` | Cards, modals, input fields |
| `on-surface` | `#171c1f` | Body text (never pure black) |
| `on-surface-variant` | `#3d484d` | Secondary text |
| `outline-variant` | `#bcc8ce` | Ghost borders at 15% opacity |
| `success` | `#10b981` | Completed badges |
| `warning` | `#f59e0b` | Pending badges |
| `error` | `#ba1a1a` | Failed badges, error text |

Primary CTA uses a 135° gradient from `primary` to `primary-container` (`bg-blue-pulse` utility).

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
- Auth is mocked via localStorage — **not production-ready**
- All `target="_blank"` links should include `rel="noopener noreferrer"`
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
3. Add nav item in `src/components/layout/Sidebar.tsx`
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
