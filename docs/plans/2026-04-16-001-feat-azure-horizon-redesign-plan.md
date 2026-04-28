---
title: "feat: Azure Horizon Redesign — USDX Back Office"
type: feat
status: completed
date: 2026-04-16
origin: docs/brainstorms/2026-04-16-azure-horizon-redesign-requirements.md
---

# feat: Azure Horizon Redesign — USDX Back Office

## Overview

Big-bang re-skin and information-architecture overhaul of the USDX back office. Replaces the current 3-menu console (Dashboard / Minting / Redeem) with a 5-menu admin panel (Dashboard / User / Staf / OTC with Mint+Redeem sub-items / Report), adopts the Azure Horizon design system (teal-anchored palette, Manrope + Inter typography, no-line tables, bento grids), removes the approval workflow in favor of single-shot OTC transactions with async settlement, introduces directory management for end-customers and internal staff, and relocates Profile from a sidebar item to a navbar dropdown.

All eight blocking product questions (Q1–Q8) from the origin brainstorm were resolved during document review. The plan commits to big-bang cutover on `main` — no parallel routes, no feature flag.

## Problem Frame

Operators, admins, and compliance reviewers currently work in a console whose visual language does not meet the long-term product bar and whose workflow (queue + approve/reject minting requests) no longer matches how USDX operations run (OTC desks execute directly). This plan implements the redesigned surface captured in `docs/brainstorms/2026-04-16-azure-horizon-redesign-requirements.md`, which is the source of truth for page layouts, data shapes, and scope decisions.

## Requirements Trace

The origin document defines 74+ numbered requirements (R1–R74c). This plan maps them to implementation units below. High-level mapping:

- **Design System (R1–R6)** → Unit 1
- **Information Architecture + App Shell (R7–R12, R55, R74, R74b)** → Units 5, 6
- **Login (R13–R17)** → Unit 7
- **Dashboard (R18–R23)** → Unit 13
- **User Management (R24–R30)** → Unit 9
- **Staff Management (R31–R37)** → Unit 10
- **OTC Mint (R38–R42)** → Unit 11
- **OTC Redeem (R43–R48)** → Unit 12
- **Reporting (R49–R54)** → Unit 14
- **Profile (R55–R63)** → Unit 15
- **Auth/Session (R64–R67a)** → Unit 4
- **Cross-cutting UI patterns (R67b–R67g)** → Units 2, 8, 16
- **Migration & Cleanup (R68–R74c)** → Units 17, 18
- **Success Criteria (S1–S8)** → exercised by test scenarios across all units and the E2E smoke spec in Unit 18

(see origin: `docs/brainstorms/2026-04-16-azure-horizon-redesign-requirements.md`)

## Scope Boundaries

Carried forward verbatim from origin `Scope Boundaries`:

**Feature scope (not built in v1):**
- RBAC enforcement, cross-page deep-links from Dashboard, advanced Report filter drawer, Profile secondary tabs, Notifications bell dropdown content, PDF export, password-reset UI, MFA, "Update Status" button, Pending Invite lifecycle, last-Super-Admin guard, Treasury reserve card, wallet-confirmation modal.

**Delivery scope (deferred to v2 / production):**
- Real email delivery, production auth (OIDC/SAML/JWT), session expiration, audit log, PII-redaction on CSV, multi-language.

**Planning decisions inside this plan (resolved below in Key Technical Decisions):**
- Chart library, phone input, icon strategy, async settlement simulation mechanism, folder layout, avatar strategy.

## Context & Research

### Relevant Code and Patterns

- **Existing `DataTable`** at `src/components/DataTable.tsx` — TanStack Table v8 wrapper, reads URL params (`page`, `search`, `status`, `sortBy`, `sortOrder`, `startDate`, `endDate`) via `useSearchParams`, has hard-coded filter toolbar (search box + status select + date range). Plan extends this with an arbitrary filter-toolbar slot while preserving URL-state semantics. Empty state and loading skeleton already built in.
- **MSW handler conventions** in `src/mocks/handlers.ts` + `src/mocks/data.ts` — MSW v2 API (`http.get`, `HttpResponse.json`), module-scoped `let` stores with `resetMockData()` helper, `paginate()` + `filterItems()` helpers, response shape `{ data: T[], meta: { page, pageSize, total, totalPages } }`. Response contract documented in `src/mocks/CLAUDE.md`.
- **Feature hook pattern** in `src/features/{dashboard,minting,redeem}/hooks.ts` — TanStack Query `useQuery` / `useMutation` wrappers with explicit query keys, `invalidateQueries` on mutation success.
- **Sonner toaster** already wired in `src/App.tsx` via `<Toaster />`; `sonner` package installed. Plan standardizes on top-right position, 5s success/info, 8s error.
- **Auth context** at `src/lib/auth.tsx` — currently enforces hard-coded `DEMO_USER.email` + `DEMO_PASSWORD` and exposes `register` + `forgotPassword` methods. Plan relaxes login to accept any non-empty credentials (per R64) and removes the two methods (no consumers after R17/R70).
- **shadcn/ui primitives present**: `badge`, `button`, `card`, `dialog`, `dropdown-menu`, `input`, `label`, `select`, `separator`, `sheet`, `skeleton`, `sonner`, `table`, `textarea`. Missing and added by Unit 1: `checkbox`, `radio-group`, `tooltip`, `switch`, `avatar` (or custom).
- **Vitest setup** at `src/test/setup.ts` + `src/test/test-utils.tsx` — `renderWithProviders` wraps with `QueryClientProvider`, `MemoryRouter`, `AuthProvider`. MSW node server at `src/mocks/server.ts` is set up in `setup.ts` via `beforeAll`/`afterEach`/`afterAll`.
- **Playwright config** at `playwright.config.ts` — specs in `e2e/*.spec.ts`, uses live dev server with MSW browser worker.
- **CSP meta tag** in `index.html` already allows `fonts.googleapis.com` (style-src) and `fonts.gstatic.com` (font-src) — no amendment needed for Manrope. No `unsafe-eval` / `unsafe-inline` script relaxation is acceptable.
- **Root `CLAUDE.md`** — authoritative on naming conventions (components PascalCase default export, hooks camelCase, tests in `__tests__/`), test convention (describe → positive/negative/edge-cases), feature-based organization.

### Institutional Learnings

- `docs/solutions/` does not exist in this repo. No prior institutional learnings to carry forward.

### External References

- External research skipped — codebase has strong local patterns for React/Vite + shadcn + TanStack Query + MSW, and the user's direction is clear.
- Azure Horizon design spec: `back-office-usdx/azure_horizon/DESIGN.md` (repo-local).
- Reference HTML + screenshots: `back-office-usdx/{back_office_login, my_profile, otc_mint, otc_redeem, reporting_dashboard, staf_management, user_management}/` (repo-local).

## Key Technical Decisions

