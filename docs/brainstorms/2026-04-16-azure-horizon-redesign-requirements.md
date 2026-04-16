---
date: 2026-04-16
topic: azure-horizon-redesign
---

# Azure Horizon Redesign — USDX Back Office

Full re-skin and information-architecture overhaul of the USDX back office. Replaces the current 3-menu operator console (Dashboard, Minting, Redeem) with a 5-menu admin-class product (Dashboard, User, Staf, OTC, Report) using the **Azure Horizon** design system captured in `back-office-usdx/azure_horizon/DESIGN.md`. Brand remains **USDX**; existing USDX logo is preserved.

## Problem Frame

**Who is affected.** Operators, admins, and compliance reviewers who run USDX minting and redemption day-to-day.

**What is changing.**
1. The **visual language** is replaced with Azure Horizon (teal-anchored palette, Manrope + Inter typography, tinted shadows, no-line tables, 64px sidebar, bento grid).
2. The **information architecture** shifts from "minting/redeem approval console" to "admin panel": two directory management menus (User, Staff), a two-sub-item OTC operation menu, a reporting menu, a kept-but-redesigned Dashboard, and a profile accessible from the top navbar.
3. The **OTC transaction model** treats mint and redeem as **single-shot** operations — operator submits a form, the transaction settles asynchronously on-chain — with no "Under Review / Approved / Rejected" gate. Confirmed with the user as the v1 stance; production RBAC + rate-limiting are a v2 concern (see Key Decisions).
4. **Staff accounts** (internal users of the back office) become a managed resource, created via email invite rather than public registration.

**Why it matters.** The current UI is not acceptable as the long-term product surface. The reference designs in `back-office-usdx/` are what the user wants to ship. The redesign is simultaneously cosmetic, structural, and product-behavioral. Whether single-shot OTC (no approver-of-record) is the right operational model for USDX is listed under **Outstanding Questions → Resolve Before Planning** and is not assumed here.

## Domain Glossary

To prevent terminology drift across the rest of the document, the following terms are used with these exact meanings:

| Term | Meaning | UI surface | Type name (code) |
|------|---------|------------|------------------|
| **Customer** | End customer whose wallet receives USDX on mint or releases USDX on redeem. Managed through the "User" sidebar menu (menu label kept for user-requested familiarity). | `/users` table, "Select User" on OTC Mint | `Customer` |
| **Staff** | Internal back-office operator/admin who logs in and submits operations. Managed through the "Staf" sidebar menu. | `/staff` table, navbar profile dropdown, `/profile` page | `Staff` |
| **Operator** | The currently-logged-in Staff record. "Submitted by" attribution on an OTC transaction is the operator. | — | (runtime identity, typed as `Staff`) |
| **Ghost** (UI term) | Unfilled / outline-only component style at low contrast (e.g., "ghost button", "ghost field", "ghost list") used for secondary or read-only contexts. Defined in Azure Horizon via 15% outline-variant borders on `surface-container-lowest`. | — | — |

The existing `src/lib/types.ts User` type is renamed to `Staff` (it models the logged-in identity) as part of the migration; a new `Customer` type models the end-customer directory. This glossary resolves the overloaded meaning of "user" that otherwise runs through R21/R24/R30/R50/R51/R65.

## Visual Aid — Menu Structure

```
Top Navbar (sticky, backdrop blur)
┌────────────────────────────────────────────────────────────────────────┐
│ USDX logo  |  Breadcrumb  |  Search  |  🔔  ⚙  |  [JA Julian Anderson ▾] │  ← profile dropdown lives here
└────────────────────────────────────────────────────────────────────────┘

Sidebar (64px, surface-container-low)   Main Content
┌───────────────┐                       ┌──────────────────────────────┐
│ 🏠 Dashboard  │                       │                              │
│ 👤 User       │                       │      (page content)          │
│ 👥 Staf       │                       │                              │
│ ⇅ OTC     ▾  │                       │                              │
│    • Mint     │                       │                              │
│    • Redeem   │                       │                              │
│ 📊 Report     │                       │                              │
│               │                       │                              │
│ ─────────     │                       │                              │
│ System Status │                       │                              │
│ ● Operational │                       │                              │
└───────────────┘                       └──────────────────────────────┘

Profile page is reached from the navbar dropdown (not from the sidebar).
```

## Visual Aid — OTC Transaction Lifecycle (single-shot)

```
   operator submits form
          │
          ▼
      [ Pending ]  ──── on-chain failure ───▶ [ Failed ]  (terminal)
          │
          ▼  (network confirms)
     [ Completed ] (terminal)
```

No human approver. No "Under Review". No "Rejected". Status is derived from settlement, not from gate-keeping.

---

## Requirements

### Design System Adoption

