# Reference Admin App — Component Stack Analysis

**Source:** <reference admin app, URL withheld>
**Investigated:** 2026-04-29
**Method:** HTML inspection + minified JS bundle grep + React fiber DevTools-style walk to recover surviving `displayName`s

**TL;DR:** the reference is **not** a custom design system. It is a textbook **Next.js 15 + shadcn/ui + Radix UI** stack on top of **Tailwind**, with a small set of well-chosen extras for tables, forms, dates, and toasts. The "consistent component feel" comes from Radix primitives + shadcn variants, *not* from in-house engineering. We can reproduce the same level of polish in a few weeks because the parts are off-the-shelf.

---

## 1. How I confirmed each library

I had three signal sources:

| Signal | What it reveals |
|---|---|
| `<head>` and HTML attributes | `meta[generator]=Next.js 15`, font preloads, sonner CSS injection, `class="light"` on `<html>` |
| `data-slot` and `data-state` attributes on every component | shadcn/ui canonical slot names, Radix component states |
| React fiber walk (`element.__reactFiber$xxx`) | recovers `elementType.displayName` survivors — the cleanest proof that a Radix primitive is in the tree |

The bundle is heavily minified (Webpack + terser, single-letter local names) so grepping for package names in JS chunks fails for most libraries — but **DOM signatures** plus **fiber displayNames** that survive tree-shaking are unambiguous.

---

## 2. Confirmed stack (high confidence)

### Foundation

| Library | Evidence | Where it shows |
|---|---|---|
| **Next.js 15** (App Router) | `<meta name="generator" content="Next.js 15">`, `_next/static/chunks/main-app-…js`, `app/layout-…js` chunks | Whole app |
| **React 19** | implied by Next 15 default; `__reactFiber$` modern key prefix | Whole app |
| **TypeScript** | `<meta name="keywords">` lists "TypeScript"; chunk paths consistent with TS build | Build tool |
| **Tailwind CSS v4** | utility classes everywhere; `bg-primary`, `text-primary-foreground`, `shadow-xs` (v4-era token), `data-[state=open]/collapsible:` group syntax (v4) | Whole app |

### UI component layer — **shadcn/ui**

This is confirmed beyond doubt. Every `data-slot` value below is a shadcn canonical slot. I observed all of these on at least one page:

```
button, input, badge, avatar, avatar-fallback, card, card-content,
separator, breadcrumb, breadcrumb-list, breadcrumb-item, breadcrumb-link,
breadcrumb-page, breadcrumb-separator, table-container, table, table-header,
table-row, table-head, table-body, table-cell, dropdown-menu-trigger,
popover-trigger, popover-content, popover-portal, select-trigger, select-value,
collapsible, collapsible-trigger, collapsible-content, tooltip-trigger,
form-item, form-control, dialog content via Dialog primitives,
sidebar, sidebar-wrapper, sidebar-container, sidebar-inner, sidebar-header,
sidebar-content, sidebar-group, sidebar-group-label, sidebar-menu,
sidebar-menu-item, sidebar-menu-button, sidebar-menu-sub, sidebar-menu-sub-item,
sidebar-menu-sub-button, sidebar-footer, sidebar-rail, sidebar-inset,
sidebar-trigger
```

The button class string is the literal shadcn Button cva output:

> `inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive cursor-pointer bg-primary text-primary-foreground shadow-xs hover:bg-primary/90`

That's identical, character-for-character, to the **shadcn-ui Button** generated since the v4 / data-slot revamp (Oct 2025+).

The **Sidebar** is the new shadcn/ui Sidebar block (added Nov 2024) — `sidebar-rail`, `sidebar-inset`, `sidebar-trigger` are signature slot names from that exact component.

### Headless primitives — **Radix UI**

Confirmed via fiber walks recovering these displayNames (I inlined them from minified bundles where they survived):

