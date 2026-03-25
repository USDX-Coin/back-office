# USDX Back Office

## Overview

Internal back office SPA for managing **minting** and **redeem** operations of the USDX stablecoin. Used by operators to review, approve/reject minting requests, monitor redeem requests, and view dashboard statistics.

**Brand:** USDX | **Primary Color:** `#1eaed5`

## Tech Stack

- **React 19** + **Vite 8** + **TypeScript 5.9** (strict mode)
- **TailwindCSS v4** — utility-first, configured via `@theme` in `src/index.css`
- **shadcn/ui** — accessible UI components (Radix UI primitives)
- **React Router v7** — SPA routing with `createBrowserRouter`
- **TanStack Query v5** — server state management
- **TanStack Table v8** — data table with server-side pagination/sorting/filtering
- **MSW v2** — mock API in development (handlers in `src/mocks/`)
- **pnpm** — package manager
- **Vitest** — unit tests
- **Playwright** — E2E tests

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
│   ├── index.css          # Tailwind directives + @theme tokens
│   ├── components/
│   │   ├── ui/            # shadcn/ui components (do not edit directly)
│   │   ├── layout/        # Navbar, Sidebar, MainLayout, AuthGuard
│   │   └── DataTable.tsx  # Shared generic table component
│   ├── features/
│   │   ├── auth/          # Login, Register, ForgotPassword pages
│   │   ├── dashboard/     # Dashboard page + hooks
│   │   ├── minting/       # Minting page, detail modal, hooks
│   │   └── redeem/        # Redeem page, detail modal, hooks
│   ├── lib/               # Shared utilities
│   │   ├── auth.tsx       # AuthProvider + useAuth hook
│   │   ├── types.ts       # TypeScript types (entities, API responses)
│   │   ├── validators.ts  # Form validation functions
│   │   ├── format.ts      # formatAmount, formatDate, formatShortDate
│   │   ├── status.ts      # Status config maps, canApprove/canReject
│   │   ├── csv.ts         # CSV export utilities
│   │   └── utils.ts       # cn() class name utility
│   ├── mocks/             # MSW mock API
│   │   ├── handlers.ts    # API endpoint handlers
│   │   ├── data.ts        # Mock data factories
│   │   ├── server.ts      # MSW node server (for tests)
│   │   └── browser.ts     # MSW browser worker (for dev)
│   └── test/              # Test setup + utilities
│       ├── setup.ts       # Vitest setup (cleanup, localStorage clear)
│       └── test-utils.tsx  # renderWithProviders helper
├── index.html
├── package.json
├── vite.config.ts         # Vite + Tailwind + Vitest config
├── tsconfig.json
├── tsconfig.app.json      # App TypeScript config (strict)
├── tsconfig.node.json     # Build tool TypeScript config
├── eslint.config.js       # ESLint flat config
├── playwright.config.ts   # Playwright config
└── components.json        # shadcn/ui config
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
- **TDD per feature** — write tests first, then implement

## Conventions

### Naming

- Components: PascalCase files + default export (`LoginPage.tsx` → `export default function LoginPage()`)
- Hooks: camelCase files (`hooks.ts` → `export function useMintingList()`)
- Utilities: camelCase files (`format.ts` → `export function formatAmount()`)
- Types: PascalCase interfaces/types (`MintingRequest`, `RedeemStatus`)
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

### Component Pattern

- Pages are default-exported function components
- Hooks co-locate with their feature in `hooks.ts`
- Modal components receive `open`, `onClose`, and data props
- Use shadcn/ui primitives — do not create custom low-level UI components
- Use `cn()` from `@/lib/utils` for conditional class names

### Data Flow

```
Page → useQuery hook → fetch() → MSW handler (dev) / Real API (prod)
Page → useMutation hook → fetch() → MSW handler / Real API
  └→ onSuccess: invalidateQueries → refetch list + dashboard
```

### Color System

| Token | Hex | Usage |
|-------|-----|-------|
| `primary` | `#1eaed5` | Buttons, links, accents |
| `primary-dark` | `#1899bc` | Hover states |
| `primary-light` | `#e8f7fb` | Badges, icon backgrounds |
| `dark` | `#1a1a2e` | Headings, text |
| `success` | `#10b981` | Approved, completed badges |
| `warning` | `#f59e0b` | Pending badges |
| `error` | `#ef4444` | Rejected, failed badges, error text |

### Status Flows

**Minting:**
```
Pending → Under Review → Approved → Processing → Completed
                       → Rejected (terminal)
                                    → Failed (terminal)
```

**Redeem (read-only):**
```
Pending → Processing → Completed
                     → Failed
```

## Security

- CSP meta tag in `index.html` restricts script/style/font/connect sources
- Security headers in `vite.config.ts`: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`
- Auth is mocked via localStorage — **not production-ready**
- All `target="_blank"` links should include `rel="noopener noreferrer"`
- No `dangerouslySetInnerHTML`, no `eval()`, no `innerHTML`

## Known Limitations (Mock Phase)

- Auth accepts any non-empty credentials (mock)
- No real API backend — all data served by MSW
- No RBAC / role-based access control
- No session expiration
- CSV export is client-side only (current page data)
- Registration is open (should be admin-only in production)

## Adding a New Feature

1. Create `src/features/{name}/` with page, hooks, and modal components
2. Add route in `src/App.tsx` under the protected routes
3. Add nav item in `src/components/layout/Sidebar.tsx`
4. Add MSW handlers in `src/mocks/handlers.ts`
5. Add mock data factory in `src/mocks/data.ts`
6. Write unit tests in `src/lib/__tests__/` for business logic
7. Write E2E test in `e2e/{name}.spec.ts`
