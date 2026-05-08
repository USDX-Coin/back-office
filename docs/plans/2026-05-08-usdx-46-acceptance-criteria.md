# USDX-46 — Acceptance Criteria (final, untuk PR description)

> Linear: https://linear.app/usdx/issue/USDX-46/rework-mint-and-burn-forms-user-picker-instead-of-text-input
>
> Original AC dari Linear di-preserve agar tetap pass. AC tambahan di bawah meng-cover scope yang berkembang setelah klarifikasi PM (currency selector, wallet picker, suspended filter).

---

## AC Original (dari Linear, harus tetap pass)

- [ ] **AC1** — Buka `/mint` → field user adalah searchable dropdown (bukan text input bebas)
- [ ] **AC2** — Ketik "john" di picker → dropdown menampilkan user yang match "john"
- [ ] **AC3** — Pilih user dari list → `userId` (uuid) ter-set di form state
- [ ] **AC4** — Submit form → request body POST `/api/v1/mint` mengirim `userId` (uuid), bukan `userName`
- [ ] **AC5** — Buka `/burn` → semua perilaku AC1–AC4 berlaku juga di burn form
- [ ] **AC6** — User dengan `kycStatus !== VERIFIED` tidak muncul di list (filtered)

---

## AC Tambahan (untuk testing scope full task ini)

### A. User Picker — eksplisit pattern + edge cases

- [ ] **AC1.1** — Operator tidak bisa submit form dengan user yang diketik bebas (free-text); submit hanya valid setelah pilih dari list
- [ ] **AC1.2** — Search query hit endpoint dengan filter eligibility: `GET /api/v1/users?search=<term>&kycStatus=VERIFIED&limit=8`
- [ ] **AC1.3** — User dengan `suspended === true` tidak muncul di list (FE-side filter, karena BE `?suspended=` belum ada)
- [ ] **AC1.4** — Setiap row di dropdown menampilkan **nama + email**
- [ ] **AC1.5** — Clear selection (klik X) → `userId` reset ke kosong + wallet picker reset
- [ ] **AC1.6** — Pilih user lain setelah sebelumnya sudah pilih → `userId` di-override + wallet picker reset
- [ ] **AC1.7** — Search 0 results → tampil empty state ("No users found.")
- [ ] **AC1.8** — Search error (network) → tampil error state
- [ ] **AC1.9** — Search di-debounce (300ms) — tidak fire request per keystroke

### B. Currency Selector

- [ ] **AC2.1** — Form first render → `amountCurrency` default = `USD`
- [ ] **AC2.2** — Switch USD ↔ IDR → unit indikator di field amount berubah (USD vs IDR)
- [ ] **AC2.3** — Saat `amountCurrency = USD` + amount valid → preview tampil "≈ X IDR" (hitung pakai `rate` dari `GET /api/v1/rate`)
- [ ] **AC2.4** — Saat `amountCurrency = IDR` + amount valid → preview tampil "≈ X USDX" (= amount / rate)
- [ ] **AC2.5** — Submit body POST `/api/v1/mint` (dan `/api/v1/burn`) menyertakan field `amountCurrency: "USD" | "IDR"`
- [ ] **AC2.6** — Rate fetch failure → preview tampil placeholder "—" (form tetap submit-able; konversi dilakukan di BE)
- [ ] **AC2.7** — Switch currency setelah operator sudah ketik amount → field amount **reset jadi kosong** (force re-confirmation)
- [ ] **AC2.8** — Rate query pakai `staleTime: 30000` + refetch on window focus (TanStack Query default — tidak polling)
- [ ] **AC2.9** — Preview format mengikuti `sot/conventions.md` § Decimals:
  - USD/USDX: max 6 decimals (e.g., `1,000.500000 USDX`)
  - IDR: 2 decimals + locale format (e.g., `Rp 16.250.000,00`)

### C. Wallet Picker

- [ ] **AC3.1** — Wallet picker baru aktif setelah user **dan** chain dipilih (sebelum itu disabled / hidden)
- [ ] **AC3.2** — Opsi dropdown = `user.wallets` di-filter berdasarkan `chain` yang dipilih
- [ ] **AC3.3** — Tiap opsi menampilkan **full address** (no truncation)
- [ ] **AC3.4** — Default state = empty placeholder "Select wallet…" (force operator klik explicit, tidak auto-select wallet pertama)
- [ ] **AC3.5** — Saat user terpilih punya 0 wallet di chain itu → dropdown disembunyikan, langsung tampil text input dengan helper "User belum punya wallet di chain ini"
- [ ] **AC3.6** — Pilih opsi "Other" → muncul text input → operator wajib ketik EVM address valid (checksum) untuk submit
- [ ] **AC3.7** — Operator ganti user → wallet pilihan reset
- [ ] **AC3.8** — Operator ganti chain → wallet pilihan reset
- [ ] **AC3.9** — Submit body tetap mengirim `userAddress` (string EVM address), terlepas dari sumber (dropdown atau "Other")