- **Chart library: Recharts, pinned to `^2.15.0` (first release with verified React 19 peer-dep support).** Rationale: most-used React chart lib, tree-shakable, composable, accepts arbitrary color tokens. Imported via `React.lazy(() => import(...))` from `VolumeTrendChart.tsx` with a `<Skeleton />` Suspense fallback so the ~70KB payload stays out of the initial Dashboard bundle. Pre-verify in Unit 13 by running `pnpm add recharts@^2.15.0` on a scratch branch and confirming no peer warnings. If peer resolution fails, fallback is Visx (`@visx/shape` + `@visx/scale`, ~40KB for a single LineChart).
- **Phone input: plain text field with visible `+1` / international-prefix label and regex validation in `src/lib/validators.ts`.** Rationale: avoids a 30–40KB dependency for a field used in two modals.
- **Icon strategy: stay on `lucide-react`.** Rationale: already installed, avoids Material Symbols web font (~100KB + CSP reevaluation), consistent with existing codebase. Reference designs use Material Symbols *names* (e.g., `toll`, `groups`, `generating_tokens`); implementation maps to nearest lucide equivalents (`Coins`, `Users`, `Wallet`). Visual drift is acceptable — the palette + typography + layout carry the Azure Horizon identity, not the icon set. Unit 1 must verify the pinned `lucide-react` version contains every icon referenced across Units 5, 11, 12, 13, 15 before proceeding; bump the pin if any icon is missing.
- **Async settlement simulation (inline, no separate module):** the `POST /api/otc/{mint,redeem}` handlers each schedule a `setTimeout(Math.random() * 7000 + 8000)` directly inside the handler body, push the timer id into a module-level `Set<ReturnType<typeof setTimeout>>` that lives in `handlers.ts` alongside the stores, and `resetMockData()` clears the set. Handler exposes a test hook `flushSettlement(txId, outcome?)` that synchronously applies the terminal state — tests never wait on real timers. On Vite HMR dispose, all pending timers are cleared via `import.meta.hot?.dispose(() => pendingTimers.forEach(clearTimeout))`. The timer callback is wrapped in `try/catch` with `console.warn` on failure (orphan-row, store-reset-race, etc.). **Do not create a separate `settlementSimulator.ts` module** — the inline approach is simpler and colocates the timer state with the stores it mutates.
- **UI polling cadence: 5s, not 3s.** The Recent Requests query uses `refetchInterval: 5000` while any row is `pending`, auto-disabling when no pending rows remain. With settlements in the 8–15s window, 5s polling produces 2–3 request spans per settlement (vs 3–5 at 3s), still keeping median settlement-to-toast latency under 3s.
- **Settlement toast deduplication:** `useRecentMints` / `useRecentRedeems` track already-toasted terminal IDs in a `useRef<Set<string>>` initialized empty. On each query success callback, any row whose status is terminal and whose id is not in the set fires a toast and is added. This survives re-renders but resets on unmount (safe — a terminal row that completes while the user navigates away doesn't need to toast on return).
- **Folder layout for new features:** `src/features/users/`, `src/features/staff/`, `src/features/otc/mint/`, `src/features/otc/redeem/`, `src/features/report/`, `src/features/profile/`, `src/features/dashboard/`, `src/features/auth/`. Each feature owns a page, a `hooks.ts`, and optional form/modal components. Shared logic lives in `src/lib/`; shared UI components in `src/components/`.
- **Shared components:** `CustomerTypeahead` lives at `src/components/CustomerTypeahead.tsx` (not feature-local) because three pages consume it (OTC Mint, OTC Redeem, Report). Created in Unit 9 when the customer query infrastructure first exists. Similarly, `usePendingSettlementPolling` and the toast-dedup ref pattern live at `src/features/otc/hooks.ts` shared by Mint and Redeem.
- **Avatar strategy: initials + fixed 8-color palette** indexed by `name.charCodeAt(0) % 8`. No hash-to-hue tuning. Palette is drawn from Azure Horizon tokens (teals, tertiaries, secondaries) for tonal consistency. Deterministic per name (same name → same color), simple, zero tuning. Shared across User table, Staff table, Report, Profile, navbar dropdown.
- **CSV export: reuse `src/lib/csv.ts` with a CSV-injection guard added in Unit 14.** The existing `escapeCsvCell` prepends a single leading `'` (apostrophe) or tab to any cell whose first character is `=`, `+`, `-`, or `@`. This prevents formula injection in Excel/LibreOffice for free-text fields (Notes, customer names).
- **Relative timestamps ("2h ago", "yesterday"): small helper in `src/lib/format.ts`** — no `date-fns` or `dayjs` dependency.
- **Status enum narrowed to `pending | completed | failed`** in both UI and data model (per Q2). `src/lib/status.ts` is rewritten to map only these three.
- **Report filter semantics: by Customer.** Transactions carry `customerId` + `customerName` snapshot (per Q3, R67g). Operator attribution (`operatorStaffId`, `operatorName`) is stored on the record but is not a filter axis in v1.
- **Type rename strategy: no `type User = Staff` alias.** The rename happens in Unit 2 in a single pass — every consumer of the old `User` type is updated in the same commit (grep `User` across `src/`, rewrite to `Staff` where it means logged-in identity, leave alone where it's a local variable name). This eliminates the collision risk where `src/features/users/` folder implies Customer but the alias would resolve to Staff.
- **`DashboardStats` → `DashboardSnapshot` rename.** The old shape had `minting`/`redeem` fields; the new shape has OTC-based aggregates. Renaming the type prevents accidental inheritance during Unit 13's rewrite — any stale import of `DashboardStats.minting` fails type-check immediately instead of silently compiling against the old shape until Unit 17 strips it.

## Open Questions

### Resolved During Planning

- **Chart lib / Phone input / Icon strategy / Settlement simulation / Folder layout / Avatar strategy** — resolved in Key Technical Decisions above.
- **Where does the OTC splash route (`/otc`) redirect when not on mobile?** → Nowhere. The desktop sidebar generates direct links to `/otc/mint` and `/otc/redeem`, never to `/otc`. The `/otc` route exists only as a BottomNav landing and has no viewport-aware redirect logic (removing the `window.innerWidth` check eliminates the paint-flash and resize-across-breakpoint bugs). If a desktop user types `/otc` directly, rendering the splash is a valid fallback.
- **Does "Select User" on OTC Mint pre-fill the destination wallet?** → No. Customers in v1 do not carry a "preferred wallet" field; operator enters destination address manually each time. Addable as a v2 convenience.
- **Does the Login hero artwork asset require licensing resolution inside this plan?** → No — pre-merge task flagged in origin doc and surfaced in Operational Notes. **v1 ships with the gradient-only variant by default.** The reference artwork lands in a v1.1 follow-up once licensing clears. This is honest scope: S1's visual-fidelity audit for the login page is scoped to "palette + typography + form layout" and explicitly excludes hero artwork in v1.
- **Notifications bell count source?** → Static mock value (hardcoded `3`). No `/api/notifications/count` endpoint. Count does not update during the session. Rationale: bell is cosmetic per R67d; an endpoint adds handler surface for zero UX gain.
- **Session version migration — silent logout or migrate?** → Migrate. AuthProvider init reads localStorage; if shape has `email` but no `version` field, look up the Staff by email in the mock store, rewrite as v2, continue authenticated. Only if migration fails (email has no Staff match after seed) does the provider render unauthenticated. Eliminates the "everyone logs out on deploy" edge case.

### Deferred to Implementation

- Exact Recharts component choices (`LineChart` vs `AreaChart`, stacked vs overlay) for the Volume Trend chart — choose during Unit 13 once real-looking mock data is in place and responsive sizing behavior is visible.
- Exact copy strings for toast messages and empty states — write during the unit that renders them; keep copy honest ("Invitation sent to `<email>`", "No transactions yet", not marketing voice).
- Exact shape of the `AvatarPalette` hash → hue mapping (HSL ring, number of slots) — tune during Unit 16 for visual variety.
- Whether the Notifications bell badge count is a static mock value or reads from a trivial `/api/notifications/count` endpoint — decide during Unit 5.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

### Data model (conceptual)

```
Customer
  id, firstName, lastName, email, phone, type: 'personal'|'organization',
  organization?: string, role: 'admin'|'editor'|'member', createdAt

Staff
  id, firstName, lastName, email, phone,
  role: 'support'|'operations'|'compliance'|'super_admin',
  createdAt

OtcMintTransaction
  id, txHash (truncated display), customerId, customerName (snapshot),
  operatorStaffId, operatorName (snapshot),
  network, amount, destinationAddress, notes,
  status: 'pending'|'completed'|'failed', createdAt, settledAt?

OtcRedeemTransaction
  id, txHash, customerId, customerName (snapshot),
  operatorStaffId, operatorName (snapshot),
  network, amount,
  status: 'pending'|'completed'|'failed', createdAt, settledAt?
```

Dashboard KPIs, Network Distribution, Recent Activity, Report rows, and Profile Recent Activity Summary are all **derived views** over these four tables — no separate aggregate storage.

### API surface (MSW, REST-style)

```
GET    /api/customers                   list (page, search, type, role)
POST   /api/customers                   create
PATCH  /api/customers/:id               update
DELETE /api/customers/:id               delete

GET    /api/staff                       list (page, search, role)
POST   /api/staff                       create (triggers "invite sent" toast)
PATCH  /api/staff/:id                   update
DELETE /api/staff/:id                   delete

GET    /api/otc/mint                    list (page, filters)
POST   /api/otc/mint                    create (async settlement starts)
GET    /api/otc/redeem                  list
POST   /api/otc/redeem                  create

GET    /api/dashboard                   derived KPIs + trend + recent + distribution
GET    /api/report                      union of OTC mint+redeem with filters
GET    /api/profile                     current staff + recent activity
PATCH  /api/profile                     update current staff
```

All list endpoints return `{ data, meta: { page, pageSize, total, totalPages } }` per existing `src/mocks/CLAUDE.md` contract. All mutation endpoints return the created/updated entity. Errors return `{ error: { code, message } }`.

### Settlement simulator flow

```
operator submits form
  └─ POST /api/otc/mint (MSW handler)
       ├─ inserts row with status: 'pending'
       ├─ schedules setTimeout(8–15s random)
       │     └─ random outcome: 90% completed, 10% failed
       │     └─ mutate row status in-place, set settledAt
       └─ returns 200 with the pending row

UI (OTC Mint page, Recent Requests):
  └─ useQuery('otc/mint/recent')
       └─ refetchInterval: 3000 while any row is pending, disabled otherwise
       └─ row with status 'pending' renders pulsing dot
       └─ on poll tick that shows a terminal status, fire settlement toast
```

In tests, `vi.useFakeTimers()` advances the clock; settlement is deterministic via handler-level fixture injection (no real `setTimeout` wait).

### Plan structure — unit dependency graph

```
Phase 1: Foundation
  Unit 1 (theme+fonts)  ─┐
  Unit 2 (types)         ├─┐
  Unit 3 (mocks)         ┘ │
  Unit 4 (auth) ───────────┤
Phase 2: App Shell         │
  Unit 5 (layout) ─────────┤
  Unit 6 (bottom nav) ─────┤
  Unit 7 (login) ──────────┤
  Unit 8 (DataTable slot) ─┤
Phase 3: Directory         │
  Unit 9 (Users) ──────────┤
  Unit 10 (Staff) ─────────┤
Phase 4: OTC               │
  Unit 11 (Mint) ──────────┤
  Unit 12 (Redeem) ────────┤
Phase 5: Insights          │
  Unit 13 (Dashboard) ─────┤
  Unit 14 (Report) ────────┤
Phase 6: Profile+Patterns  │
  Unit 15 (Profile) ───────┤
  Unit 16 (UI patterns) ───┤
Phase 7: Cleanup           │
  Unit 17 (delete old) ────┤
  Unit 18 (tests+docs) ────┘
```

Units within a phase are parallelizable except where explicitly noted.

---

## Phased Delivery

Seven phases. Each phase ends in a green state (type-check + unit tests + lint all pass); the big-bang property is that no phase ships standalone to users — the cutover is the complete set of phases landing together (all units on a single branch, one PR). Phase ordering optimizes for dependency resolution and reviewable diffs.

### Phase 1 — Foundation

Establishes design tokens, types, mocks, and auth. Nothing user-visible changes yet; the old screens continue to compile against a renamed-but-compatible type surface until Phase 7 deletes them.

### Phase 2 — App Shell

Layout chrome: sidebar, navbar, profile dropdown, bottom nav, login page, DataTable extension.

### Phase 3 — Directory Management

User and Staff pages (the two symmetric CRUD tables).

### Phase 4 — OTC Operations

Mint and Redeem single-shot forms with async settlement.

### Phase 5 — Insights

Dashboard (redesigned) and Report (new).

### Phase 6 — Profile + Cross-Cutting Patterns

Profile page redesign + standardized toast/empty-state/error-state/accessibility utilities.

### Phase 7 — Migration & Cleanup

Delete obsolete code, rewrite tests, update docs, add E2E smoke, final green.

---

## Implementation Units

### Phase 1 — Foundation

- [ ] **Unit 1: Azure Horizon theme tokens + fonts + missing shadcn primitives + shared UI primitives**

**Goal:** Replace the current `@theme` block with Azure Horizon tokens, load Manrope, add missing shadcn components, and create the small shared UI primitives (`Avatar`, `FieldError`, `TableEmptyState`) that every feature unit will consume from day one. Consolidating these in Unit 1 — not retrofitting them in a later Unit 16 — prevents the ad-hoc-then-refactor pattern the review flagged.

**Requirements:** R1, R2, R3, R5, R6, R67b (FieldError), R67c (TableEmptyState), R72, R74b.

**Dependencies:** None.

**Files:**
- Modify: `src/index.css` (replace `@theme` block with Azure Horizon palette + font tokens + ghost-border CSS variables)
- Modify: `index.html` (add Manrope to Google Fonts `<link>` alongside Inter; verify CSP unchanged per R74b — no new sources added)
- Modify: `package.json` (verify pinned `lucide-react` version contains every referenced icon — bump if needed)
- Create: `src/components/ui/checkbox.tsx`, `src/components/ui/radio-group.tsx`, `src/components/ui/tooltip.tsx`, `src/components/ui/switch.tsx` (generated via `npx shadcn add`, not hand-rolled)
- Create: `src/components/Avatar.tsx` (initials + fixed 8-color palette indexed by `name.charCodeAt(0) % 8`)
- Create: `src/components/FieldError.tsx` (renders `<p role="alert" className="text-error text-sm mt-1">{message}</p>` when `message` is non-empty; null otherwise)
- Create: `src/components/TableEmptyState.tsx` (accepts `mode: 'no-data' | 'no-results'`, `icon`, `title`, `description`, `cta?`)
- Test: `src/components/__tests__/Avatar.test.tsx`
- Test: `src/components/__tests__/FieldError.test.tsx`
- Test: `src/components/__tests__/TableEmptyState.test.tsx`
- Test: `src/__tests__/theme.test.tsx` (new — asserts theme tokens actually override)

**Approach:**
- Use CSS custom properties for Azure Horizon palette; primary becomes `#006780`, `primary-container` holds `#1eaed5` (retired brand cyan now used for gradient accent).
- Define a "blue-pulse" gradient utility class in `@layer utilities` and `animate-pulse-dot` keyframes for pending status indicators.
- Ghost borders implemented via a CSS custom property `--color-ghost-border: color-mix(in srgb, var(--color-outline-variant) 15%, transparent)`.
- Manrope loaded via existing Google Fonts `<link>` tag; only the `family=` query is extended. No CSP change.
- Avatar: `AVATAR_PALETTE = [<8 Azure Horizon hex codes>]`; color = `AVATAR_PALETTE[name.charCodeAt(0) % 8]`. Edge cases — empty name → "?" on neutral `surface-container-high` background; single-word name → first char only; non-ASCII name → `charCodeAt(0)` handles code unit safely. Max input length capped at 100 chars (defensive — initials use only the first+last word anyway).
- Theme verification test: render a test element with `className="bg-primary"`, call `getComputedStyle`, assert `--color-primary: #006780`; also assert the OLD primary (`#1eaed5`) is NOT in `--color-primary` (regression guard).

**Patterns to follow:**
- Tailwind v4 `@theme` block (already present in `src/index.css`).
- Existing shadcn component structure in `src/components/ui/` (Radix-backed, default export).

**Test scenarios:**
- Happy path: render Avatar with name "John Smith" → shows "JS" initials, deterministic background hue.
- Happy path: render Avatar with single name "Madonna" → shows "M" initial, deterministic hue.
- Edge case: empty string name → shows "?" fallback with neutral background.
- Edge case: same name rendered twice produces identical hue (hash determinism).
- Edge case: names with non-ASCII characters ("Zoë Ångström") — initials extract correctly.

**Verification:**
- `pnpm dev` renders the app without console errors.
- `pnpm build` passes type-check.
- Random component imports `var(--color-primary)` and renders the new teal (visual check).
- Avatar tests pass.

- [ ] **Unit 2: Type system refactor — Customer + Staff + OTC transaction types + root CLAUDE.md update**

**Goal:** Rename `User` → `Staff` (logged-in identity) **as a full one-pass rename with no temporary alias**, add `Customer` (end-customer), rename old `DashboardStats` → `DashboardSnapshot`, define `OtcMintTransaction` and `OtcRedeemTransaction` + narrowed `OtcStatus` enum, update CSV-injection guard, update validators, add relative-time helper. Also update root `CLAUDE.md` status-flow diagram and menu list immediately so implementers reading it during Phases 2–6 see the new world, not the old approval workflow.

**Requirements:** R67g, Glossary, R71, Key Decision "status enum narrowed", Key Decision "no `User = Staff` alias".

**Dependencies:** None.

**Files:**
- Modify: `src/lib/types.ts` (rename `User` → `Staff`, remove old `MintingStatus`/`RedeemStatus`/`MintingRequest`/`RedeemRequest` that don't have current readers — scoped by grep; add `Customer`, `OtcStatus`, `OtcMintTransaction`, `OtcRedeemTransaction`, `DashboardSnapshot`; keep `PaginatedResponse<T>`, `ApiError`)
- Modify: every stray consumer of the old `User` type — grep `\\bUser\\b` under `src/` and update in the same commit. Known consumers: `src/lib/auth.tsx`, `src/components/layout/Navbar.tsx`, `src/test/test-utils.tsx`. No `type User = Staff` alias is added.
- Modify: `src/lib/status.ts` (drop `canApprove`, `canReject`, `canStartReview`, `isTerminalStatus`, old `MintingStatus`/`RedeemStatus` helpers; rewrite `getStatusConfig` to map only `pending | completed | failed`; keep helpers used by remaining code until their Units delete them)
- Modify: `src/lib/validators.ts` (remove `validateRegisterForm`, `validateForgotPasswordForm`; add `validateCustomerForm`, `validateStaffForm`, `validateOtcMintForm`, `validateOtcRedeemForm`, `validatePhone`, `validateWalletAddress`)
- Modify: `src/lib/format.ts` (add `formatRelativeTime` helper)
- Modify: `src/lib/csv.ts` (extend `escapeCsvCell` to prefix cells starting with `=`, `+`, `-`, or `@` with a leading single quote — CSV-injection guard)
- Modify: `CLAUDE.md` (root — rewrite menu list: Dashboard/User/Staf/OTC/Report; rewrite Status Flows section to `pending → completed | failed` for OTC; update "Known Limitations" to reflect new v1 risks; update "Adding a New Feature" to point at the new feature folders)
- Test: `src/lib/__tests__/status.test.ts` (rewrite — only 3 statuses)
- Test: `src/lib/__tests__/validators.test.ts` (rewrite — cover new validators, drop removed ones, include max-length bound on name fields)
- Test: `src/lib/__tests__/format.test.ts` (add `formatRelativeTime` scenarios)
- Test: `src/lib/__tests__/csv.test.ts` (extend — injection scenarios: `=HYPERLINK(...)`, `+cmd`, `-LEAD(1)`, `@command` all get prefix; benign cells unchanged)

**Approach:**
- New TS unions: `OtcStatus = 'pending' | 'completed' | 'failed'`, `CustomerType = 'personal' | 'organization'`, `CustomerRole = 'admin' | 'editor' | 'member'`, `StaffRole = 'support' | 'operations' | 'compliance' | 'super_admin'`, `Network = 'ethereum' | 'polygon' | 'arbitrum' | 'solana' | 'base'`.
- Wallet address validator: regex + EIP-55 checksum for EVM networks; Solana base58 length check. Returns `{valid, error?}` — matching existing validator shape.
- Phone validator: `/^\+?[0-9]{10,15}$/`.
- Relative-time formatter: uses `Date.now()` — returns "just now" / "5m ago" / "2h ago" / "yesterday" / "3d ago" / "Oct 24" / "Oct 24, 2025" based on delta.

**Execution note:** Test-first. Write the new validator + status + format test cases first, then implement. The existing file patterns in `src/lib/__tests__/` already follow `describe('funcName') → describe('positive/negative/edge cases')` per root `CLAUDE.md`; mirror that.

**Patterns to follow:**
- Existing `src/lib/validators.ts` pattern: pure functions returning `{valid: boolean, errors: Record<string, string>}`.
- Existing `src/lib/status.ts` shape: `getStatusConfig(status): {label, color, icon}`.
- Existing `src/lib/format.ts` pattern: pure named exports with typed signatures.

**Test scenarios:**
- **`getStatusConfig`:** Happy path — `pending` returns amber-coded config, `completed` returns green, `failed` returns red. Edge case — unknown string returns a defensive neutral config (not throw).
- **`validatePhone`:** Happy path — `"+14155551234"` valid, `"14155551234"` valid. Negative — `""` invalid, `"555-1234"` invalid (contains dash). Edge — exactly 10 digits valid, 9 invalid, 15 valid, 16 invalid.
- **`validateWalletAddress`:** Happy path — `0x`-prefixed 40 hex chars with valid EIP-55 checksum for `ethereum/polygon/arbitrum/base` passes. Negative — `0x` too short, lowercase-only (no checksum), non-hex. Solana happy — base58 32–44 chars. Solana negative — too short, invalid base58 char.
- **`validateCustomerForm`:** Happy — all required + organization present when type=organization. Negative — missing firstName, invalid email, phone fails, type=organization but organization empty. Edge — type=personal with organization field filled still valid (org ignored).
- **`validateStaffForm`:** Happy — all required + role set. Negative — missing email.
- **`validateOtcMintForm`:** Happy — valid customerId + network + amount > 0 + valid address. Negative — amount 0, address fails checksum.
- **`validateOtcRedeemForm`:** Happy — amount > 0 and ≤ available balance. Negative — amount > balance (boundary check).
- **`formatRelativeTime`:** Happy — 30s ago → "just now"; 5min ago → "5m ago"; 2h ago → "2h ago"; yesterday → "yesterday"; 3d ago → "3d ago"; same year older → "Oct 24"; prior year → "Oct 24, 2025". Edge — future timestamps (0 delta) handled gracefully.

**Verification:**
- `pnpm test src/lib/` all pass.
- Type-check passes across any `User`→`Staff` rename consumers (temporary: leave the old `User` type as `type User = Staff` re-export so other files still compile until Phase 7 removes it; verify no circular collision with the new `Customer` export).

- [ ] **Unit 3: MSW handlers + mock data factories for Customer + Staff + OTC (inline settlement)**

**Goal:** Regenerate `src/mocks/handlers.ts` and `src/mocks/data.ts` to model four domain stores (customers, staff, otcMint, otcRedeem) plus derived `/api/dashboard`, `/api/report`, `/api/profile`. Settlement simulation is **inline inside the POST handlers** — no separate module.

**Requirements:** R30, R41, R47, R19, R49–R54, R61.

**Dependencies:** Unit 2 (types).

**Files:**
- Modify: `src/mocks/handlers.ts` (complete rewrite — keep `paginate` helper, replace `filterItems`, add new resource routes; **keep the old minting/redeem handlers temporarily** so old pages still compile until Phase 7; add module-level `pendingTimers: Set<ReturnType<typeof setTimeout>>`, inline settlement in POST handlers, add `flushSettlement(txId, outcome?)` test hook)
- Modify: `src/mocks/data.ts` (add `createCustomer`, `createStaff`, `createOtcMintTransaction`, `createOtcRedeemTransaction`, `createMockCustomerList`, `createMockStaffList`, `createMockOtcTransactions` — keep old factories until Phase 7)
- Modify: `src/mocks/CLAUDE.md` (update API contract table)
- Test: `src/mocks/__tests__/handlers.test.ts` (integration — verifies endpoint contracts, settlement behavior via `flushSettlement`, and `resetMockData()` clears pending timers)

**Approach:**
- Mock data seeds: 30 customers (mix personal/organization), 8 staff (one per role + a few duplicates, one seeded as `demo@usdx.io` to match the smoke spec), 120 OTC mint + 80 OTC redeem transactions spanning last 60 days with distribution across networks and statuses.
- `createCustomer({overrides})`, `createStaff({overrides})` — factory pattern with sensible defaults.
- `POST /api/otc/mint` inline: insert pending row → return 200 → schedule `setTimeout(Math.random() * 7000 + 8000)` with the callback wrapped in `try { ... } catch (err) { console.warn('[msw] settlement failed', err) }`. The timer id is pushed into `pendingTimers`. Callback body: look up row, bail if not found (row was deleted), apply 90/10 completed/failed split, mutate row in place, remove timer from set.
- `flushSettlement(txId, outcome?)` test hook: finds the pending timer for the given txId, `clearTimeout`s it, and applies the terminal outcome synchronously. Tests use this instead of `vi.useFakeTimers()` — deterministic, no interaction with MSW's internal scheduler.
- HMR safety: `import.meta.hot?.dispose(() => pendingTimers.forEach(clearTimeout))` at the bottom of `handlers.ts` clears orphan timers on module replacement.
- Derived `/api/dashboard`: compute KPIs (30d volumes, active users, pending count), 30d trend series, last 8 activity rows, network distribution — all from in-memory OTC stores + customer store. Returns `DashboardSnapshot` shape.
- Derived `/api/report`: union of mint + redeem with date-range + type + customerId + status + search filters; response shape matches `PaginatedResponse<ReportRow>`.
- Derived `/api/profile`: returns the current "logged-in" staff (resolved by staffId from AuthContext) + their last 3 activities.
- `resetMockData()` behavior: factory lists are recreated AND `pendingTimers.forEach(clearTimeout); pendingTimers.clear()`.

**Patterns to follow:**
- Existing `handlers.ts` — `http.get` / `http.post` / `HttpResponse.json`, URL parsing via `new URL(request.url)`.
- Existing `data.ts` factory override pattern.
- `src/mocks/CLAUDE.md` — response envelope format.

**Test scenarios:**
- **Settlement (via `flushSettlement`):** Happy — `POST /api/otc/mint` → row status `pending` → `flushSettlement(txId, 'completed')` → `GET` shows `completed`. Happy — same flow with `'failed'` → row shows `failed`. Edge — `flushSettlement(nonExistentId)` is a no-op, does not throw. Edge — `resetMockData()` mid-schedule cancels pending timers, subsequent `flushSettlement` for the cleared id is a no-op. Error — handler callback errors are caught and `console.warn`-ed (assert via spy).
- **Handlers (integration):** Happy — `GET /api/customers` returns paginated list matching mock data size. Happy — `POST /api/customers` with valid body inserts and returns the new row; `GET /api/customers` then shows count+1. Filter — `GET /api/customers?type=organization` returns only org rows. Filter — `GET /api/report?type=mint&status=failed&startDate=2026-03-01` returns only matching subset. Error — `POST /api/customers` with missing email returns 400 `{error:{code:'VALIDATION', message}}`. Error — `DELETE /api/customers/unknown-id` returns 404. Error — `PATCH /api/staff/:id` with body touching `id` field is ignored silently (id is immutable).
- **Dashboard derivation:** Happy — after seeding 2 pending + 3 completed OTC mint rows, `GET /api/dashboard` returns `pendingTransactions: 2` and volume KPI matches sum of completed amounts.
- **Report derivation:** Happy — `GET /api/report?customerId=<x>` returns only transactions referencing that customer (verifies snapshot + foreign-key consistency).
- **HMR safety:** Unit-test — simulate module dispose: call `pendingTimers.forEach(clearTimeout)` and verify `pendingTimers.size === 0` after; no settlement fires afterward.

**Verification:**
- `pnpm test src/mocks/` passes.
- `pnpm dev` loads without 404s on any of the new endpoints.

- [ ] **Unit 4: AuthContext cleanup + login relaxation + session migration**

**Goal:** Remove `register` and `forgotPassword` from the AuthContext surface, relax `login` to accept any non-empty credentials (per R64), update the mock session to return a `Staff` shape with a versioned localStorage payload, write a one-shot v1→v2 migration so no currently-logged-in operator gets silently booted on deploy.

**Requirements:** R64, R65, R66, R67a, R70.

**Dependencies:** Unit 2 (types), Unit 3 (`/api/staff` endpoint for email lookup).

**Files:**
- Modify: `src/lib/auth.tsx` (shrink `AuthContextType`; remove `DEMO_PASSWORD` gate; versioned session; v1→v2 migration)
- Modify: `src/test/test-utils.tsx` (update seeded `authenticated: true` wrapper to write the v2 shape so tests across Units 7–15 don't regress)
- Test: `src/lib/__tests__/auth.test.tsx` (rewrite)

**Approach:**
- `AuthContextType = { user: Staff | null, isAuthenticated: boolean, login(email, password): Promise<void>, logout(): void }`.
- `login` validates non-empty email + password, resolves the "current staff" by in-memory lookup against the mock Staff store (shared import from `src/mocks/data.ts` — no HTTP call inside AuthProvider to avoid ordering against MSW init), falls back to a seeded default Staff if no match.
- Persisted session shape: `{ version: 2, staffId: string }`.
- **v1 → v2 migration on provider init:** if localStorage payload lacks `version` and has `email`, look up Staff by email in the mock store, persist as v2, set `user` state. If lookup fails, clear localStorage and render unauthenticated + fire an info toast ("You've been signed out to apply an update. Please sign in again."). This ensures no silent-logout surprises for existing dev sessions.
- Logout clears `localStorage` and navigates to `/login`.

**Execution note:** Test-first. Write the new auth tests first (current tests reference `register`/`forgotPassword` directly and will fail on missing methods — that's the red signal). Then rewrite `auth.tsx`.

**Patterns to follow:**
- Existing `src/lib/auth.tsx` structure: Context + Provider + hook + `localStorage` persistence.

**Test scenarios:**
- Happy — `login("any@email.com", "anything")` resolves, `user` is a `Staff`, `isAuthenticated` true, localStorage has `{version:2, staffId}`.
- Happy — `logout()` clears localStorage and sets `user` to null.
- Negative — `login("", "x")` rejects with validation error; context `user` stays null.
- Negative — `login("only-email", "")` rejects; `user` stays null.
- Happy migration — provider initialized with v1 localStorage payload `{id, name, email, role}` whose email matches a seeded Staff → rewrites payload to v2 shape + sets `user` → isAuthenticated true (no logout).
- Edge migration — v1 payload with email that has no Staff match → clears localStorage, renders unauthenticated, fires info toast (assert via Sonner spy).
- Edge — provider reloads from payload with unknown `version` → clears localStorage, renders unauthenticated.
- Edge — logout while unauthenticated is a no-op.
- Integration — after `login`, `useAuth().user.role` is a valid `StaffRole`.
- Integration — `src/test/test-utils.tsx` with `authenticated: true` seeds a v2 payload; components rendered via `renderWithProviders` see `isAuthenticated === true`.

**Verification:**
- `pnpm test src/lib/__tests__/auth.test.tsx` passes.
- Manual: log in with arbitrary credentials in `pnpm dev`; navbar dropdown shows the seeded staff name.

### Phase 2 — App Shell

- [ ] **Unit 5: Main layout — Sidebar, Navbar (with inlined Breadcrumb), ProfileDropdown, MainLayout**

**Goal:** Redesign `Sidebar`, `Navbar`, and `MainLayout` to match Azure Horizon. Sidebar: 5 items (Dashboard / User / Staf / OTC with submenu / Report), 64px wide, System Status card at bottom, OTC sub-items link directly to `/otc/mint` and `/otc/redeem` (not to `/otc` — that route is BottomNav-only). Navbar: inlined breadcrumb (no separate component), search input, notifications bell with static badge, settings icon, profile dropdown (initials avatar + name → "View Profile" / "Logout"). Profile moved off sidebar entirely.

**Requirements:** R7, R8, R9, R10, R11, R12, R55 (profile location).

**Dependencies:** Unit 1 (tokens + Avatar), Unit 4 (AuthContext shape).

**Files:**
- Modify: `src/components/layout/Sidebar.tsx` (rewrite; OTC sub-menu expand/collapse; sub-items link to `/otc/mint` and `/otc/redeem` directly)
- Modify: `src/components/layout/Navbar.tsx` (rewrite — breadcrumb inlined as a private function within this file, not extracted; static notifications count `3`)
- Create: `src/components/layout/ProfileDropdown.tsx`
- Modify: `src/components/layout/MainLayout.tsx` (wire new children)
- Modify: `src/App.tsx` (add routes: `/users`, `/staff`, `/otc/mint`, `/otc/redeem`, `/report`, `/profile`; fallback `*` to `/dashboard` when authenticated and `/login` otherwise; `/otc` is registered in Unit 6, not here)
- Test: `src/components/layout/__tests__/Sidebar.test.tsx`
- Test: `src/components/layout/__tests__/Navbar.test.tsx` (covers breadcrumb behavior as part of Navbar, no separate Breadcrumb test)
- Test: `src/components/layout/__tests__/ProfileDropdown.test.tsx`

**Approach:**
- Sidebar active state: 4px left border `primary-container` + filled icon (lucide `fill="currentColor"`) + bold label + `on-primary-fixed-variant` text color.
- OTC sub-menu: expanded by default when route matches `/otc/*`; otherwise collapsed. Indented sub-items link directly to `/otc/mint` and `/otc/redeem` — the desktop sidebar never produces a `/otc` link.
- System Status card: static green dot + "Node Operational" in v1.
- Breadcrumb implementation inside Navbar.tsx: a private `buildBreadcrumb(pathname)` function returns an array of `{label, href?}` segments from a small lookup map (`/users` → "Directory / Users"). Rendered as React text nodes — never via `dangerouslySetInnerHTML`. Unknown route segments fall through to the raw path segment as a React text node (still safe — JSX auto-escapes strings).
- Notifications bell: static count of `3` in the badge (no endpoint). Click opens an empty sheet ("No new notifications").
- ProfileDropdown: Radix `DropdownMenu` with trigger showing `<Avatar size="sm" />` + staff displayName. Items: "View Profile" → navigate `/profile`; Separator; "Logout" → calls `logout()` from `useAuth()`.

**Patterns to follow:**
- Existing `src/components/layout/Sidebar.tsx` NavLink + `cn()` active-state pattern.
- Existing shadcn Dialog/DropdownMenu consumers in `src/components/ui/`.

**Test scenarios:**
- Sidebar happy — renders 5 primary items. OTC route expands sub-menu; a non-OTC route collapses it. Clicking "OTC" link toggles manually.
- Sidebar edge — active route `/otc/redeem` shows OTC expanded with Redeem sub-item highlighted, Mint unhighlighted.
- Navbar happy — breadcrumb for `/users` shows "Directory / Users"; for `/otc/mint` shows "Operations / OTC Minting".
- Navbar edge — unknown route segment shows the raw path segment as fallback.
- ProfileDropdown happy — trigger shows the logged-in staff's initials + firstName. Menu shows "View Profile" and "Logout".
- ProfileDropdown integration — clicking "Logout" calls auth context's logout and routes to `/login`; clicking "View Profile" navigates to `/profile`.
- Integration — `/profile` is **not** present in the Sidebar nav list (regression guard for R8).
- Accessibility — menu opens on Enter, closes on Esc; trigger has `aria-label`.

**Verification:**
- All three test files pass.
- `pnpm dev` renders every new route (pages can be placeholders this unit — filled in by later units).

- [ ] **Unit 6: Mobile BottomNav + `/otc` splash route + More drawer**

**Goal:** Rebuild `BottomNav` to four items (Dashboard / OTC / Report / More), add an `/otc` splash page with two large Mint/Redeem cards, and a "More" sheet drawer containing User / Staf / Profile links. No viewport-aware redirect — the splash is a valid fallback on any width.

**Requirements:** R74 (Q4 decision).

**Dependencies:** Unit 1, Unit 5 (route table).

**Files:**
- Modify: `src/components/layout/BottomNav.tsx`
- Create: `src/components/layout/MoreDrawer.tsx` (Radix Sheet)
- Create: `src/features/otc/OtcSplashPage.tsx`
- Modify: `src/App.tsx` (register `/otc` → OtcSplashPage; no viewport redirect)
- Test: `src/components/layout/__tests__/BottomNav.test.tsx`
- Test: `src/components/layout/__tests__/MoreDrawer.test.tsx`
- Test: `src/features/otc/__tests__/OtcSplashPage.test.tsx`

**Approach:**
- BottomNav: 4 `flex-1` items. Tap "More" → opens bottom sheet.
- Sidebar breakpoint: sidebar visible at ≥1024px; BottomNav visible at <1024px. The `hidden lg:flex` utility on Sidebar and `lg:hidden` on BottomNav are the complementary toggles.
- `/otc` splash: 2-column grid on tablet, 1-column on phone; each card has icon + title + short description + primary button navigating to `/otc/mint` or `/otc/redeem`. Renders unconditionally — no `window.innerWidth` check, no mount redirect, no paint flash.

**Patterns to follow:**
- Existing `src/components/layout/BottomNav.tsx` `flex-1` + active state.
- Existing shadcn `Sheet` for drawer.

**Test scenarios:**
- BottomNav happy — renders 4 items; active state reflects current route (Dashboard, OTC, Report, More).
- BottomNav happy — tapping "More" opens the drawer with 3 items (User, Staf, Profile).
- BottomNav integration — tapping a drawer item closes the drawer and navigates.
- OTC splash happy — renders both cards; tapping "OTC Mint" navigates to `/otc/mint`; tapping "OTC Redeem" navigates to `/otc/redeem`.
- OTC splash accessibility — card primary buttons have descriptive labels, keyboard-focusable, Enter triggers navigation.

**Verification:**
- Tests pass.
- Manual: DevTools mobile mode → BottomNav visible, "More" drawer opens smoothly, `/otc` splash visible.

- [ ] **Unit 7: LoginPage redesign (split-screen + artwork + form)**

**Goal:** Rewrite `LoginPage` to split-screen (≥1024px) with left brand panel (blue-pulse gradient + USDX logo + headline + reference artwork with licensing fallback to solid gradient), right form panel (Welcome Back, email, password with visibility toggle, Remember-device checkbox, Secure Login gradient button). Drop the Forgot Password link. Preserve the existing password visibility toggle from commit `6ec4fdd`.

**Requirements:** R13, R14, R15, R16, R17.

**Dependencies:** Unit 1 (tokens), Unit 4 (relaxed login).

**Files:**
- Modify: `src/features/auth/LoginPage.tsx` (rewrite)
- Delete: `src/features/auth/RegisterPage.tsx` (scheduled for Unit 17; file is still wired in routes until then — do NOT remove route from App.tsx in this unit)
- Delete: `src/features/auth/ForgotPasswordPage.tsx` (same scheduling)
- Create: `src/features/auth/LoginHeroArt.tsx` (small component wrapping the reference artwork or fallback; prop `variant: 'art' | 'gradient'`)
- Test: `src/features/auth/__tests__/LoginPage.test.tsx` (rewrite)

**Approach:**
- Layout uses CSS grid: `grid-cols-1 lg:grid-cols-2`. Left panel hidden below `lg`.
- LoginHeroArt: imports an SVG/PNG from `src/assets/` if licensing cleared, else renders pure CSS gradient + USDX mark. Default = `'gradient'` until art is added.
- Form: shadcn `Input` with icon-leading (wrapped in `relative` + absolute `Mail` / `Lock` icons). Password toggle: `type="password"` ↔ `type="text"` via state + `Eye` / `EyeOff` icon button.
- Remember-device checkbox: shadcn `Checkbox` (from Unit 1), wired to a `remember` state; on submit, auth context's `login` is called with an optional `{ persist: boolean }` flag (mock mode: affects `localStorage` TTL metadata but no enforcement).
- No "Forgot password?" link rendered.

**Execution note:** Start with a failing integration test: form submits, `useAuth().login` called with email+password, success → navigates to `/dashboard`.

**Patterns to follow:**
- Existing `src/features/auth/LoginPage.tsx` form structure (`handleSubmit`, error state, Sonner toast on failure).

**Test scenarios:**
- Happy path — submit valid email + password → login called → toast shown → navigates to `/dashboard`.
- Happy path — password visibility toggle flips `input[type]` between `password` and `text`.
- Edge — "Remember this device" checkbox state persists through a re-render.
- Negative — empty email submit → inline error + submit stays enabled after correction.
- Negative — login rejects (mocked) → error toast, form remains editable.
- Edge — no "Forgot password?" link exists in the DOM (regression guard for R17).
- Edge — no "Register" link exists in the DOM.
- Integration — on mobile viewport, left hero panel is not rendered (check via CSS-query or DOM absence of a known test-id).
- Accessibility — form has labeled fields; submit works via Enter.

**Verification:**
- Test passes.
- Visual check at desktop + mobile widths.

- [ ] **Unit 8: DataTable — filter-toolbar slot, Azure Horizon no-line restyle**

**Goal:** Extend `DataTable` with an arbitrary filter-toolbar slot (so User/Staff/Report pages can each compose their own filters) while preserving page/sort/search URL-state. Restyle to no-line convention (no row divider borders, `surface-container-highest` on row hover, uppercase letter-spaced column headers).

**Requirements:** R4, R73, R67c (empty states).

**Dependencies:** Unit 1.

**Files:**
- Modify: `src/components/DataTable.tsx`
- Modify: `src/components/CLAUDE.md` (update props table)
- Test: `src/components/__tests__/DataTable.test.tsx` (new + extended)

**Approach:**
- New prop: `filterToolbar?: ReactNode` — rendered in place of the hard-coded filter bar when provided. Hard-coded `search + statusOptions + date range` stays as the default when the slot is not passed (backward compat until the old pages are deleted).
- Expose a small helper hook `useDataTableParams()` that reads/writes the standard URL params (page, sortBy, sortOrder, search) — consumer pages use it to build their custom filter controls without re-implementing the URL wiring.
- Restyle: remove `border` on `<TableRow>`, add `hover:bg-surface-container-highest transition-colors duration-150`, change header cell typography to `text-xs uppercase tracking-wider font-medium text-on-surface-variant`.
- Empty state variants: show zero-data copy ("No data available") when `rowCount === 0 && !hasFilters`, zero-results copy ("No results match your filters — Clear filters" as a clickable inline link) when `rowCount === 0 && hasFilters`. Expose `emptyState?: ReactNode` prop for custom illustrations/CTAs.

**Patterns to follow:**
- Existing `DataTable` URL-state wiring.

**Test scenarios:**
- Happy — default toolbar renders search + status + date range (backward-compat smoke).
- Happy — custom `filterToolbar={<MyToolbar />}` replaces the default and is rendered inside the table header area.
- Happy — URL params `page=2&sortBy=name&sortOrder=asc` hydrate table state; navigating page updates URL; sorting a column updates URL.
- Empty state happy — `data=[], rowCount=0, no filters` renders "No data available".
- Empty state edge — `data=[], rowCount=0, hasFilters` renders "No results match your filters" with a Clear button that clears URL params.
- Empty state custom — `emptyState={<AddUserCTA/>}` prop renders instead when provided.
- Integration — loading skeleton shown when `isLoading=true`; rows appear when `isLoading` flips to false.
- Accessibility — column headers have `aria-sort="ascending"` / `"descending"` when active.

**Verification:**
- Tests pass.
- Visual: existing Minting/Redeem pages (still wired through Phase 7) render without layout regression.

### Phase 3 — Directory Management

- [ ] **Unit 9: User Management page (`/users`) + shared `CustomerTypeahead`**

**Goal:** Build the User Management page — summary cards (Total Users, Active Now, Organizations Managed), filter toolbar (search + Type + Role + Clear), DataTable (Name avatar+initials, Email, Phone, Type badge, Organization, Role, Actions), Add/Edit modal (First Name, Last Name, Email, Phone, Type, conditional Organization, Role as 3 bordered radio cards), Delete confirmation dialog. Also create the shared `CustomerTypeahead` component here (consumed later by Units 11, 12, 14) since the customer query infrastructure is first built in this unit.

**Requirements:** R24, R25, R26, R27, R28, R29, R30.

**Dependencies:** Unit 2 (types), Unit 3 (mocks), Unit 5 (layout + route), Unit 8 (DataTable slot).

**Files:**
- Create: `src/features/users/UsersPage.tsx`
- Create: `src/features/users/UserModal.tsx` (Add / Edit — single component with `mode`)
- Create: `src/features/users/UserDeleteDialog.tsx`
- Create: `src/features/users/UserFilterToolbar.tsx`
- Create: `src/features/users/hooks.ts` (`useCustomers`, `useCustomer`, `useCreateCustomer`, `useUpdateCustomer`, `useDeleteCustomer`, `useCustomerSummary`)
- Create: `src/components/CustomerTypeahead.tsx` (shared — debounced search input backed by `useCustomers({search})`; handles in-flight/debounce/error states; consumed by Units 11, 12, 14)
- Test: `src/features/users/__tests__/UsersPage.test.tsx`
- Test: `src/features/users/__tests__/UserModal.test.tsx`
- Test: `src/features/users/__tests__/hooks.test.ts`
- Test: `src/components/__tests__/CustomerTypeahead.test.tsx`

**Approach:**
- Hooks use TanStack Query; mutation success invalidates `['customers']` + `['customers','summary']`.
- UserModal uses shadcn `Dialog`; form state managed locally (no form lib), validation via `validateCustomerForm` from Unit 2.
- **Form validation timing convention** (applies to all forms): validate on blur after first interaction; re-validate on change once the field has been touched (clears errors as user corrects); submit revalidates all fields and scrolls to the first error. Wallet address and email format validators run on blur.
- **Modal dismiss convention** (applies to all modals): Esc and outside-click are **disabled while a mutation is in-flight**. On success, modal closes automatically via `onOpenChange(false)`. On error, modal stays open with error visible; Cancel or Esc dismisses without retry.
- Organization field is `disabled` + visually muted when `type === 'personal'`; value is cleared on type switch.
- Role radio cards: shadcn `RadioGroup` + custom card wrapper showing label + description. Member default.
- Delete dialog uses shadcn `Dialog` with destructive button variant (red gradient). Copy: "Delete user `<name>`? This cannot be undone." (matches R29).
- **Post-success form reset (Mint/Redeem/User/Staff/Profile PersonalDetails):** on mutation success, reset all fields to initial state and return focus to the first field. On error, preserve entered values so operator can correct and retry.
- **No optimistic updates** — rows appear after mutation success + `invalidateQueries`-driven refetch completes. Table shows skeleton during refetch.
- Summary cards read from a cheap `/api/customers/summary` endpoint (added in Unit 3 if not already).
- `CustomerTypeahead` states: (a) idle — input empty, dropdown closed; (b) debounce — user typed, no fetch yet, dropdown closed; (c) in-flight — fetch pending, dropdown shows inline `<Skeleton />` rows; (d) results — rows render; (e) zero results — "No users found" row; (f) error — "Could not load users" row with retry.

**Execution note:** Start with an integration test that mounts the full UsersPage with MSW; add → edit → delete flow.

**Patterns to follow:**
- Existing hook pattern in `src/features/minting/hooks.ts` (to be deleted in Unit 17 — mirror the shape, not the content).
- Existing modal pattern in `src/features/minting/MintingDetailModal.tsx` (structure only).

**Test scenarios:**
- Happy — page loads with 10 customers from MSW; summary cards show totals.
- Happy — click "Add User" → modal opens → submit valid form → modal closes → new customer appears in table → success toast.
- Happy — click edit on a row → modal opens pre-filled → change role → save → row updates.
- Happy — click delete → confirmation shows name → confirm → row removed → success toast.
- Edge — Type switch from "Personal" to "Organization" enables the Organization field; switching back clears and disables it.
- Edge — submit with type=organization and empty org field → inline error on org, submit disabled.
- Edge — pagination: switch to page 2, refresh — URL retains `page=2`, table shows page 2.
- Edge — filter by Type=Organization + search "Vertex" → table shows only matching rows.
- Negative — Add submit returns 400 (mocked) → error toast with server message; modal stays open.
- Negative — Edit email to invalid format → inline error; Save disabled.
- Negative — Delete returns 500 (mocked) → error toast; row still present.
- Empty state — filter returning no rows shows "No results match your filters" copy.
- Empty state — seed an empty customer store → shows "No users yet" with "Add User" CTA.
- Accessibility — Delete dialog traps focus; Esc closes; destructive button has `aria-label`.

**Verification:**
- All three test files pass.
- Manual: full add/edit/delete flow in `pnpm dev`.

- [ ] **Unit 10: Staff Management page (`/staff`)**

**Goal:** Mirror User Management but for internal Staff. Summary cards (Total Staff, Admins, Active Now), filter toolbar (search + Role + Clear), DataTable (Name, Email, Phone, Role badge, Actions), Add/Edit modal (First Name, Last Name, Email, Phone, Access Role dropdown — Support Agent / Operations Manager / Compliance Officer / Super Admin; **no password field, no Pending Invite state** per Q-resolution), Delete confirmation with "Invitation sent" toast on create. Delete confirmation copy: standard "Delete staff `<name>`? This cannot be undone." Self-delete copy: "You are about to delete your own account. You will be logged out immediately. Continue?"

**Requirements:** R31, R32, R33, R34, R35, R36, R37.

**Dependencies:** Unit 2, Unit 3, Unit 5, Unit 8.

**Files:**
- Create: `src/features/staff/StaffPage.tsx`
- Create: `src/features/staff/StaffModal.tsx`
- Create: `src/features/staff/StaffDeleteDialog.tsx`
- Create: `src/features/staff/StaffFilterToolbar.tsx`
- Create: `src/features/staff/hooks.ts` (`useStaff`, `useCreateStaff`, `useUpdateStaff`, `useDeleteStaff`, `useStaffSummary`)
- Test: `src/features/staff/__tests__/StaffPage.test.tsx`
- Test: `src/features/staff/__tests__/StaffModal.test.tsx`

**Approach:**
- Same structure as Unit 9 but simpler form (no Type, no Organization, no radio-card roles — single select for Role).
- On successful create, fire toast `"Invitation sent to <email>"`. No Pending Invite badge on the table — new rows appear as immediately active.
- No delete guards in v1 (consistent with R36/R67). Logged-in user can delete themselves (routes to `/login` after the mutation succeeds).

**Patterns to follow:**
- Unit 9 page structure.

**Test scenarios:**
- Happy — submit "Add Staff" → mutation called → "Invitation sent to <email>" toast → row appears.
- Happy — Edit role → mutation → row updates.
- Happy — Delete → row removed.
- Edge — "Delete self" → mutation succeeds + AuthContext logout + navigate to `/login`.
- Edge — Filter by Role=super_admin → table shows only super admins.
- Negative — Invalid email format inline-errors on submit.
- Empty state — No staff seeded → "No staff members yet" with "Add Staff" CTA.

**Verification:**
- Tests pass.
- Manual: add staff, see invite toast, edit, delete.

### Phase 4 — OTC Operations

- [ ] **Unit 11: OTC Mint page (`/otc/mint`)**

**Goal:** Build OTC Mint page with 12-column bento (form col-span-8, info panel col-span-4, Recent Requests inside right panel). Form: Select User typeahead (sourced from `/api/customers?search=`), Network dropdown (5 networks), Mint Amount input with USDX suffix + available supply/fee helper, Destination Wallet Address input with checksum validation, Internal Notes textarea, "Confirm Mint Request" gradient submit button. Right panel: Minting Protocol guidance, Vault-Grade Protection visualization, Recent Requests ghost list (last 5 for this operator). Settlement async with pulsing dot + toast (per Q8).

**Requirements:** R38, R39, R40, R41, R42, R67f, R67g, Q5 (networks), Q8 (settlement feedback).

**Dependencies:** Unit 2, Unit 3, Unit 5, Unit 8 (not strictly needed — Mint page doesn't use DataTable), Unit 9 (customer data for typeahead).

**Files:**
- Create: `src/features/otc/mint/OtcMintPage.tsx`
- Create: `src/features/otc/mint/OtcMintForm.tsx`
- Create: `src/features/otc/mint/OtcMintInfoPanel.tsx`
- Create: `src/features/otc/mint/RecentRequestsList.tsx`
- Create: `src/features/otc/hooks.ts` (shared — `usePendingSettlementPolling` used by both Mint and Redeem)
- Create: `src/features/otc/mint/hooks.ts` (`useCreateMint`, `useRecentMints` — import shared polling from `../hooks.ts`, consume shared `<CustomerTypeahead />` from `src/components/CustomerTypeahead.tsx` built in Unit 9)
- Test: `src/features/otc/mint/__tests__/OtcMintPage.test.tsx`
- Test: `src/features/otc/mint/__tests__/OtcMintForm.test.tsx`
- Test: `src/features/otc/mint/__tests__/RecentRequestsList.test.tsx`

**Approach:**
- `useCreateMint` mutation: posts to `/api/otc/mint`, on success invalidates `['otc','mint','recent']` and `['dashboard']`, fires success toast ("Mint request submitted"). On error fires error toast.
- `useRecentMints` query: `refetchInterval: 5000` when `data.some(r => r.status === 'pending')`, else `false`. Uses a `useRef<Set<string>>` to track already-toasted terminal ids; on each success callback, any row whose status is terminal and whose id is not in the ref fires a settlement toast and is added to the ref.
- Settlement pulse: row shows `animate-pulse-dot` class when status === 'pending'.
- CustomerTypeahead: imported from `src/components/CustomerTypeahead.tsx`; see Unit 9 for its internal state machine (idle / debounce / in-flight / results / zero / error).
- Form submit disabled until all required fields valid; wallet checksum runs on blur.
- **Mobile stacking** (<1024px): form first (full width), then info panel (full width), then Recent Requests list. The 12-column bento collapses to a single column with `flex-col gap-6`.

**Execution note:** Start with integration test: happy path submit → pending row appears → fake-timer advance → toast + status transitions.

**Patterns to follow:**
- TanStack Query mutation + invalidate pattern from existing `src/features/minting/hooks.ts` (structure only — content is new).
- Sonner toast pattern.

**Test scenarios:**
- Happy — fill form (customer, network, amount, address, notes) → submit → mutation called → toast "Mint request submitted" → form clears → focus returns to Select Customer → Recent Requests shows new pending row with pulsing dot indicator.
- Happy — `flushSettlement(txId, 'completed')` → row transitions to `completed` → settlement toast fires once. Repeated `flushSettlement` (idempotent) does not re-toast (regression guard for the dedup ref).
- Happy — network dropdown includes all 5 networks in order: Ethereum, Polygon, Arbitrum, Solana, Base.
- Happy — typing "Juli" in Select Customer: assert NO fetch within 200ms → advance timers 300ms → assert exactly ONE fetch with `search=Juli` → typeahead shows Julian Anderson. (Proves debounce collapse + latency.)
- Edge — typeahead in-flight state shows `<Skeleton />` rows in dropdown; after response, rows replace skeletons.
- Edge — typeahead returns zero results → shows "No users found" row.
- Edge — typeahead API returns 500 → shows "Could not load users" row with retry.
- Edge — amount = 0 → submit disabled; error inline on blur.
- Edge — invalid wallet address (fails checksum) → submit disabled; error inline on blur.
- Edge — Solana selected → wallet validator switches to base58 check.
- Edge — `ghost list` of Recent Requests shows at most 5 items; the 6th pushes the oldest out.
- Negative — mutation returns 400 → error toast with server message; form not cleared.
- Integration — after Mint submit, `/api/dashboard` KPI `pendingTransactions` increments (verified via separate dashboard query mount in test).
- Integration — customerName snapshot persisted: after submission, the Recent Requests row shows the customer's name even if the customer is deleted via `deleteCustomer` mutation (verify snapshot survives delete).
- Accessibility — submit button has `aria-busy` while mutation in flight; form errors announced via `role="alert"`.

**Verification:**
- All three test files pass.
- Manual: submit a mint → see pending row pulsing → wait 8–15s → see toast + row becomes completed.

- [ ] **Unit 12: OTC Redeem page (`/otc/redeem`)**

**Goal:** Mirror Unit 11's layout/mechanics with the Redeem form (col-span-7 form, col-span-5 info panel, full-width Recent Redemptions **table** below). Form: Amount with MAX + available balance, Destination Network (5 networks, per Q5), info alert about Institutional Treasury Vault, Confirm Redemption button. Info panel: Operations Guide card + Meta Grid (Redeem Fee, Slippage) — no Treasury Liquidity card.

**Requirements:** R43, R44, R45, R46, R47, R48, Q5, Q8.

**Dependencies:** Unit 2 (types), Unit 3 (mocks + `/api/otc/redeem` endpoint), Unit 5 (layout + routes), Unit 8 (DataTable for Recent Redemptions), Unit 9 (shared `CustomerTypeahead`), Unit 11 (shared `src/features/otc/hooks.ts` polling).

**Files:**
- Create: `src/features/otc/redeem/OtcRedeemPage.tsx`
- Create: `src/features/otc/redeem/OtcRedeemForm.tsx`
- Create: `src/features/otc/redeem/OtcRedeemInfoPanel.tsx`
- Create: `src/features/otc/redeem/RecentRedemptionsTable.tsx`
- Create: `src/features/otc/redeem/hooks.ts` (`useCreateRedeem`, `useRecentRedeems`)
- Test: `src/features/otc/redeem/__tests__/OtcRedeemPage.test.tsx`
- Test: `src/features/otc/redeem/__tests__/OtcRedeemForm.test.tsx`

**Approach:**
- MAX button populates amount with the mocked available balance figure.
- RecentRedemptionsTable uses `DataTable` (no custom filter toolbar — just last 5 rows, no pagination needed; pass `data` directly and `rowCount=data.length`). Columns: Transaction ID (truncated + copy-on-click), Amount, Network (colored dot + name), Timestamp (relative), Status.
- Settlement polling hook shared with Mint if extraction is clean (evaluate during impl).

**Patterns to follow:**
- Unit 11 structure.

**Test scenarios:**
- Happy — submit valid form → toast → pending row appears in Recent Redemptions table.
- Happy — MAX button populates amount with available balance (mocked value).
- Happy — amount exceeding balance → inline error, submit disabled.
- Happy — Solana is present in Destination Network dropdown (regression guard for Q5).
- Edge — copy-on-click on Transaction ID copies full hash to clipboard; test uses a clipboard mock.
- Edge — Status badge uses `Completed` label mapped from `completed` data value (verifies R67f vocabulary rule).
- Integration — after redeem + fake-timer settlement, Dashboard KPI `totalRedeem30d` updates (verify via separate dashboard query).

**Verification:**
- Tests pass.
- Manual: submit redeem → see pulsing row → settlement after delay.

### Phase 5 — Insights

- [ ] **Unit 13: Dashboard redesign (`/dashboard`)**

**Goal:** Redesign DashboardPage with header, 4 KPI cards (Total Mint Volume 30d, Total Redeem Volume 30d, Active Users, Pending Transactions), Volume Trend chart (Recharts), Recent Activity list (last 8 OTC txns), Network Distribution card. No deep-links (per Q3 scope cut — KPI cards are static tiles).

**Requirements:** R18, R19, R20, R21, R22, R23.

**Dependencies:** Unit 1, Unit 3 (dashboard endpoint).

**Files:**
- Modify: `src/features/dashboard/DashboardPage.tsx` (rewrite)
- Create: `src/features/dashboard/KpiCard.tsx`
- Create: `src/features/dashboard/VolumeTrendChart.tsx`
- Create: `src/features/dashboard/RecentActivityList.tsx`
- Create: `src/features/dashboard/NetworkDistribution.tsx`
- Modify: `src/features/dashboard/hooks.ts` (rewrite — new `DashboardSnapshot` query shape; no `DashboardStats.minting` / `.redeem` references — regression grep after)
- Modify: `package.json` (add `recharts@^2.15.0` — verified React 19 peer support)
- Test: `src/features/dashboard/__tests__/DashboardPage.test.tsx`
- Test: `src/features/dashboard/__tests__/KpiCard.test.tsx`
- Test: `src/features/dashboard/__tests__/VolumeTrendChart.test.tsx`

**Approach:**
- **Lazy-load Recharts:** `const VolumeTrendChart = React.lazy(() => import('./VolumeTrendChart'))`, wrapped in `<Suspense fallback={<Skeleton className="h-48" />}>`. Keeps ~70KB out of the Dashboard initial bundle.
- Recharts: `<LineChart>` with two series (mint, redeem), responsive container, Azure Horizon palette via `stroke` props referencing CSS vars (e.g., `stroke="var(--color-primary)"`).
- KpiCard accepts `label`, `value`, `trend` (optional: `{value: string, direction: 'up' | 'down'}`), `icon`. Icon mapping: Total Mint Volume → `ArrowUpCircle`, Total Redeem Volume → `ArrowDownCircle`, Active Users → `Users`, Pending Transactions → `Clock`. (Dashboard cards are static tiles per R23 — no deep-links.)
- RecentActivityList: each row uses Avatar + type badge + amount + network dot + operator name + relative timestamp + status badge.
- NetworkDistribution: small horizontal bar list with network color dots and % share.
- **Mobile stacking** (<1024px): KPI cards wrap 2-per-row, then chart full width, then Recent Activity full width, then Network Distribution full width.
- **Ordering safeguard:** `grep -r "DashboardStats\.\(minting\|redeem\)" src/features/dashboard/` must return empty before this unit ships (prevents silent stale-type inheritance).

**Patterns to follow:**
- Existing `src/features/dashboard/DashboardPage.tsx` structure.

**Test scenarios:**
- Happy — page renders 4 KPI cards with values from mocked `/api/dashboard`.
- Happy — Volume Trend chart renders with both mint + redeem series (verify `<path>` count or data-testid).
- Happy — Recent Activity shows 8 rows; each row has avatar + type + amount + network + operator + timestamp + status.
- Happy — Network Distribution shows all active networks with percentage values totaling ~100%.
- Edge — Pending Transactions count = 0 → card renders "0" without trend arrow.
- Edge — trend value negative → KpiCard shows down arrow in error color.
- Edge — `/api/dashboard` returns empty activity → RecentActivityList shows "No activity yet" empty state.
- Integration — after OTC mint submission on `/otc/mint`, navigating to `/dashboard` shows updated KPIs (end-to-end via same-session mock state).
- Accessibility — KpiCard uses semantic heading for metric; chart has `role="img"` with `aria-label`.

**Verification:**
- Tests pass.
- Manual: `pnpm dev` → Dashboard renders with populated chart.

- [ ] **Unit 14: Report page (`/report`) + CSV export**

**Goal:** Build Report page with filter bar (Date Range, Type, Customer typeahead, Status segmented control, Search, filter-gear placeholder), DataTable (Date / Transaction ID / Type / Customer / Network / Amount / Status), insights bento (Total Volume, Active Minters, Flagged Transactions), Export CSV button.

**Requirements:** R49, R50, R51, R52 (CSV only), R53, R54, Q3 (filter by Customer).

**Dependencies:** Unit 2, Unit 3 (report endpoint), Unit 8 (DataTable slot), Unit 9 (customer typeahead reusable).

**Files:**
- Create: `src/features/report/ReportPage.tsx`
- Create: `src/features/report/ReportFilterToolbar.tsx`
- Create: `src/features/report/ReportInsightsBento.tsx`
- Create: `src/features/report/hooks.ts` (`useReport`, `useReportInsights`)
- Modify: `src/lib/csv.ts` (add `exportReportToCsv` using existing `exportToCsv` + `buildCsvContent`; CSV-injection guard was already added in Unit 2 to `escapeCsvCell`)
- Test: `src/features/report/__tests__/ReportPage.test.tsx`
- Test: `src/features/report/__tests__/ReportFilterToolbar.test.tsx`
- Test: `src/lib/__tests__/csv.test.ts` (extend — export with filter set)

**Approach:**
- Filter toolbar built via `<DataTable filterToolbar={<ReportFilterToolbar />} />`.
- Status segmented control: 4 buttons (All / Pending / Completed / Failed). Clicking writes `status` URL param ("all" clears it).
- Customer filter: shares `CustomerTypeahead` from Unit 11 where reasonable.
- Search matches customerName snapshot, transaction ID, destination address.
- Export CSV: calls `useReport` with current filters, builds CSV from returned rows (client-side, current filter set only).
- Insights bento cards computed from the same `useReportInsights` query that responds to the same filters.

**Patterns to follow:**
- Unit 8 DataTable integration.
- Existing `src/lib/csv.ts` export helpers.

**Test scenarios:**
- Happy — page loads with paginated transactions from mocked `/api/report`.
- Happy — Date Range start=2026-04-01 filters rows; URL updates to `?startDate=2026-04-01`.
- Happy — Type=Mint filter excludes redeems.
- Happy — Status segmented=Pending filters rows + URL updates.
- Happy — Customer typeahead "Sarah" → selecting Sarah Mitchell filters rows to hers only.
- Happy — Search "0x72" matches transaction ID prefix.
- Happy — Export CSV click → downloads CSV with 7 columns; content matches current filter set.
- **Security — CSV injection** — a transaction whose Notes (or customerName after a rename) field starts with `=HYPERLINK(...)`, `+cmd`, `-LEAD(1)`, or `@command` is exported with a leading single-quote prefix (`'=HYPERLINK(...)`); benign cells are not modified. Verify by grepping the downloaded blob for those prefixes.
- Edge — filter combination yielding zero rows → empty state "No results match your filters" + Clear link.
- Edge — pagination + filters persisted together on refresh.
- Edge — Transaction ID column: truncated display ("0x72…94a1"), full value on hover (title attribute), click-to-copy.
- Integration — Export CSV after filter change exports the filtered set (not all data).
- Negative — CSV export with zero rows produces a CSV with headers only.
- Insights — Total Volume card recomputes after filter change.

**Verification:**
- Tests pass.
- Manual: filter → CSV → download contains filtered data.

### Phase 6 — Profile + Patterns

- [ ] **Unit 15: Profile page redesign (`/profile`)**

**Goal:** Rewrite ProfilePage to Azure Horizon layout — 12-column bento, identity card (Avatar lg, name, role), contact card (email, phone), Personal Details two-column form (Full Legal Name, Display Name, Regional Access, Timezone), Password/2FA disabled rows with tooltip, Recent Activity Summary timeline (last 3 operator activities). No tabs. No Update Status button. Export Logs ghost button in header (renders a toast "Export logs is not implemented in v1" for now — flagged in Scope as dev tool).

**Requirements:** R55–R63.

**Dependencies:** Unit 1 (Avatar), Unit 3 (profile endpoint), Unit 4 (auth → who is logged in).

**Files:**
- Modify: `src/features/profile/ProfilePage.tsx` (rewrite)
- Create: `src/features/profile/PersonalDetailsForm.tsx`
- Create: `src/features/profile/RecentActivityTimeline.tsx`
- Create: `src/features/profile/SecurityAccessSection.tsx` (renders disabled rows with tooltip)
- Modify: `src/features/profile/hooks.ts` or create if missing (`useProfile`, `useUpdateProfile`)
- Test: `src/features/profile/__tests__/ProfilePage.test.tsx`
- Test: `src/features/profile/__tests__/PersonalDetailsForm.test.tsx`

**Approach:**
- `useProfile` query hits `/api/profile`. `useUpdateProfile` mutation invalidates `['profile']` + `['staff']` on success, fires "Profile updated" toast.
- SecurityAccessSection: Password row "Last changed 42 days ago" + disabled "Change Password" button + tooltip "Available after v1". 2FA toggle disabled + tooltip.
- RecentActivityTimeline: renders 3 items with icon + description + relative timestamp; visually a vertical dot timeline.

**Patterns to follow:**
- Form patterns from Units 9/10.

**Test scenarios:**
- Happy — page loads current staff's identity + contact + recent activity from mocked endpoint.
- Happy — Edit a field in Personal Details → Save → mutation → toast → read-only re-render reflects change.
- Happy — Recent Activity shows 3 most recent operator actions.
- Edge — "Change Password" button is disabled; hovering shows tooltip "Available after v1".
- Edge — 2FA toggle is disabled; state cannot be changed by click.
- Edge — No "Security & Privacy" / "Permissions" / "Integrations" tabs exist in the DOM (regression guard for R63).
- Edge — No "Update Status" button in the DOM (regression guard for R62).
- Integration — clicking ProfileDropdown "View Profile" in navbar lands on this page with the logged-in staff's data.
- Accessibility — disabled buttons carry `aria-disabled` + reason via `aria-describedby`.

**Verification:**
- Tests pass.
- Manual: open Profile from navbar, edit a field, confirm save.

- [ ] **Unit 16: Sonner toaster config + icon-label audit**

**Goal:** The bulk of consolidation (FieldError, TableEmptyState, Avatar, theme tokens) already lives in Unit 1 — by the time features in Units 9–15 land, they import shared primitives from day one. This unit does the two remaining cross-cutting tasks: standardize the Sonner toaster config (position, duration, variants) and run a codebase-wide audit that every icon-only button has `aria-label` and every segmented control has `role="group"` + `aria-label`. No new axe E2E spec — R67e requirements are covered by per-unit accessibility test scenarios across Units 5, 9, 10, 11, 15.

**Requirements:** R67d (toaster), R67e (a11y).

**Dependencies:** Units 5, 9–15 complete (audit requires all icon/segmented consumers to exist).

**Files:**
- Modify: `src/components/ui/sonner.tsx` (configure position top-right, durations 5s success/info / 8s error, four variants: success, error, info, warning)
- Modify: any icon-only button discovered missing `aria-label` during the audit pass

**Approach:**
- Sonner config: `<Toaster position="top-right" duration={5000} toastOptions={{ classNames: { error: 'border-error', success: 'border-success', info: 'border-primary', warning: 'border-warning' }, closeButton: true }} />`. Errors override to 8000ms via per-toast option.
- Audit: grep `button.*aria-label` vs `<Button.*lucide icon only`; patch every miss. Segmented `role="group"` on the Report Status filter (R50).

**Test scenarios:**
- Toaster — success variant renders with correct border color class and 5s default; error variant uses 8s. (Assert prop values on the rendered Toaster, not visual dismissal — dismissal timing is Sonner-internal and not worth fake-timer gymnastics.)
- Audit — `grep '<Button.*><.*Icon\|<button><.*Icon' src/` returns zero matches without an adjacent `aria-label`. Run as part of `pnpm lint` via an ESLint rule if convenient, else as a manual check in Unit 18 verification.

**Verification:**
- Toaster test passes.
- Icon-label grep returns clean.

### Phase 7 — Migration & Cleanup

- [ ] **Unit 17: Delete obsolete files, routes, status helpers, old MSW handlers**

**Goal:** Remove everything the redesign replaces. Deletions are "safe" at this point because all consumer pages (minting, redeem old) have been superseded by the new routes and the CLAUDE.md files have been updated.

**Requirements:** R68, R69, R70, R71, R74a.

**Dependencies:** Units 1–16 complete and tests green.

**Files:**
- Delete: `src/features/minting/` (entire directory)
- Delete: `src/features/redeem/` (entire directory)
- Delete: `src/features/auth/RegisterPage.tsx`, `src/features/auth/ForgotPasswordPage.tsx`
- Modify: `src/App.tsx` (remove `/register`, `/forgot-password`, `/minting`, `/redeem` routes; fallback `*` → `/dashboard` if authenticated, `/login` otherwise)
- Modify: `src/lib/types.ts` (remove `MintingRequest`, `RedeemRequest`, `MintingStatus`, `RedeemStatus`, `DashboardStats.minting/redeem` shapes, the old `User` alias)
- Modify: `src/lib/status.ts` (final rewrite — drops approval-workflow code wholly; may be much smaller after this unit)
- Modify: `src/lib/validators.ts` (final removal of `validateRegisterForm`, `validateForgotPasswordForm` if any residue)
- Modify: `src/mocks/handlers.ts` (remove old `/api/minting`, `/api/redeem` handlers, their approve/reject/review endpoints)
- Modify: `src/mocks/data.ts` (remove `createMintingRequest`, `createRedeemRequest` factories, old `createMockDashboardStats` shape)
- Modify: `src/mocks/CLAUDE.md` (reflect final API surface)

**Approach:**
- Do this as one big deletion commit inside the phase. Run full test suite after to confirm no orphan references.
- Grep for any remaining reference to the old types, routes, or URL paths; fix or delete.

**Test scenarios:**
- Test expectation: none directly — this unit is pure deletion. Green signal is:
  - `pnpm build` passes type-check with no unused imports / missing exports.
  - `pnpm lint` passes (no unused variables).
  - All existing tests from Units 1–16 still pass against the reduced surface.

**Verification (comprehensive grep set):**
- Full suite green.
- `grep -r "canApprove\|canReject\|canStartReview\|MintingRequest\|RedeemRequest\|MintingStatus\|RedeemStatus\|RegisterPage\|ForgotPasswordPage" src/` returns empty.
- `grep -r "/api/minting\|/api/redeem\|/approve\|/reject\|/review" src/mocks/` returns empty.
- `grep -r "DashboardStats\.\(minting\|redeem\)" src/` returns empty.
- `grep -rn "\bUser\b" src/lib/types.ts` returns empty (the rename completed in Unit 2; this catches any reintroduction).

- [ ] **Unit 18: Rewrite tests, docs, E2E smoke spec**

**Goal:** Finalize the test matrix and documentation. Replace `e2e/main-flow.spec.ts` with a new smoke spec covering the end-to-end happy path (login → dashboard → add-user → submit-mint → see-in-report). Update root `CLAUDE.md`, `src/lib/CLAUDE.md`, `src/components/CLAUDE.md`, `src/mocks/CLAUDE.md` to reflect the new architecture.

**Requirements:** R74a, R74c, S1–S8.

**Dependencies:** Unit 17 (deletions done).

**Files:**
- Delete: `e2e/main-flow.spec.ts`, `e2e/auth.spec.ts` (both exercise the removed routes and DEMO_USER credentials)
- Create: `e2e/smoke.spec.ts`
- Note: root `CLAUDE.md` was already updated in Unit 2 (menu list + status flows). This unit re-checks it and adds the "Adding a New Feature" section if not already done.
- Modify: `src/lib/CLAUDE.md` (remove approval-helper table entries; add new validator/format/status entries)
- Modify: `src/components/CLAUDE.md` (DataTable props table with new `filterToolbar` + `emptyState` slots; Avatar, FieldError, TableEmptyState, CustomerTypeahead entries)
- Modify: `src/mocks/CLAUDE.md` (final API contract table)
- Modify: `e2e/CLAUDE.md` (update to reflect new spec names + flows)
- Modify: `README.md` if any product description references the old menu structure

**Approach:**
- `smoke.spec.ts` — 1 happy-path flow, ~40 Playwright lines, marked `@e2e`.
- Keep the existing MSW browser setup for E2E; no new Playwright infra.
- Smoke spec uses deterministic synthetic values — `demo@usdx.io` (seeded in Unit 3 as a real Staff record), customer name "Smoke Test User", amount "1000", destination an EIP-55-valid test wallet. These avoid confusion with real accounts in CI artifacts.
- For settlement, the spec calls the browser-side `flushSettlement` hook exposed by MSW in dev/test mode (via `window.__mswFlushSettlement` or similar dev shim) to transition the pending row synchronously — avoiding the 16-second `waitForTimeout` fallback.

**Test scenarios (smoke spec itself):**
- Navigate to `/login` → fill "demo@usdx.io" + any password → click Secure Login → lands on `/dashboard`.
- Click sidebar "User" → `/users` loads with table → click "Add User" → fill form with "Smoke Test User" → submit → new row visible.
- Click sidebar "OTC" → Mint sub → submit mint form with the newly-added customer → toast + pending row.
- Call `window.__mswFlushSettlement(txId, 'completed')` → row transitions to `completed` → settlement toast appears.
- Click sidebar "Report" → new transaction present in the table with Customer = "Smoke Test User".

**Verification:**
- `pnpm test` — all unit + integration tests pass.
- `pnpm test:e2e` — smoke spec passes.
- `pnpm test:all` — end-to-end green.
- `pnpm build` — clean build, no warnings.
- `pnpm lint` — clean.

---

## System-Wide Impact

- **Interaction graph:** The AuthContext loses two public methods; anything reaching into them via `useAuth()` must be updated (currently only the old Register/ForgotPassword pages, which are deleted). The `DataTable` filter-toolbar slot is additive; existing consumers that don't pass `filterToolbar` continue to render the default toolbar until their pages are deleted in Phase 7.
- **Error propagation:** All mutations converge on Sonner toast for API errors (R67b). Validation errors render inline via `<FieldError>` (Unit 16). A single `src/components/ui/sonner.tsx` config makes variant behavior consistent.
- **State lifecycle risks:** The in-memory MSW stores hold pending OTC transactions with scheduled `setTimeout`s. Hot-reload during development can cause duplicate schedulers if `resetMockData()` isn't called on worker restart — address by tracking scheduled timeouts in a module-level `Set` and clearing on reset. Tests use MSW node server + `resetMockData()` in `afterEach`.
- **API surface parity:** The new REST routes under `/api/*` follow the same `PaginatedResponse<T>` + error-envelope contract as the existing handlers, so consumers that follow `src/mocks/CLAUDE.md` don't need a new contract doc.
- **Integration coverage:** E2E smoke (Unit 18) covers cross-feature integration that unit tests can't prove — in particular that a customer added in `/users` appears as a valid typeahead target in `/otc/mint`, that the submitted mint is visible in `/report`, and that Dashboard KPIs reflect the same session state.
- **Unchanged invariants:** Security posture (CSP, X-Frame-Options, rel="noopener noreferrer", no eval) is preserved (S7). The existing `DataTable` URL-state API (page/search/status/sortBy/sortOrder/startDate/endDate) continues to work for pages that use the default toolbar (until those pages are deleted). The `PaginatedResponse<T>` envelope continues to be the contract.

## Risk Analysis & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Phase ordering leaves `main` uncompilable mid-PR stack | Medium | High | Do all 18 units on a single branch and open one PR. Do not merge intermediate states. Alternatively, split into three sequenced PRs (Foundation+Shell / Features / Cutover) along natural phase boundaries if single-PR review becomes untenable. |
| Tailwind v4 `@theme` token rename breaks a stray consumer | Low | Medium | Grep for every old token name (`primary-light`, `primary-dark`, `dark`, etc.) before deleting; tag them with temporary aliases in `index.css` until Phase 7 removes aliases. Theme test in Unit 1 asserts new tokens override. |
| Recharts visual clash with Azure Horizon palette | Medium | Low | Pass CSS var values to stroke/fill props; verify manually during Unit 13. Fallback to hex literals if CSS var is not accepted. |
| Recharts React 19 peer-dep refusal blocks Unit 13 | Low | High | Pin `recharts@^2.15.0` (verified React 19 support). Pre-verify install on a scratch branch before Unit 13 starts. If peer refuses, fallback to Visx (`@visx/shape` + `@visx/scale`, ~40KB). |
| MSW timer fires after test cleanup / stale closure on HMR | Medium | Medium | Track pending timers in a module-level `Set`, clear on `resetMockData()` (afterEach) and on `import.meta.hot?.dispose()`. Tests use `flushSettlement(id)` synchronous hook instead of fake timers. |
| Login hero artwork licensing fails pre-merge | Low | Low | `LoginHeroArt` ships with `variant: 'gradient'` by default. v1 does not include reference artwork; v1.1 follow-up adds art once licensed. S1 scoped to exclude login hero in v1. |
| Customer typeahead hits `/api/customers?search=` on every keystroke | Medium | Low | 300ms debounce in `CustomerTypeahead`; query results cached by TanStack Query per search term. Test explicitly asserts debounce collapse (no fetch within 200ms, one fetch after 300ms). |
| Lucide icon mapping drifts visually from reference | Medium | Low | Accept minor drift. Unit 1 verifies every referenced icon exists in the pinned lucide version; bump if needed. |
| Session shape migration strands users with v1 localStorage | Certain | Low | Unit 4 implements v1→v2 migration: read old `{id, name, email, role}`, look up Staff by email, persist as v2, continue authenticated. Only unresolvable emails trigger re-login (with info toast). |
| Test matrix inflates Vitest run time past CI budget | Low | Low | Vitest colocated per feature; integration tests mount minimal MSW scope. Parallelize via default workers if needed. |
| Big-bang PR too large to review | High | Medium | Structure PR body by phase with clear per-phase diffs and screenshots. If reviewer fatigue manifests, split into 3 sequenced PRs: Foundation+Shell (Phases 1–2), Features (Phases 3–6), Cutover+Cleanup (Phase 7) — the final cutover PR stays small and atomic. |
| localStorage `staffId` is user-tamperable via DevTools | Certain | Low (v1 mock) | Accepted v1 risk. In mock mode any authenticated user can tamper staffId to super_admin — no privilege escalation impact because mock auth is already permissive. Pre-production deploy must introduce real RBAC + server-side session validation. Documented in Known v1 Risks (Key Decisions). |
| Free-text Notes field → CSV formula injection | Medium | Medium | `escapeCsvCell` in `src/lib/csv.ts` prepends `'` to cells starting with `=`, `+`, `-`, or `@`. Covered by Unit 2 test scenarios. |
| Clipboard-hijack substitutes wallet address on OTC submit | Low | High (prod) / Low (mock) | Accepted v1 risk — no confirmation modal, no address whitelist. Documented in Known v1 Risks. Pre-production deploy must add confirmation modal with re-displayed full address (flagged in Scope Boundaries). |

## Alternative Approaches Considered

- **Feature-flagged theme + page-at-a-time cutover** — Rejected per origin Q7 (demo window closed; flag infrastructure = pure carrying cost).
- **Parallel `/v2/*` routes** — Same rejection.
- **Sequenced 3-PR delivery (Foundation+Shell / Features / Cutover)** — Deferred but not rejected. Single-PR big-bang is the default; if reviewer fatigue on the 5000+ line diff becomes untenable, fall back to the 3-PR sequence. Each PR is additive-only and green-on-merge; the final "Cutover" PR is small (deletes + CLAUDE.md + smoke spec).
- **Server-driven design tokens via CSS-in-JS instead of `@theme`** — Rejected. Tailwind v4 `@theme` is already established in this repo and works with static extraction.
- **Form library (React Hook Form / Formik)** — Rejected for v1. Six forms all simple (≤8 fields); shared field-error primitive from Unit 1 + `src/lib/validators.ts` pure functions cover the common surface. Revisit if form count passes ten or conditional-field logic (like the User type→organization toggle) proliferates.
- **Server-side pagination via cursor instead of page number** — Rejected. MSW doesn't benefit from cursors, and the existing `PaginatedResponse<T>` contract uses page numbers. Revisit when a real API replaces MSW.
- **Material Symbols Outlined web font** — Rejected per Key Technical Decisions (bundle cost + marginal visual gain).
- **Dedicated `settlementSimulator.ts` module with override hooks** — Rejected per review; inline within `handlers.ts` with a `pendingTimers` set and `flushSettlement` test hook is simpler and colocates state with the stores it mutates.
- **Hash-to-hue Avatar color** — Rejected per review; fixed 8-color palette indexed by `charCodeAt(0) % 8` is deterministic, visually varied, zero tuning.
- **`@axe-core/playwright` E2E accessibility spec** — Rejected per review; R67e accessibility requirements are covered by per-unit test scenarios (Units 5, 9, 10, 11, 15) without adding a new dev dependency. Axe audits, if wanted, are a follow-up PR.
- **Viewport-aware `/otc` splash redirect** — Rejected per review; desktop sidebar links directly to `/otc/mint` and `/otc/redeem`, so the splash is only reached via BottomNav. No viewport check, no paint flash, no resize-misbehavior.
- **Session silent-logout on stale localStorage** — Rejected per review; v1→v2 migration reads the old shape and continues authenticated wherever possible, eliminating the "every dev gets logged out on deploy" surprise.

## Success Metrics

- **S1.** Visual-fidelity audit: side-by-side comparison of each redesigned page against `back-office-usdx/*/screen.png` shows match on **layout, palette, typography, no-line tables**. Scope exclusions for v1: (a) icon set — Material Symbols vs lucide-react drift accepted per Key Technical Decisions; (b) Login left-panel hero artwork — gradient-only until v1.1 per Q6 resolution. Reviewer checklist in PR body notes these exclusions explicitly.
- **S2.** All 5 menus navigable from sidebar; Profile only reachable via navbar dropdown. Regression guard in Unit 5 tests.
- **S3.** Customer and Staff CRUD flows complete via modals; Staff creation fires "Invitation sent" toast with no password field.
- **S4.** OTC Mint and Redeem submissions transition `pending → completed` (or `failed`) without manual approval; pulsing dot + settlement toast observed.
- **S5.** Report page honors all filters + search + CSV export of filtered set.
- **S6.** Dashboard KPIs reflect live OTC store state in the same session.
- **S7.** Security posture unchanged. `pnpm audit` and manual CSP check.
- **S8.** `pnpm test` + `pnpm test:e2e` both green. Coverage on new feature code ≥ 80% statements.

## Documentation Plan

- Update root `CLAUDE.md`: overview, menu list, status flow, known limitations, adding-a-new-feature checklist (Unit 18).
- Update `src/lib/CLAUDE.md`: validator/format/status modules with new entries.
- Update `src/components/CLAUDE.md`: `DataTable` props table, Avatar entry, FieldError, TableEmptyState.
- Update `src/mocks/CLAUDE.md`: final API contract table.
- Update `README.md`: top-level feature list.
- Add a `docs/reviews/` entry when the redesign ships (post-merge retrospective — out of plan scope).

## Operational / Rollout Notes

- **No real rollout needed** — this is a pre-production mock SPA. "Ship" = merge the PR to `main`.
- **Pre-merge checklist:**
  - Login hero artwork licensing verified (per origin Q6). If blocked, merge with `variant: 'gradient'` only.
  - Full `pnpm test:all` green.
  - `pnpm build` produces a clean bundle; check for Recharts bundle size (expected ~70KB gzipped).
  - Manual walkthrough of all 6 main routes in dev mode.
  - PR description includes screenshots of each redesigned page.
- **Post-merge monitoring:** None (no prod). Team notified via standard PR merge channel.
- **Backout:** `git revert <merge commit>` — big-bang is atomic so rollback is single-commit.

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-16-azure-horizon-redesign-requirements.md](../brainstorms/2026-04-16-azure-horizon-redesign-requirements.md)
- **Design system reference:** `back-office-usdx/azure_horizon/DESIGN.md`
- **Page references:** `back-office-usdx/{back_office_login, my_profile, otc_mint, otc_redeem, reporting_dashboard, staf_management, user_management}/`
- **Key codebase anchors:**
  - `src/components/DataTable.tsx`
  - `src/mocks/handlers.ts`, `src/mocks/CLAUDE.md`
  - `src/lib/auth.tsx`, `src/lib/types.ts`, `src/lib/status.ts`, `src/lib/validators.ts`, `src/lib/format.ts`, `src/lib/csv.ts`
  - `src/components/layout/{MainLayout,Sidebar,Navbar,BottomNav,AuthGuard}.tsx`
  - `src/App.tsx`
  - `src/test/{setup,test-utils}.ts(x)`
  - `playwright.config.ts`, `e2e/`
  - Root `CLAUDE.md`
- **Recent commits relevant to cutover:** `a0a7263`, `12f48bd`, `85b5df7`, `6ec4fdd`, `da20f72` (investor-demo-polish merge + follow-ups, all superseded by this plan).
