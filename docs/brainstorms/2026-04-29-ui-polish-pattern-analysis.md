# Reference Admin App — UI Reference Analysis

**Source:** <reference admin app, URL withheld>
**Captured:** 2026-04-29 (login as Fajar / SUPER-ADMIN)
**Purpose:** Reference for next USDX Back Office redesign iteration. Visual / UX exploration only — no inputs or actions performed inside the app beyond login.

Screenshots: `C:\Users\YGY_NEA01H1086\AppData\Local\Temp\reference-ui\` (01–22)

---

## 1. Overall design language

**Aesthetic:** modern admin SPA, neutral / monochrome with single-accent token color usage. Reads as shadcn-ui-derived. Very low chroma chrome, bold black CTAs, white cards on near-white bg.

**Vibe descriptors:** restrained, dense, pragmatic, "Linear-ish but warmer," information-dense without feeling cramped.

**Things that immediately stand out vs. our current Azure Horizon:**

| Dimension |  the reference | Our current build |
|---|---|---|
| Primary CTA | Solid **black** (#0a0a0a-ish) | Teal→cyan **gradient** |
| Surface bg | Near-white `~#f7f8fa` | `#f5fafd` (cool teal tint) |
| Cards | Pure white, very thin border, subtle shadow | White, similar borders |
| Accent | None on chrome — only inside data (token icons, status pills) | Teal accent everywhere |
| Page header | Title only, no decorative band | PageHeader with insights |
| Tables | "No-line" inside, colored sort/filter glyphs | Same (no-line) |
| Status pills | Filled solid (green/red/orange) | Soft tint |
| Sidebar | Light gray rail, black-on-white selected | Similar |

The biggest stylistic shift is **from teal-anchored gradients → monochrome with surgical color**. Color is reserved for *data* (token chips, status pills, BUY/SELL text) rather than chrome.

---

## 2. Color system

Inferred palette (eyeballed):

```
neutral-0     #ffffff        cards, dropdowns
neutral-25    ~#f7f8fa       page bg
neutral-50    ~#f1f3f5       sidebar bg, hover
neutral-100   ~#e7eaee       borders
neutral-300   ~#bcc3cb       muted icons
neutral-500   ~#6b7178       secondary text
neutral-700   ~#3a3f45       body text
neutral-900   ~#0a0a0a       primary CTA, headings, sidebar logo
```

**Status / semantic colors (used as filled pills):**

| State | Pill bg | Pill fg | Where seen |
|---|---|---|---|
| Active / Posted / Fulfilled / Completed / Status:ON | green ~#10b981 | white | OTC client active, NAV posted, Subscribe fulfilled, Monitoring on |
| Pending | amber/orange ~#f59e0b | white | OTC client pending |
| Error / Posting Error / Rejected | red ~#dc2626 / ~#ef4444 | white | OTC orders, NAV posting error |
| Approval (type) | violet ~#8b5cf6 (light bg, dark text) | dark | Subscribe type |
| Instant (type) | neutral light pill | dark | Subscribe type |
| Allowlist | black solid | white | Address allowlist type |
| Active (rail / rpc) | violet small pill | white | Monitoring "Active" sub-pill |

**Accent / data colors:**
- USDT icon: green
- USDC icon: blue
- ORBIS icon: indigo/purple
- BUY (text only): green
- Inbound amount arrow `↘`: subtle red

**Implication:** the app is monochrome except for intentional, *data-bearing* color. Chrome (buttons, headings, borders, sidebar) carries no brand hue — that frees green/red/violet to mean something specific.

---

## 3. Typography

- Sans-serif throughout, weight contrast does the heavy lifting (regular vs semibold/bold).
- Page title (h1): ~28–32px, bold, near-black.
- Section card title: ~16–18px semibold.
- Table header: ~12–13px, weight 500, slight gray.
- Body / cell: ~14px regular, near-black.
- Numeric KPIs (Wallet/Inventory): ~32–40px bold + small unit label.
- Tracked uppercase labels for category dividers (Report page: `SUBSCRIBE`, `MINTING`, `BURNING` …).
- Letter-spacing on uppercase tags is moderate, not extreme.

No sign of dual-font system — single sans is enough.

---

## 4. Layout & shell

**Shell:** persistent left sidebar + content. No top header bar; breadcrumb + avatar live in a thin top strip inside the content area (32px tall).