- **R1.** Adopt the Azure Horizon color palette as defined in `back-office-usdx/azure_horizon/DESIGN.md` (primary `#006780`, primary-container `#1eaed5`, surface `#f5fafd`, surface-container-low `#eff4f7`, on-surface `#171c1f`, error `#ba1a1a`, etc.). The existing brand primary `#1eaed5` is retained as the **primary-container** token (CTAs use a 135° gradient from `#006780` to `#1eaed5`).
- **R2.** Adopt Manrope for headlines (weights 500–800) and Inter for body and labels (weights 300–700). Never use bold for emphasis; hierarchy comes from size and color.
- **R3.** Adopt Azure Horizon structural tokens: radii 4/8/12/9999, primary-tinted ambient shadow `0 12px 40px rgba(0,103,128,0.06)`, ghost field borders (outline-variant at 15% opacity on `surface-container-lowest`), focus ring 2px primary + 4px blur.
- **R4.** Adopt the "no-line" table pattern: no row dividers, `surface-container-highest` on row hover, uppercase letter-spaced column headers.
- **R5.** Adopt Material Symbols Outlined as the primary icon set (matches reference designs). Existing `lucide-react` usage is replaced where a page is redesigned; incidental non-page uses may remain until touched.
- **R6.** The USDX logo (existing asset) is used everywhere a logo appears. The reference designs' "StableCore" branding and "CORE" token name are **not** adopted — all references stay "USDX".

### Information Architecture

- **R7.** The sidebar contains exactly five top-level items in this order: **Dashboard, User, Staf, OTC, Report**. OTC expands to two sub-items: **OTC Mint** and **OTC Redeem**.
- **R8.** Profile is **not** a sidebar menu item. It is reached from a profile dropdown in the top navbar (initials avatar + name, click to open dropdown with "View Profile" and "Logout").
- **R9.** The app routes are: `/login`, `/dashboard`, `/users`, `/staff`, `/otc/mint`, `/otc/redeem`, `/report`, `/profile`. Unknown routes redirect to `/dashboard` (for authenticated users) or `/login` (otherwise).
- **R10.** After successful login, the user lands on `/dashboard`. `/dashboard` is the default landing page.
- **R11.** The navbar shows a breadcrumb that reflects current location (e.g., "Operations / OTC Minting"), a search input, a notifications icon with unread badge, a settings icon, and the profile dropdown.
- **R12.** The sidebar shows a "System Status" card at the bottom with an operational indicator (green dot + "Node Operational" label).

### Login Page

- **R13.** Split-screen layout at >=1024px: left 50% brand panel with blue-pulse gradient background (135° from `#006780` to `#1eaed5`) and the reference's abstract 3D data-waves visualization (per Q6 decision — asset licensing must be verified before merge; fallback is a solid gradient panel). Right 50% login form on surface background. Below 1024px the brand panel is hidden and the form fills the viewport.
- **R14.** Left panel contains: USDX logo (existing asset) in white, headline "The next era of USDX Management" with a cyan accent word, and a supporting subtitle. The reference designs' "SECURE NODE / AES-256 / V3 CORE" security badges are **not** adopted — "V3 CORE" conflicts with the USDX-only brand rule (R6), and "AES-256" is a marketing claim with no implementation behind it in this product.
- **R15.** Right panel contains: "Welcome Back" headline, email field (icon-leading, placeholder `admin@usdx.io`), password field (icon-leading, visibility toggle button on right), "Remember this device for 30 days" checkbox, primary "Secure Login" button (gradient, full-width, rounded-xl, arrow icon). **No "Forgot password?" link** — that link is removed to match R17 (the page it would target is also removed).
- **R16.** Footer under the form shows Help Center · Privacy Policy · Terms as bullet-separated muted links.
- **R17.** Public self-service **Register** and **Forgot Password** pages are removed from the product. Registration is admin-driven (see Staff Management). In mock mode there is no password-recovery UI; production recovery is explicitly out of scope for v1 and deferred.

### Dashboard

- **R18.** Dashboard shows, at the top, a headline ("Operations Overview") and a brief one-line context string.
- **R19.** Dashboard shows four KPI cards in a bento grid: **Total Mint Volume (30d)**, **Total Redeem Volume (30d)**, **Active Users**, **Pending Transactions**. Each card shows the primary metric (large), a supporting label, and a trend indicator (↑/↓ % vs previous period) where applicable.
- **R20.** Dashboard shows a **Volume Trend** chart (mint vs redeem, last 30 days, stacked or dual-line). The exact chart library is a planning decision.
- **R21.** Dashboard shows a **Recent Activity** list of the last 8 OTC transactions (mint + redeem interleaved) with type badge, amount, network, operator, relative timestamp, and status badge.
- **R22.** Dashboard shows a **Network Distribution** breakdown (per-network transaction share for the last 30 days).
- **R23.** The Dashboard performs no mutations (no forms, no confirm modals — all data-changing actions live on their feature pages). Cross-page deep-linking from KPI cards to pre-filtered Report views is **out of scope for v1** — KPI cards render as static tiles. If users need to investigate a KPI, they navigate to Report manually.

### User Management (end-customer directory)

