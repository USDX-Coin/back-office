# Implementation Plan — Multisig owner-check stuck at "Verifying Safe ownership…"

- **Date:** 2026-07-01
- **Area:** `src/features/multisig`, `src/lib/multisig`
- **Related:** USDX-275 (multisig queue), USDX-290 (owner-check via `detail.signers`) — this is a follow-up/rework
- **Repro:** `/multisig/019f1cb1-57d3-73a4-b4fb-3d510ba4aa94` — wallet connected (valid signer, on Polygon), Sign stays disabled with "Verifying Safe ownership…" forever.

---

## 1. Problem statement

On the Multisig detail drawer, the **Sign** button is permanently disabled with the blocked-reason
`"Verifying Safe ownership…"` even for a connected wallet that is a valid Safe owner.

That string is **not** an in-progress task — it is the disabled-reason for exactly one state:
`ownerCheck === 'unknown'` (`MultisigDetailSheet.tsx:294`). `ownerCheck` comes from the pure
`resolveOwnerCheck(wallet.address, detail.signers, safeMeta.owners)` (`src/lib/multisig/owner.ts`),
which returns `'unknown'` only when **both**:

1. `wallet.address` is present (wallet connected + on Polygon — the two guards above it already passed), and
2. `detail.signers` is empty/undefined **AND** `safeMeta.owners` (from `GET /api/v1/multisig/safes`) is empty/undefined.

Because the drawer is fully rendered (not the skeleton, not the "Failed to load" branch — see
`MultisigDetailSheet.tsx:379-389`), the detail request **succeeded**. So the live data reaching the
owner-check is empty from **both** sources.

### Root cause (two layers)

- **Primary (data):** `GET /api/v1/multisig/{id}` returns `signers: []` for this transaction. Per SoT
  (`sot/api/multisig.yaml:413-423`, *"Status tiap owner sudah/belum sign"*) `signers` MUST be the full
  owner list with per-owner signed status. USDX-290 made `detail.signers` the authoritative source, so
  an empty array defeats the whole owner-check. The `safeMeta.owners` fallback is also empty because
  `/api/v1/multisig/safes` is the slow live-RPC call that is frequently unavailable (the exact reason
  USDX-290 demoted it to fallback).
- **Secondary (UX defect that makes it look like a hang):** the FE conflates *"owner data still
  loading"* with *"owner data unavailable"* into a single `'unknown'` → it shows a misleading
  "Verifying…" **forever** with no error, no retry, and Sign silently disabled. Even once the true
  cause is fixed on the backend, the FE must never present a terminal failure as an infinite spinner.

> Note (**branch B**): a `wallet.address` that is `undefined` while `isConnected` is `true` would also
> map to `'unknown'`. `reconnectOnMount={false}` in `WalletProviders.tsx` means there is no
> auto-reconnect race, so this is unlikely — but we add a cheap guard anyway (§4.4).

---

## 2. Goals / non-goals

**Goals**
1. The Sign gate must distinguish three settled states — **owner**, **not-owner**, **cannot-verify** —
   from the transient **checking** state, and never leave the user on a permanent "Verifying…".
2. When owner data is genuinely unavailable, show an actionable **error + Retry** (refetch detail +
   safes), not a fake spinner.
3. Make the `safeMeta.owners` fallback actually reachable (correct query state wiring + robust match).
4. Confirm and, if needed, drive the backend fix so `detail.signers` is populated per SoT.
5. Preserve the security property: never enable Sign for a wallet we cannot confirm is an owner.

**Non-goals**
- Redesigning the multisig detail drawer.
- Changing the sign/execute EIP-712 flow.
- Replacing the live-RPC `/multisig/safes` implementation (backend concern).

---

## 3. Confirm root cause first (Phase 0 — ~15 min)

Before coding, capture ground truth so the BE ticket (if any) is evidence-backed.

In the page DevTools console (same-origin fetch → goes through the Vite proxy, no CORS):

