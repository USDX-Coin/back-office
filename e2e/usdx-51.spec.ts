import { test, expect, type Page } from '@playwright/test'

// USDX-51 — Mint list/form separation. Real BE (Vite proxy) for /api/v1/auth/*
// and POST /api/v1/mint; /api/v1/requests is still MSW-served (USDX-49 strict
// browser bypass list). Tests assert routing, AC #2 (button visible), AC #3
// (button → /mint/new), AC #6 (deep-link to /mint/new not blocked), and the
// search wiring delta vs USDX-50 (URL ?search= reflected after typing).
const EMAIL = process.env.USDX_TEST_EMAIL ?? ''
const PASSWORD = process.env.USDX_TEST_PASSWORD ?? ''
const HAS_CREDS = !!EMAIL && !!PASSWORD

async function login(page: Page) {
  await page.goto('/login')
  await page.getByLabel(/^email$/i).fill(EMAIL)
  const pw = page.getByLabel(/^password$/i)
  await pw.fill(PASSWORD)
  await pw.press('Enter')
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20000 })
}

test.describe('USDX-51 mint list/form separation @e2e', () => {
  test.describe('positive', () => {
    test('AC #1 — /mint renders the request table', async ({ page }) => {
      test.skip(!HAS_CREDS, 'real credentials not provided')
      await login(page)
      await page.goto('/mint')

      await expect(
        page.getByRole('heading', { name: /^mint$/i, level: 1 })
      ).toBeVisible({ timeout: 15000 })
      await expect(page.locator('table')).toBeVisible({ timeout: 15000 })
    })

    test('AC #2 + #3 — "Add Mint OTC" button visible top-right and routes to /mint/new', async ({
      page,
    }) => {
      test.skip(!HAS_CREDS, 'real credentials not provided')
      await login(page)
      await page.goto('/mint')

      const addButtons = page.getByRole('button', { name: /add mint otc/i })
      await expect(addButtons.first()).toBeVisible({ timeout: 15000 })

      await addButtons.first().click()
      await expect(page).toHaveURL(/\/mint\/new/, { timeout: 5000 })
      await expect(
        page.getByRole('heading', { name: /mint request/i })
      ).toBeVisible()
    })

    test('AC #6 — direct deep-link to /mint/new is not blocked', async ({ page }) => {
      test.skip(!HAS_CREDS, 'real credentials not provided')
      await login(page)
      // Skip the list page entirely; the form must still render.
      await page.goto('/mint/new')
      await expect(page).toHaveURL(/\/mint\/new$/)
      await expect(
        page.getByRole('heading', { name: /mint request/i })
      ).toBeVisible({ timeout: 10000 })
      await expect(
        page.getByRole('button', { name: /submit mint request/i })
      ).toBeVisible()
    })

    test('search input writes to URL ?search= (USDX-51 delta)', async ({ page }) => {
      test.skip(!HAS_CREDS, 'real credentials not provided')
      await login(page)
      await page.goto('/mint')

      await page.getByLabel(/^search$/i).fill('robert')
      await expect(page).toHaveURL(/[?&]search=robert(&|$)/, { timeout: 5000 })
    })
  })

  test.describe('negative', () => {
    test('unauthenticated /mint redirects to /login', async ({ page }) => {
      // Independent of real-BE creds — the auth guard runs client-side.
      await page.goto('/mint')
      await expect(page).toHaveURL(/\/login/)
    })

    test('unauthenticated /mint/new redirects to /login', async ({ page }) => {
      await page.goto('/mint/new')
      await expect(page).toHaveURL(/\/login/)
    })
  })
})
