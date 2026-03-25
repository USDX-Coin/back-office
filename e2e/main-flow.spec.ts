import { test, expect } from '@playwright/test'

test.describe('main flow @e2e', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto('/login')
    await page.getByLabel('Email').fill('admin@usdx.com')
    await page.getByLabel('Password').fill('password123')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test.describe('positive', () => {
    test('should show dashboard with stats', async ({ page }) => {
      await expect(page.getByText('Total Minting')).toBeVisible()
      await expect(page.getByText('Total Redeem')).toBeVisible()
      await expect(page.getByText('Recent Activity')).toBeVisible()
    })

    test('should navigate to minting page', async ({ page }) => {
      await page.getByRole('link', { name: 'Minting' }).click()
      await expect(page).toHaveURL(/\/minting/)
      await expect(page.getByRole('heading', { name: 'Minting Requests' })).toBeVisible()
    })

    test('should open minting detail modal', async ({ page }) => {
      await page.getByRole('link', { name: 'Minting' }).click()
      await expect(page).toHaveURL(/\/minting/)

      // Wait for table data to load
      await expect(page.getByRole('table')).toBeVisible()
      const detailButtons = page.getByRole('button', { name: 'Detail' })
      await expect(detailButtons.first()).toBeVisible({ timeout: 10000 })
      await detailButtons.first().click()

      // Modal should open with request details
      await expect(page.getByText(/Minting Request #/)).toBeVisible()
    })

    test('should navigate to redeem page', async ({ page }) => {
      await page.getByRole('link', { name: 'Redeem' }).click()
      await expect(page).toHaveURL(/\/redeem/)
      await expect(page.getByRole('heading', { name: 'Redeem Requests' })).toBeVisible()
    })

    test('should open redeem detail modal', async ({ page }) => {
      await page.getByRole('link', { name: 'Redeem' }).click()
      await expect(page).toHaveURL(/\/redeem/)

      await expect(page.getByRole('table')).toBeVisible()
      const detailButtons = page.getByRole('button', { name: 'Detail' })
      await expect(detailButtons.first()).toBeVisible({ timeout: 10000 })
      await detailButtons.first().click()

      await expect(page.getByText(/Redeem Request #/)).toBeVisible()
    })

    test('should logout and redirect to login', async ({ page }) => {
      // Open profile dropdown
      await page.getByRole('button', { name: /admin/i }).click()
      await page.getByText('Logout').click()
      await expect(page).toHaveURL(/\/login/)
    })
  })
})