- **R24.** `/users` landing view is a **table** of end-customers, preceded by three summary cards: **Total Users**, **Active Now**, **Organizations Managed**.
- **R25.** Table columns: Name (with avatar + initials), Email, Phone, Type (Personal/Organization with distinct badge colors), Organization, Role, Actions (edit/delete icons, revealed on row hover).
- **R26.** Table supports: free-text search (name/email), Type filter (All/Personal/Organization), Role filter, server-side pagination, server-side sort. Filter state is persisted in URL query params (consistent with existing `DataTable` convention).
- **R27.** A primary **"Add User"** button sits in the table toolbar. Clicking it opens a modal with the form:
  - First Name, Last Name (required)
  - Email (required, email format), Phone (required, with country code prefix input)
  - **User Type** dropdown: Personal | Organization (required)
  - **Organization** text field (required only when Type = Organization; hidden or disabled otherwise)
  - **Role** selection as three bordered radio cards: **Admin** ("Full system access"), **Editor** ("Manage content & users"), **Member** ("Read-only permissions", default checked)
  - Cancel and "Create User" footer buttons
- **R28.** Edit uses the same modal pre-filled with the row's data. Submit label changes to "Save Changes".
- **R29.** Delete triggers a confirmation dialog ("Delete user `<name>`? This cannot be undone.") with destructive-style confirm button. In mock mode it removes the row from the mock store.
- **R30.** User records are the source of truth for the "Select User" dropdown on the OTC Mint form.

### Staff Management (internal back-office team)

- **R31.** `/staff` landing view is a **table** of internal staff, preceded by three summary cards: **Total Staff**, **Admins**, **Active Now**.
- **R32.** Table columns: Name (with avatar + initials), Email, Phone, Role (colored badge), Actions (edit/delete icons, revealed on hover).
- **R33.** Table supports: free-text search (name/email), Role filter, server-side pagination, server-side sort. Filter state persists in URL query params.
- **R34.** A primary **"Add Staff"** button sits in the table toolbar. Clicking it opens a modal with the form:
  - First Name, Last Name (required)
  - Email (required, email format) — this becomes the login identity
  - Phone (required, country code prefix)
  - **Access Role** dropdown: Support Agent | Operations Manager | Compliance Officer | Super Admin (required)
  - Cancel and "Create Staf" footer buttons
  - **No password field.** Submission triggers an **email invite** flow: in mock mode a toast confirms "Invitation sent to `<email>`" and the staff row appears immediately as an active staff member. No "Pending Invite" state machine, no mock accept-toggle, no conditional field behavior — the demo phase does not model invite lifecycle. The real invite lifecycle (token entropy, single-use, expiry, resend) is a v2 concern and is noted in Scope Boundaries.
- **R35.** Edit uses the same modal pre-filled with the row's data. Email remains editable. Submit label changes to "Save Changes".
- **R36.** Delete triggers a confirmation dialog and removes the staff row in mock mode. No role-aware guards in v1 (consistent with R67 "RBAC not enforced"). The "delete the last Super Admin" and "delete self" prohibitions are v2 concerns.
- **R37.** The logged-in operator appears in the Staff table (they are staff). In v1 they can delete themselves; doing so routes them back to `/login` (safe failure mode in mock).

### OTC Mint

- **R38.** `/otc/mint` is an operation page (not a queue). The layout is a 12-column bento: **Mint form on the left (col-span 8)**, **info panel on the right (col-span 4)**, **Recent Requests list inside the right panel**.
- **R39.** Mint form fields (all required unless noted):
  - **Select User** — typeahead dropdown sourced from User Management (searches by name or email), shows avatar + name + email in options.
  - **Network** — dropdown: Ethereum | Polygon | Arbitrum | Solana | Base.
  - **Mint Amount** — large numeric input with "USDX" suffix label; helper line below shows available supply headroom and the applicable OTC fee.
  - **Destination Wallet Address** — text input with wallet icon; below-field indicator "Auto-checksum validation active". Invalid addresses block submit.
  - **Internal Notes** — textarea (optional). Placeholder guides toward reference/treasury IDs.
  - Submit button: full-width, gradient, "Confirm Mint Request" label with send icon.
- **R40.** The right info panel contains three stacked cards:
  - **Minting Protocol** guidance card with three check-listed assurances (settlement immediacy, zero slippage, automated compliance check).
  - **Vault-Grade Protection** visualization card (dark gradient background with USDX security copy).
  - **Recent Requests** ghost list — last 5 mint submissions by this operator, each showing amount + network + status dot + relative timestamp.
- **R41.** Submitting the form creates an OTC Mint transaction with status `pending`. A success toast confirms submission ("Mint request submitted"). The Recent Requests list updates immediately. No approval modal appears. Settlement is asynchronous — `pending` transitions to `completed` or `failed` without any further operator action. **User-facing feedback (per Q8 decision):** while a row is `pending`, its status dot pulses gently (CSS animation). On transition the row re-renders with its final status dot, and a follow-up toast fires ("Mint completed" on success / "Mint failed" on error). Auto-refresh is driven by TanStack Query invalidation — no manual reload. The exact simulation mechanism (handler-side `setTimeout`, query polling interval, or a debug control) is a planning decision.
- **R42.** OTC Mint transactions appear in the Report table and contribute to Dashboard KPIs.

### OTC Redeem

