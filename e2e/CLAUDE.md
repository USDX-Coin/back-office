# E2E Tests

Playwright end-to-end tests running against the dev server with MSW mock API.

## Running

```bash
pnpm test:e2e              # Run all E2E tests
pnpm exec playwright test  # Run directly
```

## Structure

| File | Description |
|------|-------------|
| `smoke.spec.ts` | Basic page load verification |
| `auth.spec.ts` | Login, register navigation, forgot password, redirect guard |
| `main-flow.spec.ts` | Dashboard → Minting → Detail → Redeem → Logout |

## Conventions

- Tag tests with `@e2e` in the describe block name
- Use `test.beforeEach` for login setup on authenticated tests
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
