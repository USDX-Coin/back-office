---
date: 2026-03-28
topic: investor-demo-polish
---

# Investor Demo Polish

## What We're Building

A complete UI/UX polish pass on the USDX Back Office to make it investor-ready:
replace placeholder logos, redesign the login page with a professional split-panel layout,
lock auth to a single demo user, upgrade mock data to look production-realistic,
fill out the dashboard layout, add a Profile page, and fix the profile dropdown overlay.

## Scope

### 1. Logo Implementation
Replace every `<span>U</span>` placeholder with the real `Logo.svg` (`public/image/Logo.svg`).

**Touchpoints:**
- `Navbar.tsx` — top-left brand mark
- `LoginPage.tsx` — center card icon
- `Sidebar.tsx` — optional logo at top of sidebar panel

### 2. Login Page Redesign
**Current:** Basic centered Card on plain background.

**New design — split layout:**
- **Left panel (60%):** Brand panel with dark/gradient background, USDX logo, tagline, decorative elements (subtle grid, accent colors)
- **Right panel (40%):** White form panel with email + password, "Sign in" CTA
- Remove "Create account" and "Forgot password?" links (not relevant for investor demo)
- Responsive: stacks vertically on mobile (form on top, brand panel below or hidden)

### 3. Auth System — Single Demo User
**Current:** Accepts any non-empty credentials.

**New:** Validate against one hardcoded credential set:
- **Email:** `admin@usdx.com`
- **Password:** `Admin@2024!`
- **Display name:** `Administrator`
- **Role:** `Admin`

Wrong credentials → clear error message: "Invalid email or password."
Remove `register()` and `forgotPassword()` from public routes (routes still exist but
login page no longer links to them).

### 4. Trial Documentation
Create `docs/TRIAL.md` with:
- App URL and login credentials
- Feature walkthrough (Dashboard, Minting, Redeem, Profile)
- What is mock vs. what would be real in production
- Notes for the investor/reviewer

### 5. Dashboard Layout — Full-Page Fill
**Current issues:** Content ends midway; status breakdown cards feel thin; recent activity list is short.

**Improvements:**
- Add **Quick Actions** card (approve pending, view under-review) — links, not actions
- Enlarge **Status Breakdown** section with progress bars alongside counts
- Expand **Recent Activity** from 5 → 10 items
- Add **System Overview** card: uptime indicator (mock), last sync time
- Ensure the page fills the viewport vertically with `min-h-full` or `h-full` on the content wrapper
- Fix `MainLayout` `<Outlet />` wrapper to use `flex-1` so content stretches

### 6. Mock Data — Production-Realistic
**Current issues:** "User 1", "User 2", fake amounts that increment linearly, placeholder wallet/tx hashes.

**Improvements:**
- Realistic Indonesian/international names (30 unique names pool)
- Realistic crypto wallet addresses (40-char hex with proper `0x` prefix, varied)
- Realistic transaction hashes (64-char hex, varied)
- Amount distribution: varied realistic values ($12,500 / $50,000 / $250,000 / etc.)
- Multiple bank names: BCA, BRI, Mandiri, BNI, CIMB Niaga, etc.
- Bank account numbers: realistic 10-16 digit format
- Dates: spread across last 3 months (not just last 25 days)
- Dashboard stats: higher realistic numbers (total volume $4.2M minting, $2.1M redeem)
- Recent activity: 10 entries with realistic names

### 7. Profile Page
New route `/profile`, linked from navbar dropdown and sidebar.

**Content:**
- User avatar (initials circle, larger)
- Name, email, role badge ("Admin")
- Account info: Member since (mock date), Last login (today)
- Security section: "Change Password" placeholder button (disabled, tooltip: "Not available in demo")

**Nav integration:**
- Sidebar: add "Profile" nav item with `User` icon
- Navbar dropdown: add "Profile" item above "Logout"

### 8. Profile Dropdown — Opaque Overlay
**Current:** `DropdownMenuContent` uses default shadcn styles that may appear semi-transparent.

**Fix:** Ensure `DropdownMenuContent` has solid white background (`bg-white` / `bg-card`) and
`shadow-lg` — no backdrop blur or opacity that makes it see-through.

### 9. Tests
Run full test suite after implementation:
- `pnpm test` — Vitest unit tests
- `pnpm test:e2e` — Playwright E2E
- Fix any failures introduced by the changes

## Key Decisions

- **Single user only:** No register, no forgot-password — investor demo only
- **Login redesign:** Split-panel (not modal, not full-screen form) — more enterprise-looking
- **Profile page:** Display-only, no editing — avoids complexity
- **Dashboard:** Add content (no new API endpoints needed) — mock data extended inline
- **Table design:** Unchanged per user instruction
- **Logo:** Use `<img>` tag with `/image/Logo.svg` path (not inline SVG) — simpler

## Open Questions

None — requirements are clear. Proceeding to implementation.

## Next Steps

→ `/ce:work` to implement all changes above
