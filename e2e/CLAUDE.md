# E2E Tests

Frontend-only Playwright suite — the API is mocked in-test via `page.route()`
(`support/mock-api.ts`), so the tests run in CI with no backend, no credentials,
and no on-chain side effects. Backend behaviour has its own tests in the
`backend` repo (USDX-25 unit/integration/E2E, USDX-67 burn coverage).

Why mocked, not real-BE: the dev backend runs on Polygon **mainnet**, so a real
mint/burn submission would propose a real Safe transaction; burn also can't be
done for-real (the BE verifies `depositTxHash` on-chain). The mocked submit
fully exercises the FE side of the contract — form validation, request body,
success UX, list refresh — without the side effects.

## Critical-flow coverage (USDX-26)

| # | Flow | Spec |
|---|------|------|
| 1 | Login — valid + invalid + access-control / session | `usdx-26-auth.spec.ts` |
| 2 | Submit mint request → appears in list | `usdx-26-otc.spec.ts` (mint) |
| 3 | Submit burn request → appears in list | `usdx-26-otc.spec.ts` (burn) |
| 4 | Filter request list (status / safe / search / deep-link) + open detail modal | `usdx-26-requests.spec.ts` |
| 5 | User CRUD (create → password reveal → list, edit, delete) + directory filters | `usdx-26-users.spec.ts` |
| 6 | KYC review (USDX-154/155): sidebar badge → list oldest-first → detail modal (PII + photos) → approve / reject → refresh | `usdx-155-kyc.spec.ts` |
| 7 | User activation (USDX-156): list filter + badges → detail resend (confirm, cooldown, 409/429) → create form phone + no password | `usdx-156-users-activation.spec.ts` |

Each spec has `positive` / `negative` / `edge cases` describe blocks.

## Running

```bash
pnpm test:e2e                          # all @e2e specs
pnpm exec playwright test usdx-26-auth # one file
pnpm exec playwright test -g "logout"  # filter by title
```

The dev server is started by Playwright with `VITE_E2E=true`, which makes
`main.tsx` skip the MSW browser worker — an active service worker re-issues
passthrough requests from the SW context and would bypass `page.route()`.

## Conventions

- Tag tests with `@e2e` in the `describe` block name (`pnpm test:e2e` greps `@e2e`).
- `await installMockApi(page[, opts])` first, then either `loginViaForm(page)`
  (auth-UI tests) or `seedAuthenticatedSession(page)` before `page.goto(...)`.
  `installMockApi` returns mutable state; `opts.routes` (keyed `"METHOD /path"`)
  forces error/edge responses per endpoint.
- Use `getByRole` / `getByLabel` over `getByText` for strict-mode compliance.
  Radix `Select` triggers aren't reliably label-associated — target them by id
  (e.g. `page.locator('#kycStatus')`).
- Each test is independent — no shared state between tests.
- Tests run against `http://localhost:5173` (override with `E2E_PORT=5199 pnpm test:e2e` when the port is taken).

## Test naming

```typescript
test.describe('feature @e2e', () => {
  test.describe('positive', () => { test('should ...', async ({ page }) => {}) })
  test.describe('negative', () => { test('should ...', async ({ page }) => {}) })
  test.describe('edge cases', () => { test('should ...', async ({ page }) => {}) })
})
```
