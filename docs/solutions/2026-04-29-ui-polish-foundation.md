# UI polish foundation — solution log

**Date:** 2026-04-29
**Branch:** `feat/ui-polish-foundation`
**Plan:** [`docs/plans/2026-04-29-001-feat-ui-polish-foundation-plan.md`](../plans/2026-04-29-001-feat-ui-polish-foundation-plan.md)

## What we built

Adopted a feature-rich component stack and minimal chrome into the back
office, in three phases:

### Phase 1 — Foundation

- Added `react-hook-form`, `zod`, `@hookform/resolvers`, `nuqs`,
  `react-day-picker`, `date-fns`, plus the Radix primitives needed by missing
  shadcn components.
- Generated shadcn components: form, popover, calendar, tabs, avatar,
  breadcrumb, collapsible, sidebar, alert-dialog, scroll-area.
- Ported every legacy validator in `src/lib/validators.ts` to a zod schema in
  `src/lib/schemas.ts` (35 schema tests).
- Built `<StatusPill>` (filled/soft/outline × success/warning/destructive/info/neutral)
  and replaced six inline pill renderers across the codebase.
- Added the nuqs adapter mount and a typed parser map (`src/lib/url-state.ts`)
  preserving the exact URL key names used by MSW handlers and existing tests.
- Replaced the custom Sidebar with the shadcn Sidebar block (`<AppSidebar>`)
  and refactored MainLayout around `<SidebarProvider>` + `<SidebarInset>`.
  Dropped BottomNav rendering.

### Phase 2 — Form migration + DataTable v2

- Restructured the sidebar to grouped submenus: User (Internal, User Client),
  OTC (Mint, Redeem), Report. Hid Dashboard. Default landing → `/user/internal`.
- Simplified Navbar to `[SidebarTrigger | Breadcrumb | Profile]`. Dropped the
  search box, theme toggle, and notifications bell.
- Simplified PageHeader to title + actions only. Stripped SummaryStat KPI
  cards from list pages. Pages now go "title, then table."
- Rewrote `DataTable` to v2 with column resize, row selection, column
  visibility toggle, page-size selector, nuqs-bound URL state, and a default
  toolbar that uses the new `<DateRangePicker>`.
- Migrated every form to RHF + zod via shadcn `<Form>`: `LoginPage`,
  `StaffModal`, `UserModal`, `PersonalDetailsForm`, `OtcMintForm`,
  `OtcRedeemForm`. Each form preserves the original UX rules — validate after
  first blur (`mode: 'onTouched'`), modal Esc/outside-click guarded while
  pending, success closes/resets/refocuses, error toast + values preserved.
- Built `<DateRangePicker>` (Calendar in Popover with preset side panel and
  Custom Range datetime inputs).

### Phase 3 — Cleanup + docs

- Deleted `validators.ts`, `FieldError.tsx`, `BottomNav.tsx`, `MoreDrawer.tsx`,
  legacy `Sidebar.tsx`, and their tests after every consumer migrated.
- Refreshed `CLAUDE.md` (root + per-directory) so docs match the new IA,
  forms convention, color tokens, and DataTable v2 props.
- Seeded `docs/solutions/patterns/` with the recurring gotchas hit during
  the migration (see [critical-patterns](./patterns/critical-patterns.md)).

## What worked

- Schema-first migration: porting validators to zod **before** rewriting the
  forms made each form-migration unit a 1-for-1 substitution. Error-message
  text in the schema matches the legacy strings, so tests asserting label text
  passed without rewriting.
- Keeping the URL key names identical when adopting nuqs meant zero churn
  on MSW handlers and most page-level tests.
- The shadcn Sidebar block carried free accessibility, mobile sheet, and
  collapse — all features the previous custom sidebar lacked.
- Splitting commits per unit (one PR-sized concern at a time) made bisecting
  the Tailwind v4 sidebar bug trivial.

## What bit us

- The Tailwind v4 `w-[--var]` issue — the shadcn Sidebar's gap collapsed to
  0px until we rewrote arbitrary class values to use `var()`. Wrote it up at
  [shadcn-sidebar-tailwind-v4](./patterns/shadcn-sidebar-tailwind-v4.md).
- Windows path handling on the shadcn CLI — files generated into a literal
  `@/` directory. See [shadcn-cli-windows-paths](./patterns/shadcn-cli-windows-paths.md).
- shadcn `<FormControl>` + sibling icon broke `getByLabelText`. See
  [formcontrol-sibling-icon](./patterns/formcontrol-sibling-icon.md).

## Test status

- Before Phase 1: 159 pass / 16 fail (pre-existing breakage from prior restyle).
- After Phase 1: 218 pass / 16 fail (zero regression; +59 new passing tests).
- After Phase 2 + cleanup: **178 pass / 0 fail** (legacy tests deleted along
  with their target components).

## What's deferred

- The Advanced Filter button in the toolbar is a stub — a popover with
  per-column filter fields driven by `column.meta.filterType` is still TODO.
- Dashboard polish (Activity feed restyle in Orbitum-cards style) was skipped
  because Dashboard is hidden from the sidebar.
- E2E smoke at `e2e/smoke.spec.ts` should be extended for the new IA.