**Sidebar (expanded ~256px wide):**
- Logo block at top: hexagon mark + "the reference admin / BackOffice" two-line wordmark.
- One section label "Overview" in tracked uppercase.
- Flat list of items, mix of **link items** and **expandable groups** (chevron right when collapsed, chevron down when expanded).
- Sub-items indent with a ~16px left padding, no bullet rail.
- Selected item uses **light gray pill background + black text**, no left border accent.
- Profile card pinned at bottom: avatar (initials, gray bg) + name (black) + role (uppercase gray small).

**Sidebar (collapsed ~64px):** icon rail. Logo at top, icons stack, no labels, avatar at bottom. Toggle button in the top strip.

**Content area:**
- Top strip: sidebar toggle (left) → breadcrumb → avatar (right). Avatar is a circle initials chip, gray bg.
- Page title h1, sometimes with a horizontal divider line under it.
- Toolbar row: filter input (left), action chips (right) — `Advanced Filter` (outlined w/ funnel icon), `Select Rows` (icon + label), `View` (icon + label), divider, `Export` (icon + label, often emphasized).
- Primary CTA (e.g., `+ Add New`, `+ New Fulfill`, `+ Export Log`) sits in the **top-right of the page header**, NOT inside the toolbar. Always solid black with white text and leading icon.

This split (CTA in page header vs. table chrome in toolbar) is a clean pattern — CTAs that *create* live with the title, controls that *filter what you see* live with the table.

---

## 5. Tables (the dominant pattern)

Almost every page is a table. Shared anatomy:

