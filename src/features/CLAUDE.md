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
| `auth/` | LoginPage | No (PublicRoute) | Split-screen login (gradient hero panel + form). Mock auth accepts any non-empty email + password. |
| `dashboard/` | DashboardPage | Yes | 4 KPI cards, Recharts trend chart (lazy-loaded), Recent Activity, Network Distribution |
| `users/` | UsersPage + UserModal + UserDeleteDialog | Yes | End-customer directory CRUD with type/role filters |
| `staff/` | StaffPage + StaffModal + StaffDeleteDialog | Yes | Internal team directory CRUD; create fires "Invitation sent" toast |
| `otc/mint/` | OtcMintPage + OtcMintForm + OtcMintInfoPanel + RecentRequestsList | Yes | Single-shot mint submission with async settlement |
| `otc/redeem/` | OtcRedeemPage + OtcRedeemForm + OtcRedeemInfoPanel + RecentRedemptionsTable | Yes | Single-shot redeem with MAX helper |
| `otc/` | OtcSplashPage | Yes | Mobile BottomNav landing for OTC submenu |
| `report/` | ReportPage + ReportFilterToolbar + ReportInsightsBento | Yes | Filterable union of OTC transactions + CSV export |
| `profile/` | ProfilePage + PersonalDetailsForm + SecurityAccessSection + RecentActivityTimeline | Yes | Operator profile (reachable only via navbar dropdown) |

Shared `usePendingSettlementPolling` lives in `src/features/otc/hooks.ts` —
both Mint and Redeem consume it for 5s polling + toast dedup.

## Adding a Feature

1. Create folder under `src/features/`
2. Create page + hooks + (optional) modal/delete dialog/filter toolbar
3. Register route in `src/App.tsx`
4. Add sidebar nav item in `src/components/layout/Sidebar.tsx`
5. Add MSW handlers in `src/mocks/handlers.ts`
6. Add Vitest integration tests in `src/features/{feature}/__tests__/`
7. If the feature is critical to the operator flow, extend `e2e/smoke.spec.ts`
