# Features

Feature-based modules. Each feature is a self-contained unit with its own
pages, modals, hooks, and types.

## Structure per Feature

```
feature-name/
  ├── FeaturePage.tsx          # Main page component (default export)
  ├── FeatureModal.tsx         # Add/Edit modal (where applicable)
  ├── FeatureDeleteDialog.tsx  # Destructive confirmation (where applicable)
  ├── FeatureFilterToolbar.tsx # Custom toolbar (passed to DataTable.filterToolbar)
  ├── hooks.ts                 # TanStack Query hooks for data fetching
  └── __tests__/               # Vitest integration tests
```

## Conventions

- **Pages** are route-level components, default-exported
- **Hooks** use TanStack Query (`useQuery`, `useMutation`) with query keys
  namespaced by feature (e.g., `['customers']`, `['otc', 'mint', 'recent']`)
- **Modals** use shadcn `Dialog`; Esc + outside-click are disabled while a
  mutation is in flight; reset on open via `useEffect` + `key` reset pattern
- Business logic (validation, formatting, status mapping) lives in
  `src/lib/`, NOT in feature files
- Each feature fetches its own data — no prop-drilling from parent layouts

## Features

| Feature | Pages | Auth Required | Description |
|---------|-------|---------------|-------------|
| `auth/` | LoginPage | No (PublicRoute) | Split-screen login (gradient hero panel + form). |
| `dashboard/` | DashboardPage | Yes | KPIs + recent activity. |
| `users/` | UsersPage + UserDetailPage + ActivationStatusSection | Yes | Customer directory (KYC + activation filters) + per-user detail with admin resend-activation. |
| `staff/` | StaffPage + StaffModal + StaffDeleteDialog | Yes | Internal team CRUD (admin-gated server-side). |
| `kyc/` | KycListPage + KycDetailModal | Yes | `/kyc` KYC review list (filters + email search, oldest-first); `/kyc/:id` detail modal — decrypted PII, presigned photos (TTL countdown + refresh), approve/reject (Developer view-only), audit trail. |
| `mint/` | MintListPage + MintFormPage | Yes | `/mint` data table of mint requests; `/mint/new` mint OTC form. |
| `burn/` | BurnListPage + BurnFormPage + BurnRequestForm + BurnRequestInfoPanel | Yes | `/burn` data table of burn requests; `/burn/new` burn OTC form. |
| `transactions/` | TransactionsListPage + OrderDetailModal | Yes | `/transactions` read-only consumer order list — mint (USDX-206) + redeem (USDX-245); filter type/status (contextual RedeemStatus when type=REDEEM)/payment/safe; `/transactions/:id` detail modal — mint fee/spread/revenue + Safe links, or redeem spread jual / redeem+disbursement fee / net payout / bank (nama + nomor penuh + nama pemilik, un-mask USDX-270) / burn tx / payout ref (all roles). |
| `rate/` | RatePage + CurrentRateCard + RateUpdateForm + RateConfirmDialog | Yes | `/settings/rate` view + update base rate + spread beli/jual (admin-only update; USDX-207). |
| `fee/` | FeeConfigPage + CurrentFeeConfigCard + FeeConfigUpdateForm | Yes | `/settings/fee` view + update fee config — mint fee % + PG fee VA flat / QRIS % (USDX-207) + redeem fee % + disbursement fee flat (USDX-245); POST = full 5-field snapshot (422 VALIDATION_ERROR on invalid); admin-only update, read-only for non-admin. |
| `threshold/` | ThresholdPage + CurrentThresholdCard + ThresholdUpdateForm | Yes | `/settings/threshold` view + update Safe routing threshold (admin only). |
| `transparency/` | TransparencyPage + ReserveBalanceCard + LedgerEntryForm + LedgerConfirmDialog + LedgerHistoryTable + AttestationSection + AttestationUploadDialog + AttestationRevokeDialog | Yes | `/transparency` **append-only reserve ledger** (`catatan/KONTRAK-API-TRANSPARANSI.md`) + monthly attestation reports feeding the PUBLIC page on usdx.co.id. No draft, no publish button, no edit, no delete — an entry is public the moment it is recorded and corrections are new entries with a negative amount. The reserve figure is read from `data.balance` (whole ledger, server-computed), NEVER summed from the visible page. Recording goes through a confirm dialog that restates the amount, shows the resulting balance and states the append-only rule; the POST fires from the dialog only. Attestation upload is the **three-step flow** (`POST upload-url` with a REQUIRED `{ period }` → ticket returns `{ uploadUrl, fileKey, expiresAt, headers }` → `PUT` the bytes to storage sending the ticket's `headers` VERBATIM, with `credentials: 'omit'` so the session cookie never reaches the storage host → `POST` to register `{ period, title, fileKey }`), never multipart. Presigned URLs are signed over those headers, so hardcoding a `Content-Type` breaks the signature in production only — the MSW storage stub therefore verifies the headers and rejects a mismatch. `expiresAt` produces an explicit "upload link expired" message instead of a bare 403. Revoked reports (`revokedAt`) are filtered out of the active list. Route is `RoleGuard`-ed to ADMIN + DEVELOPER; every write is ADMIN (BE enforces 403). |
| `profile/` | ProfilePage + PersonalDetailsForm + SecurityAccessSection + RecentActivityTimeline | Yes | Operator profile (reachable only via navbar dropdown). |

## Adding a Feature

1. Create folder under `src/features/`
2. Create page + hooks + (optional) modal/delete dialog/filter toolbar
3. Register route in `src/App.tsx`
4. Add sidebar nav item in `src/components/layout/Sidebar.tsx`
5. Add MSW handlers in `src/mocks/handlers.ts`
6. Add Vitest integration tests in `src/features/{feature}/__tests__/`
7. If the feature is critical to the operator flow, extend `e2e/smoke.spec.ts`
