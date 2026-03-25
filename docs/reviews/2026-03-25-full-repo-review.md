---
title: USDX Back Office - Full Repository Review
type: review
date: 2026-03-25
branch: main
reviewer: Claude Code (multi-agent, 5 reviewers)
agents: architecture-strategist, security-sentinel, kieran-typescript-reviewer, code-simplicity-reviewer, best-practices-researcher
---

# USDX Back Office - Full Repository Review

**Date:** 2026-03-25
**Branch:** main (11 commits, 9ccfef2)
**Scope:** Full codebase + Vercel/React best practices audit

---

## Findings Summary

| Severity | Count | Category |
|----------|-------|----------|
| P1 CRITICAL | 6 | Security (4), Architecture (1), React Best Practice (1) |
| P2 IMPORTANT | 12 | TypeScript (3), Duplication (3), Performance (2), Accessibility (2), Testing (2) |
| P3 NICE-TO-HAVE | 8 | Cleanup, polish, future improvements |

---

## P1 CRITICAL

### P1-01: No Error Boundaries
**Source:** best-practices-researcher, architecture-strategist
**Impact:** Any unhandled render error crashes the entire app with a white screen.

**Action:** Add error boundaries at 3 levels:
1. Root error boundary in `src/main.tsx`
2. Route-level `errorElement` in router config (`src/App.tsx`)
3. Component-level around DataTable and modals

### P1-02: No Route-Level Code Splitting
**Source:** best-practices-researcher (Vercel rule `bundle-dynamic-imports`)
**Impact:** All pages are eagerly imported — entire app loads upfront. Bundle is 580KB.

**Action:** Use `React.lazy()` + `Suspense` for all route pages in `src/App.tsx`:
```typescript
const LoginPage = lazy(() => import('@/features/auth/LoginPage'))
const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage'))
// etc.
```

### P1-03: Mock Auth Accepts Any Credentials
**Source:** security-sentinel
**File:** `src/lib/auth.tsx:32-43`
**Impact:** Complete authentication bypass — any non-empty email+password grants access.

**Note:** Acceptable for current mock phase, but architecture must be ready for real auth. Document as known limitation.

### P1-04: No CSRF Protection on Mutations
**Source:** security-sentinel
**Impact:** State-changing POST requests (approve/reject/review) have no CSRF tokens.

**Action:** When adding real backend, implement `SameSite=Strict` cookies + CSRF tokens.

### P1-05: CSV Formula Injection Vulnerability
**Source:** security-sentinel
**File:** `src/lib/csv.ts:9-18`
**Impact:** Cells starting with `=`, `+`, `-`, `@` can trigger formula execution in Excel.

**Action:** Prefix dangerous cells with `'` (single quote) to neutralize formulas.

### P1-06: Unsafe JSON.parse from localStorage
**Source:** kieran-typescript-reviewer
**File:** `src/lib/auth.tsx:21`
**Impact:** Corrupted/tampered localStorage causes uncaught exception. No schema validation.

**Action:** Wrap in try/catch, validate parsed shape against `User` type (or use Zod).

---

## P2 IMPORTANT

### P2-01: `buildQueryString` Duplicated (20 lines x2)
**Source:** architecture-strategist, code-simplicity-reviewer
**Files:** `src/features/minting/hooks.ts:5-24`, `src/features/redeem/hooks.ts:5-24`
**Action:** Extract to `src/lib/query.ts`

### P2-02: `exportToCsv` is Dead Code + CSV Download Logic Duplicated
**Source:** code-simplicity-reviewer
**Files:** `src/lib/csv.ts:1-29` (unused), `MintingPage.tsx:110-120`, `RedeemPage.tsx:102-112`
**Action:** Use existing `exportToCsv` in both pages, delete `buildCsvContent`

### P2-03: `Field` Component Duplicated in Both Modals
**Source:** architecture-strategist, code-simplicity-reviewer
**Files:** `MintingDetailModal.tsx:169-176`, `RedeemDetailModal.tsx:61-68`
**Action:** Extract to `src/components/Field.tsx`

### P2-04: Untyped `res.json()` in Mutation Hooks (implicit `any`)
**Source:** kieran-typescript-reviewer
**File:** `src/features/minting/hooks.ts:66-111`
**Action:** Type error responses against `ApiError`, type success responses explicitly