| Radix package | Confirmed components |
|---|---|
| `@radix-ui/react-avatar` | `Avatar`, `AvatarContext`, `AvatarFallback`, `AvatarProvider` |
| `@radix-ui/react-collapsible` | `Collapsible`, `CollapsibleContent`, `CollapsibleTrigger`, `CollapsibleProvider` |
| `@radix-ui/react-context-menu` | `ContextMenu`, `ContextMenuProvider`, `ContextMenuTrigger` |
| `@radix-ui/react-dialog` | `Dialog`, `DialogContent`, `DialogOverlay`, `DialogPortal`, `DialogTitle`, `DialogClose`, `DialogProvider` |
| `@radix-ui/react-dropdown-menu` | `DropdownMenu`, `DropdownMenuProvider`, `DropdownMenuTrigger` |
| `@radix-ui/react-menu` | `Menu`, `MenuAnchor`, `MenuProvider` |
| `@radix-ui/react-popover` | `Popover`, `PopoverContent`, `PopoverPortal`, `PopoverProvider`, `PopoverTrigger` |
| `@radix-ui/react-popper` | `Popper`, `PopperAnchor`, `PopperContent`, `PopperContentProvider` |
| `@radix-ui/react-portal` | `Portal` |
| `@radix-ui/react-presence` | `Presence` |
| `@radix-ui/react-select` | `Select`, `SelectProvider`, `SelectTrigger`, `SelectValue`, `SelectCollectionProvider` |
| `@radix-ui/react-separator` | `Separator` |
| `@radix-ui/react-tooltip` | `Tooltip`, `TooltipProvider`, `TooltipProviderProvider`, `TooltipTrigger` |
| `@radix-ui/react-slot` | `Slot.Slot`, `Slot.SlotClone`, `Primitive.button.Slot`, `Primitive.div.Slot` |
| `@radix-ui/react-icons` | The sort-caret SVG path coordinates `4.93179 5.43179 …` are literally `CaretSortIcon` from `@radix-ui/react-icons` |
| Radix internals | `FocusScope`, `DismissableLayer`, `RemoveScroll` |

These are *exactly* the Radix packages that ship as dependencies of shadcn/ui — so this isn't unusual, it's the default install.

### Tables — **TanStack Table v8**

Strong inferred. I never recovered a literal "TanStack" string from the minified bundle (their hooks are minified), but the DOM signatures lock it in:

- `data-slot="table"` (shadcn) wrapping a `<table>` whose every `<th>` and `<td>` carries inline `style="width:Npx; opacity:1; position:relative; …"` — that's **`getCenterTotalSize` + column sizing state** rendering.
- `<div class="resizer ltr">` inside each header — TanStack's column resize handle convention (their docs ship that exact class).
- Per-column sort button uses `data-state` toggling and ships a Radix CaretSort SVG.
- Per-column filter funnel is a Radix Popover trigger.
- Pagination uses prev/next/first/last 4-button group + a "Rows per page" Select — the canonical TanStack Table demo shape.
- `Toggle columns` (column visibility) is a `data-slot="dropdown-menu-trigger"` button.
- Row selection toolbar (`Select Rows` button), advanced filter panel that lists every column as a form field — all align with TanStack's typed column metadata pattern.

In aggregate, no other table library produces this exact set of artifacts. The shadcn-ui docs even publish a "Data Table" example built on TanStack Table v8 with this anatomy.

### Forms — **react-hook-form + shadcn Form**

- Slots: `data-slot="form-item"`, `data-slot="form-control"` — these *only* exist on shadcn's `<Form>` wrapper, which itself only exists to wrap react-hook-form.
- Element IDs `_r_5_-form-item`, `_R_` — pattern of `useId() + "-form-item"` from shadcn's Form components.
- No yup signatures observed. No zod resolver string survived either, but shadcn ships zodResolver examples. Schema library is unverified.

### Forms — assumption to verify

`zod` is not confirmed by string evidence, but it's the default in `npx shadcn add form`. Likelihood: high. Best treated as an assumption.

### Dates — **react-day-picker** + shadcn Calendar

100% confirmed. The calendar grid emits classes:

```
rdp-root, rdp-months, rdp-month, rdp-month_caption, rdp-caption_label,
rdp-month_grid, rdp-weekdays, rdp-weekday, rdp-weeks, rdp-week, rdp-day,
rdp-day_button, rdp-today, rdp-outside, rdp-button_previous, rdp-button_next,
rdp-nav
```

`rdp-` is the package's class prefix — only react-day-picker emits these. Wrapped inside Radix Popover, this is the shadcn Calendar component.

The date *range* preset side-panel ("Last hour / 7 days / 14 days / 30 days" with H/W/B/M keyboard hints) plus "Custom range" Start/End datetime inputs is **shadcn-ui DateRangePicker block** (or a close analogue). Likely from shadcn-ui's blocks/examples gallery.

### Toasts — **Sonner**

100% confirmed. The page inlines a CSS block prefixed `[data-sonner-toaster]` in `<head>`, with all `--toast-*` custom properties. That style only ships from the `sonner` package. shadcn provides a `Toaster` wrapper around Sonner; the marker is the `<Toaster />` rendered with `data-sonner-toaster` attributes.

### Server state — **TanStack Query (React Query)**

