# USDX Back Office

## Overview

Internal back office SPA for managing **OTC mint** and **redeem** operations on the USDX stablecoin, plus directory management for end-customers and internal staff. Operators submit single-shot OTC transactions that settle asynchronously on-chain; there is no approval workflow.

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

## Menu Structure

| Route | Menu label | Purpose |
|-------|-----------|---------|
| `/dashboard` | Dashboard | KPIs, volume trend chart, recent activity, network distribution |
| `/users` | User | End-customer directory (table + add/edit/delete modal) |
| `/staff` | Staf | Internal staff directory (table + invite modal) |
| `/otc/mint` | OTC → Mint | Single-shot mint submission form + recent requests |
| `/otc/redeem` | OTC → Redeem | Single-shot redeem submission form + recent redemptions |
| `/requests` | Requests | Phase-1 mint/burn request list with approval-lifecycle filters + detail modal |
| `/report` | Report | Full transaction table with filters + CSV export |
| `/profile` | *(navbar dropdown, not sidebar)* | Operator profile + personal details |

Mobile BottomNav: Dashboard / OTC / Report / More (drawer containing Requests / User / Staf / Profile).

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
│   │   └── DataTable.tsx  # Shared generic table with filter-toolbar slot
│   ├── features/
│   │   ├── auth/          # LoginPage only (Register/Forgot removed)
│   │   ├── dashboard/     # DashboardPage + hooks
│   │   ├── users/         # UsersPage + modal + hooks (Customer directory)
│   │   ├── staff/         # StaffPage + modal + hooks
│   │   ├── otc/
│   │   │   ├── mint/      # OtcMintPage + form + info panel
│   │   │   ├── redeem/    # OtcRedeemPage + form + table
│   │   │   └── hooks.ts   # Shared pending-settlement polling
│   │   ├── report/        # ReportPage + filter toolbar + CSV export
│   │   └── profile/       # ProfilePage
│   ├── lib/               # Shared utilities
│   │   ├── auth.tsx       # AuthProvider + useAuth hook
│   │   ├── types.ts       # Staff, Customer, OTC types, DashboardSnapshot
│   │   ├── validators.ts  # Pure form validators
│   │   ├── format.ts      # formatAmount, formatDate, formatShortDate, formatRelativeTime
│   │   ├── status.ts      # OTC status config + helpers
│   │   ├── csv.ts         # CSV export (with formula-injection guard)
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

### OTC Status Flow (single-shot)

```
operator submits form
      │
      ▼
  [ Pending ]  ──── on-chain failure ───▶ [ Failed ]  (terminal)
      │
      ▼  (network confirms, 8–15s)
 [ Completed ] (terminal)
```

No approval gate. No "Under Review". Settlement is async and simulated in mock mode via inline `setTimeout` inside the POST handler.

## Security

- CSP meta tag in `index.html` restricts script/style/font/connect sources
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