- **R43.** `/otc/redeem` mirrors OTC Mint's layout: **Redeem form on the left (col-span 7)**, **info panel on the right (col-span 5)**, **Recent Redemptions table full-width below**.
- **R44.** Redeem form fields (all required):
  - **Amount to Redeem** — large numeric input with "USDX" suffix and a "MAX" helper button; available balance shown below. "MAX" populates the field with the full available balance. Amounts that exceed the balance are rejected inline before submit; the submit button disables until the amount is valid.
  - **Destination Network** — dropdown: Ethereum | Polygon | Arbitrum | Solana | Base (per Q5 decision, Redeem mirrors Mint for parity — prevents stranded USDX on any supported network).
  - An info alert box describes the Institutional Treasury Vault flow and wallet whitelisting rule.
  - Submit button: full-width, gradient, "Confirm Redemption" label.
- **R45.** The right info panel contains:
  - **Operations Guide** card with dark gradient image and a daily cap + exceeds-cap instruction line.
  - **Meta Grid** with two small cards: Redeem Fee, Slippage (static mock values).
  - The reference's "Treasury Liquidity" card (Total Reserves figure, health-bar, USDC/USDT sub-cards) is **not** adopted — USDX mock data has no reserve-composition model, and adopting the card would force inventing a treasury domain purely to populate a visual. Revisit if/when real treasury data becomes available.
- **R46.** The full-width **Recent Redemptions** table below has columns: Transaction ID (truncated hex), Amount, Network (colored dot + name), Timestamp, Status. Shows the last 5 redemptions visible to the operator.
- **R47.** Submitting creates an OTC Redeem transaction with status `pending`. Settlement is asynchronous with identical mechanics to Mint (R41) — pulsing status dot while pending, settlement toast on transition, auto-refresh via query invalidation.
- **R48.** OTC Redeem transactions appear in the Report table and contribute to Dashboard KPIs.

### Reporting

- **R49.** `/report` is a full-width reporting page with a filter bar, data table, pagination, and a trailing insights bento.
- **R50.** Filter bar controls, left-to-right:
  - **Date Range** — two date inputs (start / end), default = last 30 days.
  - **Transaction Type** — dropdown: All | Mint | Redeem.
  - **Customer** — typeahead sourced from User Management (Customer directory). Filter selects transactions whose `customerId` matches the chosen customer. Operator attribution is stored on the record but is not a v1 filter axis (per Q3 decision).
  - **Status** — segmented button group: All | Pending | Completed | Failed.
  - **Search** — free-text input (matches transaction ID, user name, wallet address).
  - A secondary filter icon (gear) opens an advanced filter drawer (future; out of scope for v1 — see Scope Boundaries).
- **R51.** Table columns: Date, Transaction ID (truncated hex + copy-on-click), Type (colored badge), Customer (avatar + name — shows the `customerName` snapshot per R67g), Network, Amount, Status.
- **R52.** Export action in the page header: **Export CSV** (ghost button, client-side, current filter set only). PDF export is **out of scope for v1** (see Scope Boundaries) — the reference's "Export PDF Report" button is not rendered.
- **R53.** Below the table, three insight cards in a bento: **Total Volume** (period), **Active Minters** (distinct users with mint in period), **Flagged Transactions** (failed + any manual flags). Each card shows a trend arrow vs previous period.
- **R54.** Filter state, pagination, and sort are all persisted in URL query params.

### Profile

- **R55.** `/profile` is reached from the navbar profile dropdown. No sidebar entry. The page is a rewrite of the existing `src/features/profile/ProfilePage.tsx` — not a greenfield file.
- **R56.** Layout uses the reference's 12-column bento: left column (col-span 4) = identity + contact; right column (col-span 8) = Account Settings panel only. The reference's 4-tab strip (Account Settings / Security & Privacy / Permissions / Integrations) is **not** adopted in v1 — shipping three placeholder tabs provides no user value in an operator tool. The panel renders directly with no tab chrome; a tab strip can be added in v2 when additional content exists.
- **R57.** Identity card shows: large circular avatar (initials on a colored background — no uploaded images in v1), full name, and role label. The reference's "Verified Admin" badge, Employee ID, Department, and Joined Date fields are **not** adopted — they require fabricated mock data with no operational meaning in a v1 demo.
- **R58.** Contact card ("Connect") shows: work email and phone number from the Staff record.
- **R59.** The right panel renders a Personal Details two-column form (Full Legal Name, Display Name, Regional Access, Timezone). In mock mode the "Save" action persists to the in-memory Staff store and fires a success toast.
- **R60.** Below the form, a Security Access group displays a Password Security row with a "Change Password" button and a Two-Factor Authentication toggle. Both are **rendered disabled** with a tooltip "Available after v1" because password rotation and MFA are out of scope per the Scope Boundaries. No dead modal, no no-op toggle.
- **R61.** Below the form, a **Recent Activity Summary** timeline shows this operator's last 3 actions (e.g., "Submitted OTC Mint", "Updated Profile") with icon + relative timestamp. Activity is derived from the OTC transaction store filtered by operator; seeded via mock data for initial-load density.
- **R62.** The page header shows a single action: **Export Logs** (ghost button). The reference's "Update Status" gradient button is **not** adopted — the feature has no defined v1 behavior.
- **R63.** Reserved. (No placeholder tabs to specify.)

