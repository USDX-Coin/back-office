# Features

Feature-based modules. Each feature is a self-contained unit with its own pages, modals, hooks, and types.

## Structure per Feature

```
feature-name/
  ├── FeaturePage.tsx          # Main page component (default export)
  ├── FeatureDetailModal.tsx   # Detail popup (if needed)
  └── hooks.ts                 # TanStack Query hooks for data fetching
```

## Conventions

- **Pages** are route-level components, default-exported
- **Hooks** use TanStack Query (`useQuery`, `useMutation`) with query keys namespaced by feature
- **Modals** receive `item`, `open`, `onClose` props — controlled by parent page
- Business logic (validation, formatting, status mapping) lives in `src/lib/`, NOT in feature files
- Each feature fetches its own data — no prop-drilling from parent layouts

## Features

| Feature | Pages | Auth Required | Description |
|---------|-------|---------------|-------------|
| `auth/` | Login, Register, ForgotPassword | No (PublicRoute) | Mock authentication flows |
| `dashboard/` | DashboardPage | Yes | Stats overview, status breakdown, recent activity |
| `minting/` | MintingPage + MintingDetailModal | Yes | List + approve/reject/review actions |
| `redeem/` | RedeemPage + RedeemDetailModal | Yes | List + read-only detail view |

## Adding a Feature

1. Create folder under `src/features/`
2. Create page + hooks + modal (if needed)
3. Register route in `src/App.tsx`
4. Add sidebar nav item in `src/components/layout/Sidebar.tsx`
5. Add MSW handlers in `src/mocks/handlers.ts`
