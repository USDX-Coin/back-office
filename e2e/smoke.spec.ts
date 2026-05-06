import { test, expect } from '@playwright/test'

const DEMO_EMAIL = 'demo@usdx.io'
const DEMO_PASSWORD = 'anything'

// USDX-39: this smoke spec was written against the legacy mock-auth flow.
// Real BE login no longer accepts `demo@usdx.io / anything`, so these flows
// are skipped here — `usdx-39.spec.ts` is the active integration smoke.
test.describe('smoke @e2e', () => {
  test.beforeEach(() => {
    test.fixme(true, 'Legacy mock-auth smoke; superseded by usdx-39.spec.ts.')
  })
  test('should load login page', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible()
  })

  test('should sign in and reach the Dashboard', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel(/^email$/i).fill(DEMO_EMAIL)
    await page.getByLabel(/^password$/i).fill(DEMO_PASSWORD)
    await page.getByRole('button', { name: /^sign in$/i }).click()
    await expect(page.getByRole('heading', { name: /operations overview/i })).toBeVisible({ timeout: 10000 })
  })

  test('should navigate Dashboard → Users → OTC Mint → Report', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel(/^email$/i).fill(DEMO_EMAIL)
    await page.getByLabel(/^password$/i).fill(DEMO_PASSWORD)
    await page.getByRole('button', { name: /^sign in$/i }).click()
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })

    await page.getByRole('link', { name: /^user$/i }).first().click()
    await expect(page).toHaveURL(/\/users/)
    await expect(page.getByRole('heading', { name: /^users$/i })).toBeVisible()

    // OTC submenu is collapsed from another route — click the group toggle first
    await page.getByRole('button', { name: /^otc$/i }).click()
    await page.getByRole('link', { name: /^mint$/i }).click()
    await expect(page).toHaveURL(/\/otc\/mint/)
    await expect(page.getByRole('heading', { name: /otc minting/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /submit mint request/i })).toBeVisible()

    await page.getByRole('link', { name: /^report$/i }).click()
    await expect(page).toHaveURL(/\/report/)
    await expect(page.getByRole('heading', { name: /transaction reporting/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /export csv/i })).toBeVisible()
  })

  test('should reach Profile via the navbar dropdown (NOT a sidebar item)', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel(/^email$/i).fill(DEMO_EMAIL)
    await page.getByLabel(/^password$/i).fill(DEMO_PASSWORD)
    await page.getByRole('button', { name: /^sign in$/i }).click()
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })

    const sidebarProfileLink = page.locator('aside').getByRole('link', { name: /profile/i })
    await expect(sidebarProfileLink).toHaveCount(0)

    await page.getByRole('button', { name: /open profile menu/i }).click()
    await page.getByRole('menuitem', { name: /view profile/i }).click()
    await expect(page).toHaveURL(/\/profile/)
  })

  test('should show inline error when login submitted with empty fields', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: /^sign in$/i }).click()
    await expect(page.getByText(/email is required/i)).toBeVisible()
    await expect(page).toHaveURL(/\/login/)
  })
})