### Auth and Session (mock phase)

- **R64.** Login accepts any non-empty email + password in mock mode. The login form validates field presence and basic email format. The existing `src/lib/auth.tsx` currently enforces hard-coded demo credentials (`DEMO_USER.email`, `DEMO_PASSWORD`) — that constraint is **relaxed** to match this requirement.
- **R65.** The logged-in identity is a **Staff** record (per the Domain Glossary). Navbar profile dropdown and Profile page both read from this staff record.
- **R66.** Sign-out clears the mock session and navigates to `/login`.
- **R67.** RBAC is **not enforced** in v1. All five menus are visible to any authenticated user. No role-aware guards anywhere (consistent with R36 and the Scope Boundaries entry below).
- **R67a.** The existing `AuthContext` surface is updated to match: the `register` and `forgotPassword` methods are removed (no consumers after R17/R70); `login(email, password)` accepts any non-empty input; `logout()` clears session and navigates to `/login`. Existing unit tests in `src/lib/__tests__/auth.test.tsx` are rewritten accordingly.

### UI Patterns (applies to all pages)

- **R67b.** **Form error states** — every form in the product declares: (a) inline field error message below the field with `text-error` color when validation fails, (b) submit button enters a loading state (spinner + "Submitting…") for the duration of the mutation and disables resubmit, (c) an API error produces a single error-variant toast with the server message or a generic fallback. This applies to the login form (R15), Add/Edit User modal (R27), Add/Edit Staff modal (R34), OTC Mint (R39), OTC Redeem (R44), and the Profile Personal Details form (R59).
- **R67c.** **Empty states** — every list view declares: (a) zero-data empty state (no rows exist at all) with an illustrative icon, short copy, and a primary CTA where applicable (e.g., "Add User" on `/users`), (b) zero-results-after-filter empty state with "No results match these filters. Clear filters." link. Applies to User (R24), Staff (R31), Report (R51), Recent Requests list (R40), Recent Redemptions table (R46).
- **R67d.** **Toast/notification pattern** — shadcn `Sonner` (already installed per `src/App.tsx`) is the canonical toaster. Position: top-right. Auto-dismiss: 5s for success/info, 8s for error. Four variants: success, error, info, warning. Used for form-submission confirmations (R41, R47), invite-sent confirmation (R34), and API error fallback (R67b). The notifications bell badge (R11) is cosmetic-only in v1 — its count is a static mock value; the dropdown renders an empty-state panel.
- **R67e.** **Accessibility and keyboard** — all modals use shadcn `Dialog` (Radix under the hood) for focus trap + Esc-to-close + focus-return-to-trigger by default. Icon-only buttons (edit/delete row actions in R25, R32; visibility toggle in R15; filter gear in R50) carry `aria-label` strings matching their tooltip text. The Status segmented control in R50 uses `role="group"` with `aria-label="Status filter"`. Inline-action icons that appear on row-hover are also keyboard-focusable via table-row focus (do not gate visibility purely on CSS hover).
- **R67f.** **Status vocabulary is authoritative in code** — the canonical status values for OTC transactions are `pending | completed | failed` (per R71). The reference HTML copy (`Success`, `Active`) is a display-rendering choice, not a data contract. UI labels may read "Success" in a badge (mapped in `src/lib/status.ts`) but the type, the MSW payload, and the URL query param are always `completed`.
- **R67g.** **Historical transaction user-name snapshot** — every OTC transaction record stores the Customer's display name as a snapshot at submission time (in addition to a `customerId` foreign key). Deleting a Customer (R29) does not rewrite historical transactions; the Report row continues to render the snapshotted name. This prevents dangling references on the Report page after customer deletion.

### Migration and Compatibility