```js
const t = JSON.parse(localStorage.getItem('usdx_auth_user')).token
const r = await fetch('/api/v1/multisig/019f1cb1-57d3-73a4-b4fb-3d510ba4aa94', {
  headers: { Authorization: 'Bearer ' + t },
})
const j = await r.json()
console.log('HTTP', r.status, '| signers:', j.data?.signers, '| safeAddress:', j.data?.safeAddress)
```

Also probe the fallback: `GET /api/v1/multisig/safes` → is it 200 with `owners[]`, or slow/failing?

**Decision gate**
- `signers: []` (or missing) → confirms Primary root cause → open BE rework ticket (§7) **and** do the
  FE resilience work (§4) so it degrades gracefully.
- `signers` populated with the wallet's address → the bug is `wallet.address`/matching → jump to §4.4
  and skip the BE ticket.

The FE work in §4 is worth doing **regardless** of the outcome — it removes the permanent-hang class of bug.

---

## 4. Implementation (Phase 1 — FE resilience)

### 4.1 Extend the owner model to separate "checking" from "unavailable"
**File:** `src/lib/multisig/owner.ts`

Keep `resolveOwnerCheck` pure and data-only (returns `owner | not-owner | unknown`). Add a small pure
combinator that folds in the load state:

```ts
export type OwnerVerification = 'owner' | 'not-owner' | 'checking' | 'unavailable'

/**
 * Fold the data-only OwnerCheck with whether any owner source is still loading.
 * - resolved (owner/not-owner) passes through
 * - 'unknown' + a source still loading  → 'checking'   (transient, OK to show "Verifying…")
 * - 'unknown' + all sources settled      → 'unavailable' (terminal → show error + retry)
 */
export function resolveOwnerVerification(
  base: OwnerCheck,
  opts: { sourcesLoading: boolean },
): OwnerVerification {
  if (base !== 'unknown') return base
  return opts.sourcesLoading ? 'checking' : 'unavailable'
}
```

### 4.2 Wire query load/error state + retry into the drawer
**File:** `src/features/multisig/MultisigDetailSheet.tsx`

- Keep the full query objects instead of destructuring only `data` (we need `isLoading`/`isFetching`/
  `refetch`). Rename the local `safes` → `safesQuery` (lines 227 + 259):
  ```ts
  const query = useMultisigDetail(open ? txId : null)
  const safesQuery = useSafes()               // unchanged args — see §4.3 for why we don't pass chain
  const detail = query.data
  // safeMeta: single definition in §4.3
  ```
- Compute the richer status. **Only** the fallback's *initial* load counts as "checking" — do NOT
  include `query.isFetching` or `safesQuery.isFetching`. `useMultisigDetail` background-polls every 12s
  (`hooks.ts:81`), so including `isFetching` would flip `'unavailable'` → `'checking'` → `'unavailable'`
  on every poll (flicker + the Retry button would blink out):
  ```ts
  const ownerCheck = resolveOwnerCheck(wallet.address, detail?.signers, safeMeta?.owners)
  const ownerVerification = resolveOwnerVerification(ownerCheck, {
    sourcesLoading: safesQuery.isLoading,     // first fallback load only (no cached data yet)
  })
  ```
- Update `signBlockedReason` (replaces the `unknown`/`not-owner` lines at `MultisigDetailSheet.tsx:294-295`;
  keep the `alreadySigned`/`hashOk`/`unknownActivity` lines that follow):
  ```ts
  if (ownerVerification === 'checking')     return 'Verifying Safe ownership…'
  if (ownerVerification === 'unavailable')  return "Couldn't verify Safe ownership — retry below"
  if (ownerVerification === 'not-owner')    return 'Connected wallet is not an owner of this Safe'
  ```
- In the "Signer wallet" chip (`:442-455`) render all four states: `· owner` / `· not an owner` /
  `· verifying owner…` (checking) / `· ownership unknown` (unavailable, warning tone).
