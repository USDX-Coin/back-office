import { test, expect, type Page } from '@playwright/test'

// USDX-52 — Burn list/form separation. Real BE (Vite proxy) for /api/v1/auth/*
// and POST /api/v1/burn; /api/v1/requests is still MSW-served (USDX-49 strict
// browser bypass list). Tests assert routing, AC #2 (button visible), AC #3
// (button → /burn/new), deep-link to /burn/new not blocked, and the search
// wiring delta vs USDX-50 (URL ?search= reflected after typing).
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

test.describe('USDX-52 burn list/form separation @e2e', () => {
  test.describe('positive', () => {
    test('AC #1 — /burn renders the request table', async ({ page }) => {
      test.skip(!HAS_CREDS, 'real credentials not provided')
      await login(page)
      await page.goto('/burn')

      await expect(
        page.getByRole('heading', { name: /^burn$/i, level: 1 })
      ).toBeVisible({ timeout: 15000 })
      await expect(page.locator('table')).toBeVisible({ timeout: 15000 })
    })

    test('AC #2 + #3 — "Add Burn OTC" button visible top-right and routes to /burn/new', async ({
      page,
    }) => {
      test.skip(!HAS_CREDS, 'real credentials not provided')
      await login(page)
      await page.goto('/burn')

      const addButtons = page.getByRole('button', { name: /add burn otc/i })
      await expect(addButtons.first()).toBeVisible({ timeout: 15000 })

      await addButtons.first().click()
      await expect(page).toHaveURL(/\/burn\/new/, { timeout: 5000 })
      await expect(
        page.getByRole('heading', { name: /burn request/i })
      ).toBeVisible()
    })

    test('direct deep-link to /burn/new is not blocked', async ({ page }) => {
      test.skip(!HAS_CREDS, 'real credentials not provided')
      await login(page)
      // Skip the list page entirely; the form must still render.
      await page.goto('/burn/new')
      await expect(page).toHaveURL(/\/burn\/new$/)
      await expect(
        page.getByRole('heading', { name: /burn request/i })
      ).toBeVisible({ timeout: 10000 })
      await expect(
        page.getByRole('button', { name: /submit burn request/i })
      ).toBeVisible()
    })

    test('search input writes to URL ?search= (USDX-52 delta)', async ({ page }) => {
      test.skip(!HAS_CREDS, 'real credentials not provided')
      await login(page)
      await page.goto('/burn')

      await page.getByLabel(/^search$/i).fill('robert')
      await expect(page).toHaveURL(/[?&]search=robert(&|$)/, { timeout: 5000 })
    })
  })

  test.describe('negative', () => {
    test('unauthenticated /burn redirects to /login', async ({ page }) => {
      // Independent of real-BE creds — the auth guard runs client-side.
      await page.goto('/burn')
      await expect(page).toHaveURL(/\/login/)
    })

    test('unauthenticated /burn/new redirects to /login', async ({ page }) => {
      await page.goto('/burn/new')
      await expect(page).toHaveURL(/\/login/)
    })
  })
})