### P2-05: `ApiError` Type Defined but Never Used
**Source:** kieran-typescript-reviewer
**File:** `src/lib/types.ts:59-64`
**Action:** Import and use in mutation error handling, or remove

### P2-06: `status: string` on RecentActivity Should be Union
**Source:** kieran-typescript-reviewer
**File:** `src/lib/types.ts:82`
**Action:** Use discriminated union: `MintingStatus` when type='minting', `RedeemStatus` when type='redeem'

### P2-07: No `aria-describedby` on Form Error Messages
**Source:** best-practices-researcher
**Files:** All auth pages (`LoginPage`, `RegisterPage`, `ForgotPasswordPage`)
**Action:** Link error `<p>` to inputs via `aria-describedby`

### P2-08: Sortable Table Headers Not Keyboard Accessible
**Source:** best-practices-researcher
**File:** `src/components/DataTable.tsx:199-219`
**Action:** Add `role="button"`, `tabIndex={0}`, `onKeyDown`, `aria-sort`

### P2-09: No Component Tests for Pages
**Source:** best-practices-researcher
**Impact:** All 78 unit tests cover only utilities/hooks. Zero tests for React components.
**Action:** Add component tests for LoginPage, MintingPage, DataTable, MintingDetailModal

### P2-10: No Test Coverage Reporting
**Source:** best-practices-researcher
**Action:** Add `@vitest/coverage-v8` with minimum thresholds

### P2-11: Column Definitions Recreated Every Render
**Source:** best-practices-researcher (Vercel rule `rerender-memo`)
**Files:** `MintingPage.tsx:41`, `RedeemPage.tsx:38`
**Action:** Wrap with `useMemo` or hoist to module scope with factory function

### P2-12: No Shared API Client
**Source:** architecture-strategist, best-practices-researcher
**Impact:** Raw `fetch()` scattered across hooks. Base URL, headers, error handling duplicated.
**Action:** Create `src/lib/api.ts` with centralized fetch wrapper

---

## P3 NICE-TO-HAVE

### P3-01: Empty `src/hooks/` Directory — delete it
### P3-02: `useMintingDetail` Hook is Dead Code — never called
### P3-03: Mock Export API Handlers Dead Code — `handlers.ts:165-176`
### P3-04: Email Regex Duplicated 3x in `validators.ts` — extract constant
### P3-05: Missing `.env*` in `.gitignore`
### P3-06: No `eslint-plugin-jsx-a11y` for accessibility linting
### P3-07: No Vite `manualChunks` for vendor bundle splitting
### P3-08: `isTerminalStatus` in `status.ts` may be unused — verify and remove if so

---

## Vercel/React Best Practices Compliance

| Practice | Status | Notes |
|----------|--------|-------|
| Error Boundaries | FAIL | None at any level |
| Code Splitting (lazy routes) | FAIL | All imports are eager |
| React 19 useActionState | MISSING | Forms use manual useState |
| Server State (TanStack Query) | PASS | Proper query keys, cache invalidation |
| Client State (Context/Zustand) | PASS | Auth in Context, appropriate |
| URL State (search params) | PASS | Table filters persisted in URL |
| Feature-based Structure | PASS | Clean feature folders |
| TypeScript Strict Mode | PASS | All strictness flags enabled |
| Testing (Vitest + Playwright) | PARTIAL | Utilities tested, components not |
| Accessibility | PARTIAL | Radix provides base, gaps in custom code |
| Performance (memo, lazy) | NEEDS WORK | No lazy loading, no memoized columns |
| Security Headers | PARTIAL | Good base, missing HSTS + Permissions-Policy |
| MSW for Mocking | PASS | Proper v2 setup, shared handlers |

---

## Review Agents Used

1. **architecture-strategist** — Pattern compliance, duplication, component design
2. **security-sentinel** — OWASP Top 10, auth, CSP, headers, input validation
3. **kieran-typescript-reviewer** — Type safety, generics, strict mode compliance
4. **code-simplicity-reviewer** — YAGNI, dead code, unnecessary complexity
5. **best-practices-researcher** — Vercel React rules, React 19 patterns, a11y, testing
