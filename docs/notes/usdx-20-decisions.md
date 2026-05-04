# USDX-20 Rate Management Page — decision notes

This document records three judgement-call decisions made while implementing
the Rate Management page (Linear USDX-20). The Linear task description and
SoT (`sot/phase-1.md` § Rate Configuration / Backoffice Web App, and
`sot/openapi.yaml` § /api/v1/rate) define the contract but leave the
following questions open. Each decision is reversible at a single file.

Source-of-truth references (sibling repo `back-office/`, not vendored here):

- `sot/phase-1.md` § Rate Configuration — append-only history, MANUAL vs
  DYNAMIC semantics, "admin/manager only" gating.
- `sot/openapi.yaml` § /api/v1/rate — GET RateInfo, POST UpdateRateConfig,
  403 on unauthorized actor.
- `sot/openapi.yaml` § StaffRole — enum `STAFF | MANAGER | DEVELOPER | ADMIN`.

---

## 1. Sidebar visibility and read-only fallback

**Question.** Linear AC says "Role STAFF → page hidden from navigation
(or show read-only)." That covers STAFF only and offers two options.
SoT defines four roles (STAFF, MANAGER, DEVELOPER, ADMIN); the AC does
not say what to do for DEVELOPER or how to handle the read-only/hidden
choice.

**Decision.** Sidebar item is **visible to every authenticated role**.
The page itself renders the current rate card for everyone, and the
update form only for ADMIN/MANAGER. STAFF and DEVELOPER see a read-only
notice in place of the form.

**Why.**

- The rate is operational context for every back-office user. STAFF
  processing a mint or redeem benefits from seeing the active rate.
  Hiding the page entirely would force them to ask someone or guess.
- Mirroring the backend keeps the model honest: GET is open to any
  authenticated caller, POST is gated. The UI gating mirrors that
  exactly — no UI invariants the backend doesn't also enforce.
- DEVELOPER follows least-privilege: SoT does not assign DEVELOPER any
  rate-mgmt responsibility, so we default to read-only. Easy to flip if
  product disagrees.

**How to revisit.** Change `canManageRate` in `src/lib/types.ts` to
include `DEVELOPER` (or any other role) — sidebar visibility and
read-only fallback both flow from that single function.

---

## 2. `spreadPct` interpretation: literal percent

**Question.** SoT documents `spreadPct: "0.5"` with no clarification of
unit. Two viable readings: `0.5` means **0.5%** (literal percent) or
`0.5` means a fraction (i.e. 50%). The two interpretations differ by
two orders of magnitude on the resulting effective rate, which would be
catastrophic if interpreted wrong.

**Decision.** Treat `spreadPct` as a **literal percent**. Display with
a `%` suffix; user types `0.5` for 0.5%; payload sends `"0.5"`.

**Why.**

- Field name `spreadPct` (Pct = percent) is the strongest signal.
- SoT § Rate Configuration calls it "markup % di atas rate".
- Realistic FX/stablecoin spreads sit around 0.1–2%. The example value
  `0.5` is plausible at literal-percent and absurd at fraction-of-1.
- The mock handler computes `effective = base × (1 + spreadPct/100)`,
  which produces `16,200 × 1.005 = 16,281` for the seeded config — a
  realistic-looking effective rate, confirming the interpretation.

**How to revisit.** If backend turns out to interpret `spreadPct`
differently, change the divisor in `computeRateInfo` (`src/mocks/data.ts`)
and the formatter in `formatSpreadPct` (`src/lib/format.ts`). Both
files document this decision inline.

---

## 3. Validation bounds + confirm dialog + soft warning

**Question.** SoT specifies field types (`string`, decimal) and the
required-when rule for `manualRate` but no min/max for `manualRate` or
`spreadPct`. Without bounds the FE either accepts anything (and
forwards garbage to the backend) or invents bounds the backend may
reject.

**Decision.** Three layers of safety, prioritising defense-in-depth
without breaking the operator's flow:

1. **Hard validation** in `src/lib/validators.ts`:
   - `manualRate`: `> 0`, ≤ 4 decimal places, `< 100,000`
     (current ~16,000 IDR/USD; 6× buffer absorbs reasonable drift but
     blocks runaway typos like an extra zero).
   - `spreadPct`: `>= 0`, ≤ 2 decimal places, `<= 10` (10% is already
     extreme for FX; backend will likely reject lower).

2. **Confirm dialog** before POST. Submit opens a modal showing
   `current → new` for mode, rate, and spread. Operator must
   explicitly click "Yes, update rate". Reasoning: rate updates are
   append-only, immediately active, and affect every downstream
   transaction. Adding friction at the moment of commit is more
   valuable than tightening validation, because validation cannot
   distinguish a legit `16,250 → 16,500` from a typo'd
   `16,250 → 16,050`.

3. **Soft warning** if `manualRate < 5,000` or `> 50,000`.
   Non-blocking inline message: "Rate looks unusual — please
   double-check before submitting." Catches the "syntactically valid
   but probably wrong" class that hard validation misses.

**Why this combination.** Hard validation alone is too permissive
(can't catch intent mismatches inside the valid range). Confirm dialog
alone is too easy to dismiss reflexively. Soft warning alone provides
no real friction. Together they cover three different error categories:
format / range, intent mismatch, and likely-typo inside the valid
range.

**How to revisit.** Bounds live as named constants in
`src/lib/validators.ts` (`RATE_MAX_EXCLUSIVE`, `SPREAD_MAX_INCLUSIVE`,
`RATE_SOFT_LOW`, `RATE_SOFT_HIGH`). Update those when the backend
publishes definitive ranges.

---

## Notes on existing-code reconciliation

The current codebase models staff as `StaffRole = 'support' | 'operations'
| 'compliance' | 'super_admin'` while SoT uses `STAFF | MANAGER |
DEVELOPER | ADMIN`. Rather than rewrite the existing role system in this
PR, `mapStaffRoleToSoT` (in `src/lib/types.ts`) maps:

- `super_admin → ADMIN`
- `operations → MANAGER`
- `compliance → STAFF`
- `support → STAFF`

This keeps the rate-management gating SoT-aligned without disturbing
unrelated features. When the backend is wired up and login resolves a
real SoT role, the mapping helper can be removed in favor of reading
`SoTRole` directly off the user.

## Notes on mock authorization

The mock POST `/api/v1/rate` accepts an `operatorStaffId` field on the
request body and resolves it against the staff store to apply the same
ADMIN/MANAGER gate the real backend would (returning 403 otherwise).
This is mock-only scaffolding — production frontends do not send their
own ID; the backend reads the JWT. Removing the field is a one-line
change once auth is real.
