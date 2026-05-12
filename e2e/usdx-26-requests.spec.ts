import { test, expect } from '@playwright/test'
import { installMockApi } from './support/mock-api'
import { seedAuthenticatedSession } from './support/auth'

// USDX-26 — Critical flow #4: filter the request list (Mint / Burn pages share
// the MintBurnFilterToolbar). Also exercises opening the request detail modal
// and its on-chain links (the USDX-71 feature) directly from the list.

test.describe('USDX-26 request list filters @e2e', () => {
  test.beforeEach(async ({ page }) => {
    await installMockApi(page)
    await seedAuthenticatedSession(page)
  })

  test.describe('positive', () => {
    test('/mint renders seeded mint requests in a table', async ({ page }) => {
      await page.goto('/mint')
      await expect(page.getByRole('heading', { name: /^mint/i, level: 1 })).toBeVisible({ timeout: 15000 })
      await expect(page.locator('table')).toBeVisible()
      await expect(page.getByRole('button', { name: /^Open mint request for/i }).first()).toBeVisible({ timeout: 10000 })
    })

    test('status filter narrows the list and reflects in the URL', async ({ page }) => {
      await page.goto('/mint')
      await expect(page.getByRole('button', { name: /Open mint request for .* 1000\.000000 USDX/ })).toBeVisible({ timeout: 10000 })

      await page.getByRole('combobox', { name: 'Status filter' }).click()
      await page.getByRole('option', { name: /pending approval/i }).click()

      await expect(page).toHaveURL(/[?&]status=PENDING_APPROVAL(&|$)/)
      // exactly one PENDING_APPROVAL mint request remains (100 USDX); wait for the refetch
      await expect(page.getByRole('button', { name: /^Open mint request for/i })).toHaveCount(1)
      await expect(page.getByRole('button', { name: /Open mint request for .* 100\.000000 USDX/ })).toBeVisible()
      await expect(page.getByRole('button', { name: /Open mint request for .* 1000\.000000 USDX/ })).toHaveCount(0)
    })

    test('safe filter works on the burn list', async ({ page }) => {
      await page.goto('/burn')
      await expect(page.getByRole('button', { name: /^Open burn request for/i }).first()).toBeVisible({ timeout: 10000 })

      await page.getByRole('combobox', { name: 'Safe filter' }).click()
      await page.getByRole('option', { name: /manager safe/i }).click()

      await expect(page).toHaveURL(/[?&]safeType=MANAGER(&|$)/)
      // seeded burn data has exactly one MANAGER request (50 USDX, IDR_TRANSFERRED)
      await expect(page.getByRole('button', { name: /^Open burn request for/i })).toHaveCount(1)
      await expect(page.getByRole('button', { name: /Open burn request for .* 50\.000000 USDX/ })).toBeVisible()
      await expect(page.getByRole('button', { name: /Open burn request for .* 10\.000000 USDX/ })).toHaveCount(0)
    })

    test('search box writes ?search= to the URL', async ({ page }) => {
      await page.goto('/mint')
      await page.getByLabel(/^search$/i).fill('robert')
      await expect(page).toHaveURL(/[?&]search=robert(&|$)/, { timeout: 5000 })
      await expect(page.getByRole('button', { name: /^Open mint request for Robert Deon/i }).first()).toBeVisible()
    })

    test('clicking a row opens the detail modal with on-chain links', async ({ page }) => {
      await page.goto('/mint')
      await page.getByRole('button', { name: /Open mint request for .* 1000\.000000 USDX/ }).click()
      const dialog = page.getByRole('dialog')
      await expect(dialog.getByRole('heading', { name: /mint request/i })).toBeVisible()
      await expect(dialog.locator('a[href^="https://polygonscan.com/tx/"]')).toBeVisible()
      await expect(dialog.locator('a[href^="https://app.safe.global/transactions/tx"]')).toBeVisible()
    })
  })

  test.describe('negative', () => {
    test('a filter that matches nothing shows the no-results state', async ({ page }) => {
      // No seeded mint request has status APPROVED.
      await page.goto('/mint?status=APPROVED')
      await expect(page.getByRole('heading', { name: /^mint/i, level: 1 })).toBeVisible({ timeout: 15000 })
      await expect(page.getByText(/no.*match|no results|clear filters/i).first()).toBeVisible({ timeout: 10000 })
      await expect(page.getByRole('button', { name: /^Open mint request for/i })).toHaveCount(0)
    })

    test('Clear resets the filters and the URL', async ({ page }) => {
      await page.goto('/mint?status=PENDING_APPROVAL')
      await expect(page.getByRole('button', { name: /Open mint request for .* 100\.000000 USDX/ })).toBeVisible({ timeout: 10000 })
      await page.getByRole('button', { name: /^clear$/i }).click()
      await expect(page).not.toHaveURL(/status=/)
      await expect(page.getByRole('button', { name: /Open mint request for .* 1000\.000000 USDX/ })).toBeVisible()
    })
  })

  test.describe('edge cases', () => {
    test('combining status + safe filters reflects both in the URL', async ({ page }) => {
      // start with status pre-applied via the URL, then add the safe filter via the toolbar
      await page.goto('/mint?status=EXECUTED')
      await expect(page.getByRole('button', { name: /^Open mint request for/i }).first()).toBeVisible({ timeout: 10000 })
      await page.getByRole('combobox', { name: 'Safe filter' }).click()
      await page.getByRole('option', { name: /staff safe/i }).click()
      await expect(page).toHaveURL(/status=EXECUTED/)
      await expect(page).toHaveURL(/safeType=STAFF/)
    })

    test('deep-linking with a filter applies it on load', async ({ page }) => {
      await page.goto('/burn?status=IDR_TRANSFERRED')
      await expect(page.getByRole('button', { name: /Open burn request for .* 50\.000000 USDX/ })).toBeVisible({ timeout: 10000 })
      await expect(page.getByRole('button', { name: /Open burn request for .* 10\.000000 USDX/ })).toHaveCount(0)
    })

    test('detail modal closes on Escape and the list stays put', async ({ page }) => {
      await page.goto('/mint')
      await page.getByRole('button', { name: /Open mint request for .* 1000\.000000 USDX/ }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(page.getByRole('dialog')).toHaveCount(0)
      await expect(page).toHaveURL(/\/mint(\?|$)/)
    })
  })
})