```
┌─ Page title ─────────────────────────── [+ Primary CTA] ─┐
│                                                          │
│ ┌─ Card ───────────────────────────────────────────────┐ │
│ │ [Filter anything…]      [⛛ Advanced Filter] [⊟ Select] [▢ View] | [⤓ Export] │
│ │ ─────────────────────────────────────────────────── │ │
│ │ Header row (no border)                              │ │
│ │  col ⇅ ⛛   col ⇅ ⛛   col   col ⇅ ⛛   …             │ │
│ │ Row (no row border, hover = light gray fill)        │ │
│ │ …                                                    │ │
│ │ ─────────────────────────────────────────────────── │ │
│ │           Rows per page [10▾]   Page 1 of 33  ⏮ ◀ ▶ ⏭ │ │
│ └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

Notes:
- **No row-by-row border lines.** Only horizontal hairlines between header / body / pagination footer.
- Each sortable column header has both a sort caret group AND a filter funnel icon — both per-column.
- Hash cells are `0x93…2fd5` truncated + small external-link icon (`Etherscan` style).
- Token cells = small circular brand icon + ticker.
- Numeric cells right-aligned.
- "View" action cell is either an outlined button with eye icon (Product, OTC) OR a plain text link with eye icon (User Internal).
- Empty / not applicable cells use `N/A` or `-`.
- Pagination uses 4 stepper buttons (first/prev/next/last), all neutral icon buttons, plus "Rows per page" select.

### Table column-header micro-pattern
Sortable column: `Label  ⇅  ⛛`  (label + sort caret stack + filter funnel)
Non-sortable: `Label  ⛛`  (label + filter only)
Pure label: e.g., `Actions`, `Type`.

---

## 6. Page-header pattern

Two variants:

1. **Title only** (Subscribe, NAV, OTC, etc.): `<h1>Title</h1>` aligned left, primary CTA top-right, no underline divider.
2. **Title + horizontal divider** (Product, Settings, Activity, Wallet/Inventory): same as above, but a `border-b` runs across the full width below the title row, separating it from the content.

Variant 2 reads as more "chunked" / formal; variant 1 is more compact. Both are valid.

Breadcrumb sits in a separate strip *above* the title, in muted gray; current page is non-clickable.

---

## 7. Cards & info layout

### Settings cards (Settings/Transaction)
- 2-up grid of cards
- Card header: title (semibold) + small secondary description line
- Body: 2-column grid of label/value pairs (label small gray, value 24–28px semibold or the same line)
- Footer: outlined `Edit` button with pencil icon, right-aligned (or absent if read-only)

### KPI / balance cards (Wallet/Inventory)
- 3-up grid
- Top of card: small token icon + label "ORBIS Balance"
- Big numeric value + small unit label inline ("1,045,655  ORBIS")
- Optional cap line below the value: "/ 4,000,000 ORBIS" (ratio context)
- Optional thin progress bar at the bottom of the card (filled neutral)

### Status cards (Monitoring)
- Header: name + green "Status: ON" pill, right-aligned
- Sub-pill below name in violet, e.g. "Active"
- Key-value rows in card body (label gray left, value bold right)
- **Active card** carries a thin **violet outline** instead of the default gray — that single visual cue does the "this is the live one" job.

### Tab pill group
- Used inside Wallet/Inventory: `Balance` | `Activity`
- Looks like an inline radio pill group: rounded outer container (gray), selected tab = white pill with text, others = transparent.

---

## 8. Forms & detail views

Forms are mostly hidden behind two patterns:

### A. Modal / dialog (the "Preview Request")
- Centered, ~640px wide, white card, rounded ~12px, drop shadow, dimmed backdrop.
- Header: title + `×` close, top-right.
- Subtitle/help line in muted gray.
- Inner section card "Request Summary" with status/type pills aligned right.
- Divider, then `Request Breakdown` second section as a 2-column key-value grid.
- Footer split:
  - Left: destructive secondary `× Reject` (outlined, red text with X icon)
  - Right: `Close` (outlined) + `Manual Sync` (filled gray with sync icon — *not* black, it's a secondary CTA inside the dialog)

This is a very approachable detail/decision dialog: read-only summary up top, action footer below.

### B. Form-as-page (Trades/Bridge — single-purpose form)
- Single centered ~480px column.
- "← Back" link above the card.
- Card body composed of stacked input groups:
  - Label "Select Wallet to Bridge" → dropdown
  - "From" group card with token chip (icon + ticker + sub-pill chain + chevron) on the left, big numeric on the right, balance hint top-right
  - Swap/reverse circular icon button between cards (just the `⇅`)
  - "To" group card mirrors From
- Bottom: full-width black `Continue` (primary) + outlined `View History` (secondary).

This is essentially a swap UI applied to a back-office function — refreshing.

### C. Activity feed (Activity)
Not a form, but a useful pattern:
- Vertical stack of "log entry" cards
- Each card: leading icon-circle (gray for view actions, green for create actions, with outline-style icon)
- Inline metadata row: actor name (bold) · action type (blue link) · timestamp (gray)
- Title in bold
- Action chips below: `View` (with external-link icon), `ID: …` (light blue badge), type tags (light blue badge)
- Right-aligned chevron for expansion
- Section dividers by date ("Friday — Apr 24, 2026") in small gray heading

---

## 9. Buttons & inputs

### Buttons (observed hierarchy)
1. **Primary** — solid `bg-neutral-900` / `text-white`, ~12px radius, 36–40px tall, leading icon when appropriate. Examples: `+ Add New`, `+ New Fulfill`, `Sign in`, `Continue`, `Export Log`.
2. **Secondary** — outlined, neutral border, neutral-700 text, same radius/size. Examples: `Close`, `View History`, `Edit`, `Go back to home`, the various toolbar chips.
3. **Tertiary / icon-text inline** — no border, no fill, just `icon + label`, e.g., `Select Rows`, `View`, `Export` in the toolbar. Hover would presumably surface a subtle bg.
4. **Destructive secondary** — outlined with red text + leading X, e.g., `Reject` in modal.
5. **Icon-only** — pagination steppers, sidebar toggle, refresh, sort/filter heads. Square-ish, no fill.

### Inputs
- Single radius (~10–12px), light neutral border, no inner shadow.
- Placeholder is gray, content black.
- Leading icon optional (login: envelope/lock, search: magnifier).
- Trailing affordance optional (login password: eye toggle).
- Filter input in tables is a long pill; doesn't have an icon.
- Dropdowns look identical to text inputs but with a chevron-down trailing.

### Status pills
Always **filled**, white text, ~6–8px horizontal padding, ~2px vertical, ~12px radius (very pill-y). Type label, no icon.

---

## 10. Icons

- Single weight, single style (looks like Lucide / Heroicons outline) at 16–18px.
- Color: neutral-400/500 in chrome, semantic in data (token/status).
- Sidebar item icons sit left of label, slight breathing room.
- Sort + filter icons in column headers are ~12px and clustered tight.

---

## 11. What I'd carry into our redesign

Concrete take-aways for the next USDX redesign pass:

1. **Drop the teal gradient on chrome.** The  the reference reference proves a credible back office can be done in pure neutral with semantic accents. We can keep "USDX teal" as the *brand mark* color and tokens, but stop painting buttons with gradients. Black solid CTAs read as more institutional and remove the "demo dashboard" sheen.
2. **Move primary CTA into the page header**, not inside the toolbar. Our current Mint/Redeem/Add User CTAs would sit beside the page title, top-right.
3. **Adopt their column-header micro-pattern** (per-column sort-stack + filter funnel) on Report and Users pages. It scales better than a single global filter when every column is filterable.
4. **Filled status pills** instead of soft tints for Pending / Completed / Failed. The contrast against monochrome chrome makes status scannable from across the table.
5. **Swap-card pattern for OTC Mint/Redeem** (the Bridge UI). A single-column form with `From` / `To` cards, USDT/ORBIS/USDX token chips, big numerics, and a black `Submit` is a strong fit for our single-shot OTC flow.
6. **Detail "preview" modal** instead of a full detail page for Subscribe/Redeem/OTC rows. Read-only summary section + breakdown section + decision footer (Reject / Close / Manual Sync) is exactly the shape we want for transaction inspection.
7. **Settings as 2-up cards with inline `Edit` per card**, not one global form. Maps directly to our Mint/Redeem fee + minimum amount config.
8. **Activity feed pattern** (icon-circle + metadata line + body + chips) for our audit log if we ever build one — much warmer than a table.
9. **Wallet/Inventory KPI card** (icon + big number + cap ratio + thin progress bar) is a good shape for our Dashboard's outstanding-USDX-supply card.
10. **Monitoring card with thin colored outline on the active item** is a cheap, expressive way to mark "live" or "selected" without full state pills everywhere.

What I'd **not** copy:
- The lack of a real dashboard. the reference admin's `/subscribe` landing is just a table; we should keep our KPI dashboard.
- The page-header bottom-divider on some pages but not others — inconsistent. Pick one variant globally.
- Some action buttons in the dialog use a gray "primary" tint instead of a black primary, which fights the rule on the rest of the app. We should keep one true primary.

---

## 12. Screen inventory captured

| File | Page | Pattern represented |
|---|---|---|
| `01-login.png` | Login | Centered card, monochrome, black solid CTA |
| `02-after-login.png` / `02b` | Subscribe → Request | Default landing, full table layout |
| `03-activity.png` | Activity | Feed cards, dated section headers |
| `04-monitoring.png` | Monitoring | Status cards grid w/ active outline highlight |
| `05-report.png` | Report | Hub page: sub-nav + 2-col grid of report items |
| `06-subscribe-fulfill.png` | Subscribe → Fulfill | Table w/ primary CTA in page header |
| `08-settlement.png` | Subscribe → Settlement | Table variant, directional arrows on amounts |
| `09-otc.png` | OTC → Client | Table w/ multi-state status pills |
| `10-otc-order.png` | OTC → Order | Full pill palette: Completed / Error / Rejected |
| `11-nav-asset.png` | (404) | 404 layout |
| `12-product.png` | Product | Table + horizontal divider page header |
| `15-wallet-inventory.png` | Wallet → Inventory | KPI cards + tab pills + expandable table |
| `16-nav-price.png` | NAV Management → NAV Price | Table w/ Posted / Posting Error pills |
| `17-settings.png` | Settings → Transaction | 2-up settings cards w/ inline Edit |
| `18-view-detail.png` | Subscribe row → Preview Request | Centered modal w/ summary + breakdown + footer |
| `19-allowlist.png` | Address → Allowlist | Table w/ black-filled type pill |
| `20-user-internal.png` | User → Internal | Table w/ inline View text-link, Active pill |
| `21-trades-bridge.png` | Trades → Bridge | Single-column form-as-page (swap UI) |
| `14-sidebar-expanded.png` | (any) | Sidebar expanded full state |
| `22-sidebar-collapsed.png` | (any) | Sidebar collapsed icon rail |

---

## 13. Open questions for the redesign decision

1. **Brand color.** Do we keep USDX teal as the chrome accent, or strip it and reserve teal/turquoise for the USDX *token chip* only (mirroring how  the reference uses green for USDT, blue for USDC, indigo for ORBIS)?
2. **CTA hierarchy.** Black-solid primary or teal-solid primary? Black is more institutional but loses brand recall on the page header.
3. **Status pill style.** Switch from soft-tint to filled? Trade-off: filled pills are more legible but heavier visually; on a page with many rows, filled red pills can dominate.
4. **Form dialog vs. detail page.** Adopt the modal-preview pattern for OTC submissions, or keep the form-as-page (closer to the current Mint/Redeem)?
5. **Sidebar grouping.**  the reference has flat groups. Our current sidebar has fewer items; do we still want collapsible groups or keep a flat list?

These are the calls to make before sketching screens.
