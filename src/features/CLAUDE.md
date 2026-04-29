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

- **Pages** are route-level components, default-exported.
- **Hooks** use TanStack Query (`useQuery`, `useMutation`) with query keys
  namespaced by feature (e.g., `['customers']`, `['otc', 'mint', 'recent']`).
- **Forms** use `react-hook-form` + `zod` via shadcn `<Form>`. Schemas live in
  `src/lib/schemas.ts`. Use `mode: 'onTouched'` for the standard "validate
  after first blur, re-validate on change once touched" UX.
- **Modals** use shadcn `Dialog`; Esc + outside-click are guarded while a
  mutation is in flight (`onEscapeKeyDown`/`onPointerDownOutside`).
  Reset the form on open via `useEffect` calling `form.reset(...)`.
- **Page header**: each page renders `<PageHeader title="…" actions={...} />`
  immediately followed by the table or form. No SummaryStat / KPI cards above
  the table — the page is intentionally minimal.
- Business logic (validation, formatting, status mapping) lives in `src/lib/`,
  NOT in feature files.
- Each feature fetches its own data — no prop-drilling from parent layouts.

## Features

| Feature | Routes | Auth Required | Description |
|---------|--------|---------------|-------------|
| `auth/` | `/login` | No (PublicRoute) | Login form on RHF + zod (loginSchema). Mock auth accepts any non-empty email + password. |
| `dashboard/` | `/dashboard` (hidden from sidebar) | Yes | 4 KPI cards, Recharts trend chart (lazy-loaded), Recent Activity, Network Distribution. |
| `users/` | `/user/user-client` (legacy `/users` redirects) | Yes | End-customer directory CRUD with type/role filters. |
| `staff/` | `/user/internal` (legacy `/staff` redirects) | Yes | Internal team directory CRUD; create fires "Invitation sent" toast. Default landing route after login. |
| `otc/mint/` | `/otc/mint` | Yes | Single-shot mint submission with async settlement. |
| `otc/redeem/` | `/otc/redeem` | Yes | Single-shot redeem with MAX helper. |
| `otc/` | `/otc` | Yes | OTC splash landing. |
| `report/` | `/report` | Yes | Filterable union of OTC transactions + CSV export. |
| `profile/` | `/profile` | Yes | Operator profile (reachable only via navbar dropdown). PersonalDetailsForm uses RHF + zod (profileSchema). |

Shared `usePendingSettlementPolling` lives in `src/features/otc/hooks.ts` —
both Mint and Redeem consume it for 5s polling + toast dedup.

## Adding a Feature

1. Create folder under `src/features/`.
2. Create page + hooks + (optional) modal/delete dialog/filter toolbar.
3. Add the schema for any form to `src/lib/schemas.ts`.
4. Register route in `src/App.tsx`.
5. Add sidebar nav entry in `src/components/layout/nav-config.ts`.
6. Add MSW handlers in `src/mocks/handlers.ts`. URL search-param keys must
   match the parsers in `src/lib/url-state.ts` (page, pageSize, search,
   sortBy, sortOrder).
7. Add Vitest integration tests in `src/features/{feature}/__tests__/`.
8. If the feature is critical to the operator flow, extend `e2e/smoke.spec.ts`.