- **R68.** This is a **big-bang redesign** at the UI layer: the redesign lands as one coherent change, not a feature-flagged rollout. The entire set of file changes in R69–R74c must land together in a single commit (or a tightly-sequenced PR stack that produces no green-then-broken intermediate state on main), because dropping the approval vocabulary breaks type-check and tests project-wide.
- **R69.** Existing `src/features/minting/` and `src/features/redeem/` directories are removed. Their MSW handlers in `src/mocks/handlers.ts` and mock data factories in `src/mocks/data.ts` are rewritten to model the OTC transaction shape + Customer + Staff directories. `src/features/dashboard/DashboardPage.tsx` is rewritten in place (not removed). `src/features/profile/ProfilePage.tsx` is rewritten in place. `src/features/auth/LoginPage.tsx` is rewritten in place (the recent visibility-toggle from commit `6ec4fdd` is preserved).
- **R70.** Existing `src/features/auth/RegisterPage.tsx` and `src/features/auth/ForgotPasswordPage.tsx` are removed. Routes `/register` and `/forgot-password` are removed from `src/App.tsx`.
- **R71.** Status utilities in `src/lib/status.ts` that model the approval workflow (`canApprove`, `canReject`, `canStartReview`, `under_review`, `approved`, `rejected`) are removed. The presented status vocabulary is reduced to `pending | completed | failed`. Whether the **data-model** status enum should be narrowed or left extensible (sidecar `review_state`) is under **Outstanding Questions → Resolve Before Planning** — the decision affects future institutional-customer readiness.
- **R72.** The theme tokens in `src/index.css` are replaced wholesale with the Azure Horizon palette. The existing `#1eaed5` becomes `--color-primary-container`; the new primary is `#006780`. Manrope is added to the font loader in `index.html`.
- **R73.** The existing shared `DataTable` component is retained as a generic table, restyled to the Azure Horizon "no-line" convention (no row borders, hover wash, uppercase headers). Its URL-state API for `page`/`sortBy`/`sortOrder`/`search` is preserved; the existing single-`statusOptions` prop is extended to accept an arbitrary filter-toolbar slot so User (Type+Role), Staff (Role), and Report (Date+Type+User+Status) filter bars can be composed per page without forking the component.
- **R74.** The existing mobile `BottomNav` is retained in form and updated per Q4 decision: four fixed items — **Dashboard**, **OTC**, **Report**, **More**. Tapping **OTC** lands on a new `/otc` splash page with two large primary buttons ("OTC Mint" and "OTC Redeem") — a new route is added to `src/App.tsx` for this splash. Tapping **More** opens a bottom drawer containing **User**, **Staf**, and **Profile**. Desktop sidebar continues to show all five menus as before (R7).
- **R74a.** **Files that must be removed or rewritten in the same change** (non-exhaustive, derived from repo scan): `src/features/minting/`, `src/features/redeem/` (delete); `src/features/auth/RegisterPage.tsx`, `src/features/auth/ForgotPasswordPage.tsx` (delete); `src/lib/__tests__/status.test.ts` (rewrite — drops approval-helper tests); `src/lib/__tests__/validators.test.ts` (rewrite — drops `validateRegisterForm` and `validateForgotPasswordForm` cases); `src/lib/CLAUDE.md` (rewrite — drops `canApprove`/`canReject`/`canStartReview` references); `e2e/main-flow.spec.ts` (rewrite — replaces `/minting` + `/redeem` flow with new OTC flow); any auth E2E specs covering `/register` or `/forgot-password` (remove). The root-level `CLAUDE.md` is updated: menu list, status flows section, and "Known Limitations" list are rewritten to match.
- **R74b.** The CSP `<meta>` tag in `index.html` is amended if (and only if) new asset sources are introduced. Verified: the current CSP already allows `fonts.googleapis.com` (style-src) and `fonts.gstatic.com` (font-src), so Manrope via Google Fonts needs no CSP change. Material Symbols Outlined served from the same Google origin is also covered. If a self-hosted font or icon is adopted instead, no CSP change is needed (served from `'self'`). No CSP relaxation is acceptable.
- **R74c.** A new E2E smoke spec `e2e/smoke.spec.ts` (or equivalent) covers: login → dashboard → add-user → submit-mint → see-in-report. This replaces the scope of the removed `main-flow.spec.ts`.

## Success Criteria

- **S1.** A visual-fidelity audit against the `back-office-usdx/` reference screenshots shows the redesigned pages match on layout, palette, typography, and the no-line table pattern.
- **S2.** All five menus and their pages are navigable from the new sidebar; the profile page is only reachable from the navbar dropdown.
- **S3.** An operator can add/edit/delete users and staff through the modal flows; adding a staff member triggers the mock "invite sent" path, not a password-set path.
- **S4.** An operator can submit OTC Mint and OTC Redeem forms; submissions appear immediately as `pending` and transition to `completed` (or `failed`) without any manual approval step.
- **S5.** The Report page lists all OTC transactions, honors date/type/user/status filters and search, persists filter state in the URL, and exports the filtered set to CSV.
- **S6.** The Dashboard shows live counts and trends derived from the OTC transaction store.
- **S7.** Security posture is preserved: no new `dangerouslySetInnerHTML`, no `eval`, no inline script, all `target="_blank"` links carry `rel="noopener noreferrer"`, `X-Frame-Options: DENY` and `X-Content-Type-Options: nosniff` unchanged. The CSP `<meta>` is amended only if required by new asset sources per R74b; any such amendment must be additive and justified in the PR description.
- **S8.** Type-check (`pnpm build`) and lint (`pnpm lint`) pass. Unit-test suite passes. A new E2E smoke spec covers: login → dashboard → add-user → submit-mint → see-in-report.

## Scope Boundaries

**Feature scope (not built in v1):**
- RBAC enforcement (menu visibility / action gating per role). Roles are stored on Staff records but not read by any predicate.
- Cross-page deep-links from Dashboard KPI cards to filtered Report views.
- Advanced filter drawer on the Report page.
- Profile secondary tabs (Security & Privacy / Permissions / Integrations) — entirely removed, not placeholder.
- Notifications bell dropdown content (icon + static badge count only).
- PDF export on the Report page — CSV only in v1.
- Password reset UI and MFA enforcement — v1 has no recovery path (demo only).
- "Update Status" button on Profile.
- Pending Invite lifecycle, invite expiry, invite resend — staff are created as immediately-active in mock.
- "Last Super Admin" and "delete self" deletion guards.
- Treasury reserve composition data model on OTC Redeem.
- Wallet-address confirmation-modal second-eye step before OTC submit.

