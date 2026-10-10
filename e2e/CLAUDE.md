# E2E Tests

Frontend-only Playwright suite — the API is mocked in-test via `page.route()`
(`support/mock-api.ts`), so the tests run in CI with no backend, no credentials,
and no on-chain side effects. Backend behaviour has its own tests in the
`backend` repo (USDX-25 unit/integration/E2E, USDX-67 burn coverage).

Why mocked, not real-BE: the dev backend runs on Polygon **mainnet**, so a real
mint/burn submission would propose a real Safe transaction; burn also can't be
done for-real (the BE verifies `depositTxHash` on-chain). The mocked submit
fully exercises the FE side of the contract — form validation, request body,
success UX, list refresh — without the side effects.

## Critical-flow coverage (USDX-26)

| # | Flow | Spec |
|---|------|------|
| 1 | Login — valid + invalid + access-control / session | `usdx-26-auth.spec.ts` |
| 2 | Submit mint request → appears in list | `usdx-26-otc.spec.ts` (mint) |
| 3 | Submit burn request → appears in list | `usdx-26-otc.spec.ts` (burn) |
| 4 | OTC ▸ Mint / Redeem (10 Okt 2026): grup menu + badge per sub-menu, satu jenis per halaman, grup "Perlu tindakan" + "x dari y" tanda tangan, modal tengah `/otc/mint/:id` dengan aksi Safe di footer yang tetap terlihat saat isi digulir, cari ke URL, STAFF melihat 403 di tempat, URL lama `/otc?jenis=burn` `/mint` `/burn/:id` dialihkan ke sub-menu, modal muat di ponsel | `usdx-otc-page.spec.ts` |
| 5 | Daftar Nasabah: buat (tanpa kata sandi) → baris baru, panel kanan, ubah status KYC, hapus inline dari "Lainnya" + saringan direktori | `usdx-26-users.spec.ts` |
| 6 | Verifikasi (USDX-154/155 + fase 1): menu Nasabah ▸ Verifikasi + badge → tabel menunggu terlama dulu → panel ringkas → "Periksa berkas" → modal lengkap (PII + foto) → setujui / tolak → riwayat keputusan | `usdx-155-kyc.spec.ts` |
| 7 | User activation (USDX-156): list filter + badges → detail resend (confirm, cooldown, 409/429) → create form phone + no password | `usdx-156-users-activation.spec.ts` |
| 8 | Pencairan Bermasalah (USDX-662): badge di menu Transaksi + tautan "Perlu tindakan" → antrean → detail → resolve `SETTLED_MANUAL` (body request diperiksa) → jejak resolusi → baris hilang; 409 `ALREADY_RESOLVED` dijelaskan di dialog; `BURN_REJECTED` tanpa kirim ulang | `usdx-662-payout-failures.spec.ts` |
| 10 | Transaksi gabungan (fase 2, SOT PR #50): tab "Perlu tindakan (n)" bawaan + badge `transactionsNeedsAction` → modal tengah → aksi antrean asal di footer (resolve pencairan bermasalah) → badge turun; ↑/↓ (tombol + papan ketik) antar baris tanpa menutup, footer tetap terlihat, Esc kembali ke daftar; rincian order sebagai seksi di dalam modal (satu dialog saja, rekening tidak ditarik sebelum seksi dibuka, ↑/↓ menutupnya); modal tetap di tengah selama animasi masuk; tanpa nomor rekening di list; saringan Pemilik; antrean lama tetap via URL | `usdx-transaksi-gabungan.spec.ts` |
| 11 | Ringkasan (10 Okt 2026): mendarat di sini setelah login (menu pertama), `/dashboard` dialihkan, pasokan/OTC/cadangan/DurianPay "Belum tersedia", tautan ke tab Perlu tindakan, saldo BNI hanya setelah "Cek saldo" (nol tarikan sebelumnya), STAFF tanpa kartu cadangan & tanpa request ledger, tanpa gulir mendatar di 390px | `usdx-ringkasan.spec.ts` |
| 12 | Metode Pembayaran (SOT PR #50, seed MSW `createInitialPaymentMethods`): daftar + status (ditawarkan / menyala belum ditawarkan / mati) + biaya & batas → nyala/mati wajib alasan ≥ 10 (body PATCH diperiksa) → mematikan metode terakhir yang ditawarkan wajib centang konfirmasi → ubah urutan (satu PUT seluruh urutan, Batal membuang draf) → ubah biaya & batas (batas Transfer BNI wajib, ≤ Rp 10 juta) → 409 Transfer BNI tampil sebagai kalimat di dialog → Jejak perubahan hanya Admin (DEVELOPER baca saja, nol request activity-logs) | `usdx-payment-methods.spec.ts` |
| 13 | Halaman galat (Okt 2026): 404 di dalam layout + path dibuka + "Ke Ringkasan"; 403 STAFF di `/jejak-audit` & `/transparency` dengan peran "Staf" dan NOL request `activity-logs`/`transparency`; sesi habis di tengah jalan (401 + `/auth/me` 401) → `/login?next=…` + pesan → masuk → kembali ke halaman tadi; Keluar tanpa pesan; `next` `//evil.com` / `https://evil.com` / `/\evil.com` → Ringkasan; pengalihan sengaja (`/dashboard`, `/mint`) tetap; 401 saat reload; 390px tanpa gulir mendatar | `usdx-halaman-galat.spec.ts` |
| 14 | Antrean Tanda Tangan (Okt 2026, ops-fokus): tabel tanpa enum/alamat → modal tengah `/multisig/:id` (judul aktivitas, kalimat status, penanda tangan dengan nama, nol `0x…` di luar Detail teknis, di tengah layar) → jendela wallet RainbowKit BENAR-BENAR bisa diklik dari modal (juga dari modal OTC) → Detail teknis memuat nonce/alamat Safe → ↑/↓ + Esc → 390px tombol footer terlihat | `usdx-antrean-tanda-tangan.spec.ts` |
| 9 | Badge antrean + rekening pengganti (USDX-678): badge menu Transaksi (`nav-badge-transactions`, jumlah antrean lama) dari `GET /api/v1/queue-counts` tanpa request list `take=1` → detail → Kirim ulang ke rekening tersimpan lain (body membawa `bankAccountId`) → badge turun; 409 `BANK_ACCOUNT_NOT_OWNED` di dialog; hitungan nol tanpa badge | `usdx-678-queue-counts-replacement-account.spec.ts` |

Each spec has `positive` / `negative` / `edge cases` describe blocks.

Redesain fase 1 (Okt 2026) mengubah navigasi, dan spec mengikutinya. Sejak 10
Okt 2026 halaman awal = Ringkasan (`/dashboard` → `/ringkasan`, `loginViaForm`
menunggu `/ringkasan`; `seedAuthenticatedSession(page, staff?)` bisa menyimpan
profil peran lain), OTC adalah grup (Mint `/otc/mint` · Redeem `/otc/redeem`),
menu Nasabah/Keuangan/Pengaturan adalah GRUP yang harus dibuka dulu
(`aside.getByRole('button', { name: /^keuangan/i })`) sebelum tautannya
terlihat, dan antrean lama (Persetujuan Pencairan, Pencairan Bermasalah, Mint
Bermasalah) dicapai lewat `navigation "Antrean yang perlu tindakan"` di halaman
Transaksi. Badge-nya kini satu: `nav-badge-transactions`.

## Running

```bash
pnpm test:e2e                          # all @e2e specs
pnpm exec playwright test usdx-26-auth # one file
pnpm exec playwright test -g "logout"  # filter by title
```

The dev server is started by Playwright with `VITE_E2E=true`, which makes
`main.tsx` skip the MSW browser worker — an active service worker re-issues
passthrough requests from the SW context and would bypass `page.route()`.

## Conventions

- Tag tests with `@e2e` in the `describe` block name (`pnpm test:e2e` greps `@e2e`).
- `await installMockApi(page[, opts])` first, then either `loginViaForm(page)`
  (auth-UI tests) or `seedAuthenticatedSession(page)` before `page.goto(...)`.
  `installMockApi` returns mutable state; `opts.routes` (keyed `"METHOD /path"`)
  forces error/edge responses per endpoint.
- Use `getByRole` / `getByLabel` over `getByText` for strict-mode compliance.
  Radix `Select` triggers aren't reliably label-associated — target them by id
  (e.g. `page.locator('#kycStatus')`).
- Nested Radix dialogs (e.g. a resolve dialog on top of a detail modal): locate each by its accessible NAME (`getByRole('dialog', { name })`). While the top one is open Radix marks everything beneath it `aria-hidden`, so an unnamed `getByRole('dialog')` sees only the top layer and the page behind the modal is invisible to role queries.
- Each test is independent — no shared state between tests.
- Tests run against `http://localhost:5173` (override with `E2E_PORT=5199 pnpm test:e2e` when the port is taken).
- Modal OTC (`getByTestId('otc-modal')`) menunggu hook tanda tangan yang dimuat lazy (pustaka wallet) + `/multisig/:id`; di dev server dengan banyak worker itu bisa lewat 5 dtk, jadi asersi isi modal pertama memakai `timeout: 15000` seperti asersi judul halaman.
- Modal detail Transaksi = `getByTestId('transaction-modal')`; footernya punya tombol "Sebelumnya"/"Berikutnya" dan `record-modal-position` ("n dari N"). Tekan panah satu per satu dan tunggu posisinya berubah sebelum menekan lagi.

## Test naming

```typescript
test.describe('feature @e2e', () => {
  test.describe('positive', () => { test('should ...', async ({ page }) => {}) })
  test.describe('negative', () => { test('should ...', async ({ page }) => {}) })
  test.describe('edge cases', () => { test('should ...', async ({ page }) => {}) })
})
```