Confirmed. Greps hit on `QueryClient`, `invalidateQueries`, `useMutation`, `MutationObserver`, `queryFn`, `queryKey` even in the minified bundle (these are part of the public API and survive tree-shaking).

### URL state — **nuqs**

Confirmed via fiber displayName `NuqsAdapterContext` and string greps for `useQueryState` / `nuqs`. Nuqs is a type-safe URL search-params hook that pairs *very* well with TanStack Table for keeping filter/sort/pagination in the URL. This is one of the most practical picks the reference made — it's exactly what we'd want for our Report and User pages.

### Theming — **next-themes**

Confirmed. `<html class="light" style="color-scheme: light;">` — that signature is set by `next-themes`'s `<ThemeProvider>` which mutates the root element's `class` and `color-scheme` attributes. (Even though the reference doesn't ship a visible dark mode toggle, the provider is mounted.)

### Icons — **@tabler/icons-react** + **@radix-ui/react-icons**

Confirmed.

- Most icons in chrome (sidebar, sort, filter funnel, refresh, actions): class names like `tabler-icon tabler-icon-layout-dashboard`, `tabler-icon-chevron-right`, `tabler-icon-arrow-right`. Only `@tabler/icons-react` emits classes with that exact prefix and naming.
- Sort caret in column headers: a 15×15 SVG with the iconic Radix double-caret path (`M4.93179 5.43179 …`). That's `CaretSortIcon` from `@radix-ui/react-icons` (which is a small static SVG package, separate from Radix UI primitives).

So **two icon libraries**, not one. That's a deliberate choice — Tabler for everything except the sort caret, where Radix's tighter caret pair fits the column-header micro-layout better.

### Search component (cmdk)

**Not used.** No `cmdk-*` classes or attributes observed anywhere. The Filter input in tables is a plain `<input data-slot="input">` doing client-side string filtering.

### Charts (Recharts / Tremor)

**Not observed.** No chart appears anywhere in the back office I explored. If we add charts later, shadcn ships its own `chart.tsx` wrapper around Recharts — a known compatible choice.

---

## 3. Component-by-component breakdown — table superpowers

A walkthrough of the table feature surface in the reference admin app, mapped to the library responsible for each feature:

| Table feature | Library responsible |
|---|---|
| Rendered shell (`<table>`, header row, body row, cell) | shadcn Table → plain HTML |
| Per-column sort caret + ascending/descending state | TanStack Table sort state + Radix CaretSort icon + shadcn Tooltip on the trigger |
| Per-column filter funnel popover | TanStack column filter state + Radix Popover + shadcn input/select fields inside |
| Global "Filter anything…" input | TanStack global filter + shadcn Input |
| Global "Advanced Filter" slide-out panel with all column filters | Radix Popover + shadcn Form (react-hook-form) + Radix Select for enum columns + Calendar (react-day-picker) for date columns + paired Min/Max inputs for numeric columns |
| Column visibility toggle ("View" button) | TanStack column visibility state + Radix DropdownMenu + shadcn Checkbox-Item children |
| Column resize (drag right edge of header) | TanStack column resizing → renders the inline `width: Npx` style + the `<div class="resizer ltr">` handle |
| Row selection ("Select Rows" toggle + checkboxes) | TanStack row selection state + shadcn Checkbox |
| Row click → modal preview | App-level handler → opens Radix Dialog (shadcn Dialog) |
| Row hover styling | Tailwind `hover:bg-gray-200/20` on `tr` |
| Pagination (prev / next / first / last) | TanStack Table pagination state + shadcn Button group |
| Rows-per-page selector | TanStack `setPageSize` + Radix Select |
| URL persistence of filters / sort / page | **nuqs** `useQueryState` |
| Server data load + cache | TanStack Query |
| Token icon (USDT/USDC/ORBIS) | Likely a static asset map + shadcn Avatar fallback / `<img>` |
| External-link button on hash cells | Plain `<a target="_blank">` + Tabler `IconExternalLink` |
| Status pills (Posted / Pending / Error / Fulfilled / Allowlist) | shadcn Badge with Tailwind variants |
| "View" action button per row | shadcn Button (variant outline) + Tabler `IconEye` |
| Date columns | `formatRelativeTime` / `formatShortDate` style helpers — date-fns *not* confirmed; could be `Intl.DateTimeFormat` + custom helpers |
| CSV export ("Export" button) | Likely custom helper. shadcn has no built-in CSV component. |
| Toast on action success / error | Sonner via shadcn `<Toaster />` wrapper |

There is **no proprietary table component**. They wired together TanStack Table + shadcn Table + Radix Popover/Dropdown/Tooltip + nuqs and got every feature you see. The only custom code is the per-page column definitions, which is `ColumnDef<T>[]` config — small and uniform across pages.

---

## 4. Inputs, dropdowns, and dialogs — same story

| Element | Library |
|---|---|
| Plain text input (table filter, advanced filter Min/Max, etc.) | shadcn `Input` — `data-slot="input"`, Tailwind classed |
| Login email/password input | **Custom** input (no `data-slot`). Different class string with `h-14 pl-12 pr-4 rounded-xl border border-gray-200 …`. Built specifically for the login screen. |
| Password show/hide toggle | Custom button + Tabler eye icon |
| Select dropdown (Chain, Token, Product, "All Network", "All Status", "All Activity", "All Admins", "Rows per page") | shadcn `Select` → Radix Select |
| Multi-select / combobox | Not observed. Each select is single-value. |
| Radio group / checkbox / switch | Likely shadcn versions if they exist; not observed in the screens I sampled |
| Date picker | shadcn `Calendar` → react-day-picker, in a Radix Popover |
| Date *range* picker (Advanced Filter) | shadcn DateRangePicker pattern (preset side-panel + custom range fields). Library: same react-day-picker base + custom presets. |
| Modal dialog (Preview Request) | shadcn `Dialog` → Radix Dialog (`DialogContent`, `DialogOverlay`, `DialogPortal`, `DialogTitle`, `DialogClose`) + `FocusScope` + `RemoveScroll` |
| Sheet / side panel | Not observed. The Advanced Filter that visually looks like a sheet is actually a Popover anchored to the toolbar button. |
| Tooltip on icons / sort buttons | Radix Tooltip via shadcn Tooltip |
| Dropdown menu (avatar menu, column toggle) | Radix DropdownMenu via shadcn DropdownMenu |
| Breadcrumbs | shadcn Breadcrumb (renders as `<nav>` + `<ol>` with `data-slot="breadcrumb-*"` markers) |
| Avatar (user / FA initials) | shadcn Avatar → Radix Avatar with `AvatarFallback` for initials |
| Status pill | shadcn Badge with cva variants (one per status color) |
| Tabs (Balance / Activity in Wallet) | likely shadcn Tabs (Radix Tabs) — not directly slot-confirmed in my walks but visually identical to that component |
| Toast | Sonner via shadcn Toaster |
| Sidebar collapse / expand | shadcn Sidebar block (Radix Collapsible inside) |
| Page navigation (back arrow on Bridge) | Plain anchor + Tabler `IconChevronLeft` (their custom `BackButton` component wraps it) |

---

## 5. Custom code the reference *did* write

They didn't write zero custom code. The thin custom layer:

1. **Per-page column definitions** for tables (`ColumnDef<T>[]` config files).
2. **App-level layouts** (sidebar nav config, breadcrumb config, route mapping).
3. **Custom login inputs** (different style from the rest of the app — pill inputs with leading icons).
4. **`BackButton`** convenience component for back navigation.
5. **Token chip / token amount cell** components (icon + ticker + chain sub-pill).
6. **Domain types** (Subscribe, Redeem, OTC, NAV, etc.) — pure data modeling.
7. **Tailwind theme tokens** (`primary`, `primary-foreground`, `accent`, etc.) — extending shadcn's CSS variables to their brand.
8. **Date-range preset side panel** with H/W/B/M keyboard shortcuts — small custom helper around shadcn Calendar.
9. **CSV export** logic.
10. **Mock or real data layer** + TanStack Query hooks per resource.
11. **Status badge variants** mapped per domain (OTC has Completed/Error/Rejected, Subscribe has Pending/Fulfilled/Failed, etc.) — a thin `getStatusBadgeProps()` helper would do it.

That's it. The entire visual system is shadcn defaults plus a font swap (Gellix) and a slight color palette tweak.

---

## 6. Direct comparison to our current USDX Back Office

We're already on **most of the same stack**. Here is what we share and what we'd need to change:

| Layer | the reference | USDX Back Office (us) | Action |
|---|---|---|---|
| Framework | Next.js 15 (App Router) | Vite + React Router v7 (SPA) | **Different**, but doesn't block. We don't need Next; the components don't care. |
| React | 19 | 19 | Same |
| Styling | Tailwind v4 | Tailwind v4 | Same |
| Component primitives | shadcn/ui | shadcn/ui | Same |
| Headless | Radix UI | Radix UI (via shadcn) | Same |
| Tables | TanStack Table v8 | TanStack Table v8 | Same |
| Server state | TanStack Query v5 | TanStack Query v5 | Same |
| Forms | react-hook-form (probable) | (not currently using; we use plain handlers + `validators.ts`) | **Gap.** We should adopt react-hook-form + shadcn `<Form>` for consistency, especially modals. |
| Schema validation | zod (probable) | none (plain validators) | **Gap.** Pair with RHF via `zodResolver`. |
| Date picker | react-day-picker via shadcn Calendar | none (we don't have date pickers yet) | Add when needed. |
| Toasts | Sonner | already in our deps? — check `package.json` | Verify; align if missing. |
| URL state | nuqs | manual `useSearchParams` | **Gap.** Adopting nuqs would clean up our Report and User pages dramatically. |
| Icons | @tabler/icons-react + @radix-ui/react-icons | lucide-react | **Different.** Our code uses Lucide. Tabler is the same vibe (single-weight outline, similar names). Switching is a search-and-replace; not urgent. |
| Theme | next-themes | none (single light theme) | Skip unless we add dark mode. |
| Sidebar | shadcn Sidebar block | custom Sidebar.tsx | **Gap.** We could swap to the shadcn block for free collapse + accessibility. |
| Charts | none observed | Recharts (Dashboard) | We're ahead here. |
| Mocks / fixtures | unknown (real-looking data) | MSW v2 | We're more disciplined. |

**Implication for our redesign:** the *visual* delta is mostly in (a) sidebar block adoption, (b) a more feature-rich Table wrapper (column resize / filter funnel / advanced filter popover / column visibility / nuqs URL persistence), (c) dropping our teal gradient for monochrome-with-data-color, and (d) form pattern via RHF + shadcn `<Form>`. Everything we'd want to copy is already an `npx shadcn add …` away, no proprietary library wrangling.

---

## 7. Concrete shopping list to match the reference admin's table

If we want our Report / Users / Subscribe / Redeem / OTC tables to feel like the reference's, we'd add (or verify already present):

```bash
# These are the npx shadcn pulls
npx shadcn add table dropdown-menu popover select tooltip dialog \
                 sheet form badge avatar breadcrumb separator \
                 collapsible sidebar calendar checkbox

# And these npm packages
pnpm add @tanstack/react-table @tanstack/react-query \
         react-hook-form @hookform/resolvers zod \
         nuqs sonner react-day-picker date-fns \
         @tabler/icons-react @radix-ui/react-icons
```

Most of these we already have. The genuine new additions for parity would be:

- **`nuqs`** for URL-driven table state.
- **`react-hook-form`** + **`@hookform/resolvers`** + **`zod`** for forms (replacing our hand-rolled validators).
- **`@tabler/icons-react`** if we decide to switch from lucide (optional — same DNA).
- The **shadcn Sidebar block** (`npx shadcn add sidebar`) replacing our custom Sidebar.tsx.
- A **typed DataTable wrapper** in `src/components/DataTable.tsx` that bundles TanStack Table + sort + filter + resize + visibility + pagination + nuqs-backed URL state, and accepts a `ColumnDef<T>[]`.

The DataTable wrapper is the one piece worth investing engineering effort in, because it's the abstraction every back-office page will consume. Everything else is dropped-in components.

---

## 8. Bottom line

> **the reference admin has no proprietary design system. It is shadcn/ui + Radix + TanStack Table v8 + react-hook-form + nuqs + Sonner + react-day-picker + Tabler icons, glued together with thin per-page configuration.**

Their consistency comes from:

1. Using shadcn defaults *as-is*, not customizing them. Buttons, inputs, dialogs, popovers, tooltips, badges all share the exact same cva variants — that's why every screen looks like the same designer made it.
2. Picking *one* table abstraction (TanStack Table) and using its full feature set on every list page.
3. Picking *one* form abstraction (react-hook-form + shadcn `<Form>`) and using it everywhere a user types.
4. Using *one* status pill component with a small set of variants, mapped per domain.
5. Using *one* date-range picker pattern.
6. Using *one* primary CTA color (black).
7. Letting Tailwind CSS variables (`--primary`, `--accent`, etc.) carry the brand, so a single token change re-skins the whole app.

We can replicate every visible feature and pattern in a few weeks because nothing here requires custom infra. The redesign cost is mostly **(a)** building one solid `DataTable<T>` wrapper, **(b)** adopting react-hook-form on our forms, **(c)** swapping our Sidebar for the shadcn Sidebar block, and **(d)** retuning the Tailwind color tokens for our chosen palette.