**Delivery scope (deferred to v2 / production):**
- Real email delivery for staff invites; real invite token entropy, single-use, expiry.
- Production auth mechanism (OIDC / SAML / JWT — v1 mock accepts any non-empty credentials).
- Session expiration, idle logout, MFA enforcement, password rotation.
- Audit log for deletions, mutations, exports.
- Access-control and PII-redaction on CSV export.
- Multi-language support.

**Planning decisions (deliberately not decided here):**
- Chart library for Dashboard trend chart.
- Phone input library (international vs plain text with country code).
- Icon strategy (Material Symbols Outlined web font vs staying on `lucide-react`).
- Async settlement simulation mechanism (handler-side `setTimeout` vs polling vs debug control).
- Per-page responsive breakpoints and mobile stacking order (beyond BottomNav item set, which is in Open Questions).

## Key Decisions

- **Dashboard is retained as the landing page.** Report is a separate deep-dive menu. Reason: the two have different intents (overview vs investigation) and collapsing them would force the landing page to do both jobs poorly. *Alternative considered:* collapse into a single "Reporting" page with a sticky KPI strip — rejected because KPI cards and a trend chart don't fit cleanly above a filterable table. Revisit if the two pages drift together over time.
- **Profile is accessed via the navbar dropdown, not the sidebar.** One canonical location, keeps the sidebar focused on operational menus.
- **Staff are created via email invite (no password field).** Avoids distributing passwords out-of-band and matches the reference design. *Caveat:* this is a UI decision, not a governance decision. Invite-authorization (who can invite a Super Admin) is **not** resolved here — it is downstream of Q1 (control model).
- **USDX branding is preserved.** Reference designs' "StableCore" / "CORE" strings and marketing badges ("V3 CORE", "AES-256") are template placeholders; the product is USDX.
- **The existing `#1eaed5` is re-homed as `primary-container`, not primary.** Azure Horizon's anchor is `#006780`; `#1eaed5` is the action accent. The brand-familiar cyan survives in CTAs via the 135° gradient while the darker teal carries the editorial weight of the redesign.
- **Big-bang UI migration.** All file changes in R68–R74c land together. *Alternatives considered:* (a) parallel-route prefix (`/v2/*`) until parity is verified; (b) page-at-a-time cutover; (c) feature-flagged theme. All rejected as transitional scaffolding cost for a small-surface SPA. *Caveat:* this choice is conditional on Q7 (investor-demo cutover). If the demo surface must stay operational, option (a) becomes the right choice.

**Decisions confirmed during document review** (Q1–Q8 resolved):

- **[Q1] OTC is single-shot with no safeguards in v1.** Accepted as the v1 stance: mock auth, any authenticated user can submit unbounded mints/redeems, no RBAC, no daily cap, no second-eye confirmation. The compound risk (unilateral authority) is explicitly documented under "Known v1 Risks" below. Production rollout requires RBAC, per-operator caps, and an authorization model — these are v2 prerequisites, not v1 features.
- **[Q2] Status enum is narrowed to `pending | completed | failed` in both UI and data model.** No sidecar. Approval vocabulary is deleted cleanly (R71 stands as written). If a future institutional-tier product requires approval, it is a deliberate v2 re-introduction with a schema migration.
- **[Q3] Report User filter and Report avatar column reference the Customer.** Transactions carry `customerId` plus a `customerName` display snapshot (R67g). Operator attribution is preserved in the record but is not a filter axis in v1.
- **[Q4] Mobile BottomNav = four items + More drawer.** Fixed items: Dashboard, OTC, Report, More. Tapping OTC lands on a `/otc` splash with two large Mint/Redeem buttons. More opens a drawer containing User, Staf, Profile. Route `/otc` is added to the router.
- **[Q5] OTC Redeem network list mirrors Mint** — Ethereum, Polygon, Arbitrum, Solana, Base. Redeem-Solana parity prevents stranded USDX.
- **[Q6] Login left-panel visualization reuses the reference's abstract 3D data-waves artwork.** Asset licensing must be verified before merge — flagged in Dependencies as the only residual blocker. If licensing cannot be cleared, fallback is the solid gradient panel with centered logo.
- **[Q7] Big-bang cutover lands directly on `main`.** Investor demo window is closed; no parallel routes, no tag snapshot needed. R68–R74c land as a single coherent change.
- **[Q8] Settlement feedback = pulsing status dot during `pending`, toast on transition to `completed` or `failed`.** Auto-refresh via TanStack Query invalidation. No manual reload required.

**Known v1 Risks (accepted with user confirmation on Q1):**

The following compound posture ships in v1 mock mode intentionally and is documented so any future security review has the delta explicit:

