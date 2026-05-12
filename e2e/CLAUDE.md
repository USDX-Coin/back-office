# E2E Tests

Playwright end-to-end tests against the Vite dev server (`pnpm dev`, auto-started
by Playwright). The dev server runs the MSW browser worker, but the API paths
these tests touch are all in MSW's `INTEGRATION_PATHS` bypass list (see
`src/mocks/browser.ts`) — so they reach the network, where the tests decide what
happens.

Two layers:

| Layer | Files | Backend | Runs in CI? |
|-------|-------|---------|-------------|
| **Hermetic (USDX-26)** | `usdx-26-*.spec.ts` + `support/` | Mocked via `page.route()` (`support/mock-api.ts`) — no real BE, no credentials, no on-chain side effects | ✅ yes (`.github/workflows/ci.yml` → `playwright test usdx-26`) |
| **Live integration (per-ticket)** | `usdx-39`, `usdx-40`, `usdx-47`, `usdx-51`, `usdx-52`, `usdx-53` | Real BE via the Vite proxy | Only with `USDX_TEST_EMAIL` / `USDX_TEST_PASSWORD` set; most cases `test.skip` otherwise |

## Critical-flow coverage (USDX-26)

| # | Flow | Spec |
|---|------|------|
| 1 | Login — valid + invalid + access control / session | `usdx-26-auth.spec.ts` |
| 2 | Submit mint request → appears in list | `usdx-26-otc.spec.ts` (mint) |
| 3 | Submit burn request → appears in list | `usdx-26-otc.spec.ts` (burn) |
| 4 | Filter request list (status / chain / safe / search) + open detail modal | `usdx-26-requests.spec.ts` |
| 5 | User CRUD (create → password reveal → list, edit KYC, delete) | `usdx-26-users.spec.ts` |

Each spec has `positive` / `negative` / `edge cases` describe blocks.

## Running

```bash
pnpm test:e2e                          # all @e2e specs (legacy ones skip without creds)
pnpm exec playwright test usdx-26      # just the hermetic USDX-26 suite
pnpm exec playwright test usdx-26-auth # one file
USDX_TEST_EMAIL=... USDX_TEST_PASSWORD=... pnpm test:e2e   # incl. live-BE specs
```

## Conventions

- Tag tests with `@e2e` in the `describe` block name (`pnpm test:e2e` greps `@e2e`).
- Hermetic specs: `await installMockApi(page[, opts])` first, then either
  `loginViaForm(page)` (auth UI tests) or `seedAuthenticatedSession(page)`
  before `page.goto(...)`. `installMockApi` returns mutable state; `opts.routes`
  forces error/edge responses per endpoint.
- Use `getByRole` / `getByLabel` over `getByText` for strict-mode compliance.
- Each test is independent — no shared state between tests.
- Tests run against `http://localhost:5173`.

## Test naming

```typescript
test.describe('feature @e2e', () => {
  test.describe('positive', () => { test('should ...', async ({ page }) => {}) })
  test.describe('negative', () => { test('should ...', async ({ page }) => {}) })
  test.describe('edge cases', () => { test('should ...', async ({ page }) => {}) })
})
```
