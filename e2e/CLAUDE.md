# E2E Tests

Playwright end-to-end tests running against the dev server with the MSW
browser worker.

## Running

```bash
pnpm test:e2e              # Run all E2E tests
pnpm exec playwright test  # Run directly
```

## Structure

| File | Description |
|------|-------------|
| `smoke.spec.ts` | End-to-end smoke flow: login → Dashboard → Users → OTC Mint → Report → Profile (via navbar dropdown). Plus negative path for empty-credentials login. |

## Conventions

- Tag tests with `@e2e` in the describe block name
- Authenticate by filling the login form (any non-empty email + password
  works in mock mode; smoke spec uses the deterministic seed
  `demo@usdx.io` to land on the Demo Operator staff record)
- Use `getByRole` / `getByLabel` over `getByText` for strict mode compliance
- Each test is independent — no shared state between tests
- Tests run against `http://localhost:5173` (Vite dev server, auto-started by Playwright)

## Test Naming

```typescript
test.describe('feature @e2e', () => {
  test.describe('positive', () => {
    test('should ...', async ({ page }) => {})
  })
  test.describe('negative', () => {
    test('should ...', async ({ page }) => {})
  })
  test.describe('edge cases', () => {
    test('should ...', async ({ page }) => {})
  })
})
```