- When `ownerVerification === 'unavailable'`, render an inline **Retry** button that calls
  `query.refetch()` + `safesQuery.refetch()`, with a one-line explanation ("Owner list unavailable
  from the server. Retry, or contact an admin if it persists."). The button's own spinner/disabled uses
  `safesQuery.isFetching || query.isFetching` — kept **local to the button** so a retry does not reset
  `ownerVerification` back to 'checking'.

### 4.3 Make the `safeMeta` fallback robust (single definition)
**File:** `src/features/multisig/MultisigDetailSheet.tsx`

- Replace the single `.find` at line 259. Match the Safe by **address first, then `safeType` + `chain`**
  so a checksum/format quirk in `safeAddress` doesn't silently drop the fallback:
  ```ts
  const safeMeta =
    safesQuery.data?.find(s => s.safeAddress.toLowerCase() === (detail?.safeAddress ?? '').toLowerCase())
    ?? safesQuery.data?.find(s => s.safeType === detail?.safeType && s.chain === detail?.chain)
  ```
- Keep `useSafes()` with **no args** (fetches all Safes, cached 5 min per `hooks.ts:97`). Do **not**
  switch to `useSafes(detail?.chain)`: `detail` is `undefined` on first render, so the query key would
  churn `'all'` → `'<chain>'` and fire a second request for no benefit — the all-Safes result already
  contains the one this drawer needs for the `safeType + chain` match above.

### 4.4 Cheap wallet-address guard (covers branch B — see §1 note)
**File:** `src/features/multisig/walletActions.ts`

- Derive connection from `useAccount().status === 'connected'` and only treat the wallet as usable when
  `address` is defined:
  ```ts
  const { address, status } = useAccount()
  const isConnected = status === 'connected' && Boolean(address)
  ```
  This prevents the `isConnected && address === undefined` edge from mapping to `'unknown'` and instead
  keeps the "Connect wallet" state until the address resolves.

---

## 5. Tests (Phase 2)

### 5.1 Pure unit — `src/lib/multisig/__tests__/owner.test.ts`
Add `describe('resolveOwnerVerification')`:
- positive: `base='owner'` → `'owner'`; `base='not-owner'` → `'not-owner'` (loading ignored).
- edge: `base='unknown'` + `sourcesLoading:true` → `'checking'`.
- edge: `base='unknown'` + `sourcesLoading:false` → `'unavailable'`.

### 5.2 Integration — new `src/features/multisig/__tests__/MultisigDetailSheet.test.tsx`
Mock `../hooks` (`useMultisigDetail`, `useSafes`, mutations) and `../walletActions`
(`useMultisigWallet` returning a connected, chain-ok owner address), following the `../hooks`
mock pattern already used in `ProposeModal.test.tsx`. Cases:
1. `detail.signers` includes the wallet → chip `· owner`, Sign **enabled** (primary path).
2. `signers: []` + safes returns owners incl. wallet → `· owner`, Sign **enabled** (fallback works).
3. `signers: []` + `useSafes` mock `{ isLoading: true, data: undefined }` → "Verifying Safe ownership…",
   Sign disabled (transient OK).
4. `signers: []` + safes settled empty/errored (`{ isLoading: false, data: [] }`) → "Couldn't verify…" +
   **Retry** visible, Sign disabled; clicking Retry calls both `refetch`s.
5. `signers` present but wallet not in it → `· not an owner`, correct reason.
6. **Flicker regression guard:** `signers: []` + safes settled empty (`isLoading:false`) + detail
   `isFetching:true` (background poll) → stays `'unavailable'` (Retry stays visible); must NOT revert to
   "Verifying…". This is the guard for the §4.2 flicker fix.

### 5.3 Optional but recommended — MSW mock handlers for multisig
There are **no** MSW handlers for `/api/v1/multisig/*` and it is **not** in `INTEGRATION_PATHS`
(`src/mocks/browser.ts`), so local dev always hits the real backend (`onUnhandledRequest: 'bypass'`)
and cannot reproduce this deterministically. Adding handlers + a data factory (`data.ts`) — including a
transaction whose `signers` is intentionally empty — makes local dev reliable and lets us reproduce/guard
this bug offline. Scope it as a separate small PR if it grows.

---

## 6. Verification (Phase 3)
- `pnpm lint && pnpm build && pnpm test` green.
- Manual on the repro tx: with a valid signer wallet connected on Polygon → chip shows `· owner` and
  Sign is enabled (once BE returns `signers`, or immediately via the safes fallback if it has owners).
- Force the failure path (block `/multisig/safes` + empty `signers`) → "Couldn't verify…" + Retry, not a
  permanent "Verifying…".
- Confirm no regression to Execute/Cancel gating.

---

## 7. Backend coordination (if Phase 0 confirms empty `signers`)
Per `sot/CLAUDE.md`, an API-contract defect needs a rework ticket. If `GET /api/v1/multisig/{id}` returns
`signers: []`:
- **BE rework ticket:** "`GET /api/v1/multisig/{id}` must return `signers` = full Safe owner list with
  per-owner `signed` status (SoT `multisig.yaml:413-423`); currently empty for tx `019f1cb1-…`."
  Include the Phase 0 payload as evidence.
- **FE ticket:** this plan (graceful degradation + retry). FE ships independently of BE; the safes
  fallback + retry keep the page usable in the meantime.

---

## 8. Risk & rollout
- **Low risk / FE-isolated.** Pure additive states; no change to sign/execute crypto path.
- **Security preserved:** Sign stays disabled unless we positively confirm ownership from a real source;
  the backend `confirm` endpoint remains the final authority and rejects non-owner signatures.
- **Fallback flakiness:** if `/multisig/safes` is slow, users may briefly see "Verifying…" then either
  resolve or "Couldn't verify… Retry" — an honest, actionable state instead of a silent hang.
- **Partial `signers` (backend contract):** `resolveOwnerCheck` trusts `detail.signers` when non-empty
  (SoT says it is the full owner set). If the backend returns a *partial* list (e.g. only owners who have
  signed), a valid unsigned owner would show `· not an owner`. This is the same backend contract
  violation as empty `signers` — covered by the §7 BE ticket, not worked around on the FE.
- **Re-sign edge when `signers: []`:** with empty signers, `mySigner` is `undefined` → `alreadySigned`
  stays `false`, so the UI would not disable Sign for an owner who already signed. Harmless — the backend
  `confirm` endpoint rejects duplicate signatures — and it disappears once `signers` is populated.
- **Known limitation (cosmetic):** when ownership is resolved via the `safeMeta.owners` fallback while
  `signers: []`, the "Signers" section still renders "No signer data." (`:555-562`). Accepted /
  out-of-scope — the resolved chip + enabled Sign is what matters; the list is correct once the BE fix
  lands.
- **Prereq (env):** multisig endpoints are un-mocked and hit the real backend — ensure `VITE_API_URL`
  is empty so calls flow through the Vite same-origin proxy (see the CORS fix from the dashboard issue),
  otherwise every multisig call is CORS-blocked and the drawer won't load at all.

---

## 9. File touch list
| File | Change |
|------|--------|
| `src/lib/multisig/owner.ts` | + `OwnerVerification` type + `resolveOwnerVerification()` |
| `src/features/multisig/MultisigDetailSheet.tsx` | keep query objects, compute `ownerVerification`, update `signBlockedReason` + chip, add Retry, robust `safeMeta` match |
| `src/features/multisig/walletActions.ts` | `isConnected` from `status==='connected' && address` |
| `src/features/multisig/hooks.ts` | **No change** — `useSafes()` reused as-is (all Safes, cached) |
| `src/lib/multisig/__tests__/owner.test.ts` | + `resolveOwnerVerification` cases |
| `src/features/multisig/__tests__/MultisigDetailSheet.test.tsx` | new integration test (6 cases, incl. flicker guard) |
| `src/mocks/handlers.ts` + `src/mocks/data.ts` | (optional) MSW multisig handlers + empty-signers fixture |