1. Any non-empty email + password authenticates (R64).
2. All five menus are visible and fully functional for any authenticated user (R67).
3. OTC Mint and Redeem submit straight to settlement with no approver, no cap, no confirmation (R41, R47).
4. Any authenticated user can invite a Super Admin via email (R34) with no second approver.

The combined effect is that v1 has **no meaningful authorization layer**. This is acceptable for mock/demo use and unacceptable for production. The production rollout checklist must include: an IdP-backed auth mechanism, RBAC on every action, invite-authorization (who can invite which role), per-operator transaction caps, and an append-only audit log.

## Dependencies / Assumptions

**Assets and CSP:**
- Manrope is added to the font loader in `index.html` via Google Fonts (same origin family as existing Inter). Verified: current CSP in `index.html` already allows `style-src https://fonts.googleapis.com` and `font-src https://fonts.gstatic.com`, so no CSP amendment is needed for Manrope.
- If Material Symbols Outlined is adopted (planning decision — see Scope Boundaries), it is served from the same `fonts.googleapis.com` origin, also already CSP-allowed. No `unsafe-inline`/`unsafe-eval` relaxations are acceptable.
- Existing security headers (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`) remain unchanged.

**Code surface:**
- Mock auth session returns a `Staff` record (per Domain Glossary). `src/lib/types.ts` `User` is renamed to `Staff`; a new `Customer` type is added for the end-customer directory.
- `src/lib/__tests__/auth.test.tsx` is updated to reflect the relaxed login and the removal of `register`/`forgotPassword` from the context.
- MSW handlers in `src/mocks/handlers.ts` are regenerated to model: `Customer[]`, `Staff[]`, `OtcMintTransaction[]`, `OtcRedeemTransaction[]`. Dashboard KPIs and Report rows derive from these stores — no separate "dashboard" or "report" mock entity.
- Existing `DataTable` component has its filter-toolbar surface extended (see R73); URL-state for page/sort/search is preserved.

**Investor demo impact (resolved per Q7):**
- Recent git history (`a0a7263`, `12f48bd`, `da20f72`, `6ec4fdd`, `85b5df7` — the `investor-demo-polish` merge and follow-ups) shows the demo window has closed. Big-bang lands directly on `main`; no parallel routes, no tag snapshot needed. If a historical demo replay is required later, `git checkout <pre-redesign-sha>` from history is sufficient.

**Assumed but not verified (flag to planning):**
- End-customer records ("User" menu) have no login credentials in v1 — they are directory entries referenced by OTC transactions, not authenticatable principals. If the product later allows customers to log in (a customer portal), the Customer type grows a credential column. Confirming this is directory-only in v1 is assumed.

**Reference boundary:**
- Reference screenshots in `back-office-usdx/*/screen.png` are the visual-fidelity benchmark. The embedded `code.html` files are reference implementations, not copy-paste targets. Where reference strings conflict with product reality (e.g., "StableCore"/"CORE" branding, reference status labels `Success`/`Active`), the product's canonical vocabulary supersedes per R6 and R67f.

## Outstanding Questions

### Resolve Before Planning

All eight blocking questions (Q1–Q8) were resolved with the user during document review. The resolutions are recorded under "Decisions confirmed during document review" in the Key Decisions section above. This section is now empty — planning is not blocked on product decisions.

One residual task remains before merge (not a planning blocker, but a delivery blocker):

- **Asset licensing verification for Q6.** The reference's 3D data-waves visualization (`back-office-usdx/back_office_login/screen.png`) may be stock or proprietary. Before merging the redesigned login page, confirm the asset's license permits reuse in the USDX product. If it cannot be cleared, fall back to the solid-gradient-only variant in R13.

### Deferred to Planning

Technical choices with real tradeoffs that belong in the planning document, not the brainstorm.

- **[Affects R20][Technical]** Charting library for the Dashboard Volume Trend chart (Recharts / Chart.js / Visx / custom) — tree-shakable, palette-compatible, responsive.
- **[Affects R27, R34][Technical]** Phone input — dedicated international library (`react-phone-number-input`) vs plain text with country-code prefix.
- **[Affects R5][Technical]** Icon strategy — Material Symbols Outlined web font vs mapping to existing `lucide-react`.
- **[Affects R9][Technical]** File/folder layout of the new `src/features/` (e.g., `users/`, `staff/`, `otc/mint/`, `otc/redeem/`, `report/`).
- **[Affects R25, R32][Technical]** Avatars: initials-only (default assumption) vs uploaded images with initials fallback.
- **[Affects R19, R53][Needs research]** Exact derivation rules for "Active Users", "Active Minters", "Active Now", "Flagged Transactions" metrics.
- **[Affects R74b][Technical]** If PDF export is reintroduced in v2, the library choice (`jspdf` + `jspdf-autotable` / `react-pdf` / server-side) must use dynamic import to keep the Report route's initial bundle unaffected.

## Next Steps

All blocking product decisions are resolved. `-> /ce:plan` for structured implementation planning. The planning document should sequence R68–R74c as a single coherent change, name the chart / phone-input / icon libraries from the Deferred list, and specify the simulation mechanism for async settlement. The asset-licensing check for the login hero artwork is tracked as a pre-merge task, not a planning input.
