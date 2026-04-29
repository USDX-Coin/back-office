# USDX Back Office

## Overview

Internal back office SPA for managing **OTC mint** and **redeem** operations on the USDX stablecoin, plus directory management for end-customers and internal staff. Operators submit single-shot OTC transactions that settle asynchronously on-chain; there is no approval workflow.

**Brand:** USDX | **Design system:** monochrome chrome (Linear-Console direction in `docs/design-explorations/02-linear-console.html`); shadcn/ui + Tailwind v4 tokens in `src/index.css`. CTAs are solid (no gradients); colors are reserved for status pills and token chips.

## Tech Stack

- **React 19** + **Vite 8** + **TypeScript 5.9** (strict mode)
- **TailwindCSS v4** — utility-first, configured via `@theme` in `src/index.css`
- **shadcn/ui** — accessible UI components (Radix UI primitives), including the Sidebar block
- **React Router v7** — SPA routing with `createBrowserRouter`
- **TanStack Query v5** — server state management
- **TanStack Table v8** — data table with server-side pagination/sorting/filtering, column resize, row select, column visibility
- **nuqs** — type-safe URL search-params state (table page/pageSize/sort/search; per-feature filters)
- **react-hook-form + zod** — form state + validation; schemas in `src/lib/schemas.ts`
- **react-day-picker** — calendar inside `<DateRangePicker>` (Popover with preset side panel)
- **MSW v2** — mock API in development (handlers in `src/mocks/`)
- **Recharts** — Dashboard volume trend chart (lazy-imported)
- **Sonner** — toasts via the shadcn `<Toaster />` wrapper
- **pnpm** — package manager
- **Vitest** — unit tests
- **Playwright** — E2E tests

## Menu Structure

Sidebar (defined in `src/components/layout/nav-config.ts`):

| Group | Item | Route | Purpose |
|-------|------|-------|---------|
| User | Internal | `/user/internal` | Internal team directory (StaffPage). Default landing route after login. |
| User | User Client | `/user/user-client` | End-customer directory (UsersPage). |
| OTC | Mint | `/otc/mint` | Single-shot mint submission + recent requests. |
| OTC | Redeem | `/otc/redeem` | Single-shot redeem + recent redemptions. |
| — | Report | `/report` | Filterable union of OTC transactions + CSV export. |

Other routes:

- `/dashboard` is reachable but **hidden from the sidebar**.
- `/profile` is reachable only via the navbar profile dropdown.
- Legacy paths `/users` and `/staff` redirect to `/user/user-client` and `/user/internal`.
- Mobile uses the shadcn Sidebar's built-in Sheet (toggled by `<SidebarTrigger>` in the navbar) — no separate BottomNav.

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
- **URL-driven table state via nuqs** — filters, pagination, sort persisted in URL search params; key names are part of the MSW contract (see `src/lib/url-state.ts`)
- **Forms via react-hook-form + zod** — schemas in `src/lib/schemas.ts`; render through shadcn `<Form>`
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

- All forms use **react-hook-form + zod**. Schemas live in `src/lib/schemas.ts`. Mount with `useForm({ resolver: zodResolver(schema), mode: 'onTouched' })`.
- `mode: 'onTouched'` matches the desired UX: validation runs on first blur and re-runs on change once the field is touched. Submit revalidates all.
- Render through shadcn `<Form>` + `<FormField>` so each field's `<FormMessage>` automatically surfaces `errors[field].message`.
- Modals use shadcn `Dialog`; guard `onEscapeKeyDown` and `onPointerDownOutside` while a mutation is in flight. Reset the form on open via `useEffect(() => form.reset(...), [open])`.
- Submit button shows spinner + "Submitting…" / "Saving…" / "Sending…" during mutation; the Cancel button is also disabled while pending.
- On success: modal closes, mutation invalidates list + dashboard queries, toast fires.
- On error: toast fires with the server's message (or a fallback); modal stays open with values preserved.

### Data Flow

```
Page → useQuery hook → fetch() → MSW handler (dev) / Real API (prod)
Page → useMutation hook → fetch() → MSW handler / Real API
  └→ onSuccess: invalidateQueries → refetch list + dashboard
```

### Color System

Tokens live in `src/index.css` under `@theme inline` and read from CSS variables on `:root` / `.dark`. The system uses standard shadcn/ui token names; **do not introduce custom names**. Brand teal is reserved for the small USDX brand mark and the `--primary` token; data colors (`--success`, `--warning`, `--destructive`) drive status pills.

| Token | Usage |
|-------|-------|
| `--primary` | Brand teal — primary CTA, active sidebar state, USDX logo background |
| `--success` | Completed / fulfilled / posted status pill (filled) |
| `--warning` | Pending status pill (filled) |
| `--destructive` | Failed / error / rejected status pill (filled), error text |
| `--background`, `--foreground` | Page surface and body text |
| `--card`, `--popover` | Card and floating-surface backgrounds |
| `--muted`, `--muted-foreground` | Subdued surfaces and secondary text |
| `--accent`, `--accent-foreground` | Hover and selected affordances |
| `--border`, `--input` | Hairlines and input outlines |
| `--sidebar*` | shadcn Sidebar block tokens |

CTAs are flat solid (no gradients). `<StatusPill>` defaults to filled appearance; pass `appearance="soft"` for tinted variants.

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