### D. Validation & Submit Flow

- [ ] **AC4.1** — Submit tanpa pilih user → tampil error "User is required"
- [ ] **AC4.2** — Submit tanpa pilih wallet (atau "Other" tapi address kosong/invalid) → tampil error address
- [ ] **AC4.3** — Submit success → toast + reset form + navigate ke `/requests`
- [ ] **AC4.4** — BE return 403 (user di-suspend setelah dipilih, race condition) → tampil error message dari API + form tetap visible

### E. Burn-specific (tambahan untuk burn)

- [ ] **AC5.1** — Burn form retain field: `depositTxHash`, `bankName`, `bankAccount` (tetap berfungsi seperti sebelumnya)
- [ ] **AC5.2** — Submit body POST `/api/v1/burn` menyertakan: `userId`, `userAddress`, `amount`, `amountCurrency`, `chain`, `depositTxHash`, `bankName`, `bankAccount`, `notes` (optional)

### F. Field Ordering (UX)

- [ ] **AC6.1** — Mint form ordering: User → Chain → Wallet → Currency → Amount → Notes
- [ ] **AC6.2** — Burn form ordering: User → Chain → Wallet → Currency → Amount → Deposit Tx Hash → Bank Name → Bank Account → Notes

---

## SoT Alignment Cross-check

| Field / behavior | SoT reference | FE behavior |
|---|---|---|
| Submit `userId` (uuid) | `sot/api/mint.yaml` L40, `sot/api/burn.yaml` L40 | ✅ |
| Submit `amountCurrency` (USD\|IDR) | `sot/api/mint.yaml` L55-56, `sot/api/common.yaml` L144-147 | ✅ |
| User schema (`name`, `email`, `kycStatus`, `suspended`, `wallets[]`) | `sot/api/users.yaml` L209-238 | ✅ |
| `GET /users?kycStatus=VERIFIED` | `sot/api/users.yaml` L12-15 | ✅ |
| `GET /api/v1/rate` untuk preview | `sot/api/rate.yaml` L2-17 | ✅ |
| BE validates eligibility (defense in depth) | `sot/api/mint.yaml` L8, `sot/phase-1.md` L153 | FE filter = UX layer; BE tetap authoritative |

---

## Out of Scope (untuk follow-up ticket)

- Edit `kycStatus` / `suspended` lewat Users page (PATCH endpoint sudah ada di SoT, FE belum implement)
- Display `inputCurrency` di Request list/detail page
- BE add `?suspended=` query param (saat ini FE-side filter only)
- **Role-based access** ke page mint/burn (`sot/phase-1.md` § Role System bilang Developer tidak boleh mint/burn, Staff tidak boleh > threshold) — saat ini FE belum gating berdasarkan `staff.role`; BE 403 jadi backstop
- **Threshold-aware UX warning** sebelum submit (e.g., "Amount > threshold, hanya Manager/Admin") — saat ini cuma BE 403 setelah submit
- Display `idempotencyKey` di success state untuk audit trail

---

## Implementation Decisions (best-judgment defaults, non-AC level)

Bukan AC yang harus dites, tapi keputusan implementasi yang sudah dipilih supaya konsisten:

1. **Rate staleness** — `useQuery` dengan `staleTime: 30 * 1000` + TanStack Query default `refetchOnWindowFocus: true`. Tidak polling. Konsisten dengan `usePhaseOneUsers` existing.
2. **Currency switch behavior** — reset amount field saat operator switch USD↔IDR (lihat AC2.7). Alasan: OTC high-stakes, hindari risk auto-convert / keep-value yang bisa nyasar magnitude.
3. **Rate display location** — dua lokasi, beda fungsi:
   - Sidebar `<CurrentRateCard />` (existing, tidak diubah) → rate reference
   - Inline preview baru di samping/bawah field amount → konversi spesifik amount form ini
4. **Test strategy** — integration test (`__tests__/MintRequestPage.test.tsx`, `__tests__/BurnRequestPage.test.tsx`) + validator unit test + extend `e2e/smoke.spec.ts`. Tidak nambah Storybook / hooks unit terpisah.
5. **`<CurrentRateCard />`** — keep as-is, single responsibility (rate display widget). Tidak digabung dengan inline preview.
