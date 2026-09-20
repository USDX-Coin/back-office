import { test, expect } from '@playwright/test'
import { installMockApi } from './support/mock-api'
import { seedAuthenticatedSession } from './support/auth'

// USDX-206 — backoffice "User Transaction" (consumer mint orders). Read-only
// list + filter + detail. Mock-backed (support/mock-api.ts § seedOrders).
// E2E acceptance criteria:
//   1. open menu → list renders + filter works
//   2. detail shows fee / spread / revenue breakdown
//   3. read-only — no approve action

test.describe('USDX-206 user transaction @e2e', () => {
  test.describe('positive', () => {
    test('sidebar menu → list renders seeded consumer orders', async ({ page }) => {
      await installMockApi(page)
      await seedAuthenticatedSession(page)
      await page.goto('/dashboard')

      // § 4 P2-1 — "User Transaction" jadi "Transaksi Nasabah".
      await page.getByRole('link', { name: /^transaksi nasabah$/i }).click()
      await expect(page).toHaveURL(/\/transactions/)
      await expect(page.getByRole('heading', { name: /transaksi nasabah/i })).toBeVisible({
        timeout: 15000,
      })

      // Three seeded orders → three clickable rows (by amount in the aria-label).
      await expect(page.getByRole('button', { name: /1000\.00 USDX/ })).toBeVisible()
      await expect(page.getByRole('button', { name: /500\.00 USDX/ })).toBeVisible()
      await expect(page.getByRole('button', { name: /120\.50 USDX/ })).toBeVisible()
    })

    test('Status filter narrows the list to COMPLETED orders', async ({ page }) => {
      await installMockApi(page)
      await seedAuthenticatedSession(page)
      await page.goto('/transactions')
      await expect(page.getByRole('button', { name: /1000\.00 USDX/ })).toBeVisible({
        timeout: 15000,
      })

      await page.getByRole('button', { name: /^filter/i }).click()
      await page.getByRole('combobox', { name: 'Status' }).click()
      await page.getByRole('option', { name: /^selesai$/i }).click()
      await page.getByRole('button', { name: /^terapkan$/i }).click()

      await expect(page).toHaveURL(/status=COMPLETED/)
      await expect(page.getByRole('button', { name: /1000\.00 USDX/ })).toBeVisible()
      await expect(page.getByRole('button', { name: /500\.00 USDX/ })).toHaveCount(0)
      await expect(page.getByRole('button', { name: /120\.50 USDX/ })).toHaveCount(0)
    })

    test('row → detail modal shows fee / spread / revenue breakdown', async ({ page }) => {
      await installMockApi(page)
      await seedAuthenticatedSession(page)
      await page.goto('/transactions')
      await page.getByRole('button', { name: /1000\.00 USDX/ }).click()

      await expect(page).toHaveURL(/\/transactions\/ord_completed/)
      const dialog = page.getByRole('dialog')
      await expect(dialog.getByText(/^kurs & spread$/i)).toBeVisible()
      await expect(dialog.getByText(/^rincian biaya$/i)).toBeVisible()
      await expect(dialog.getByText(/^perkiraan pendapatan$/i)).toBeVisible()
      await expect(dialog.getByText(/spread beli/i)).toBeVisible()
      await expect(dialog.getByText(/spread jual/i)).toBeVisible()
      await expect(dialog.getByText(/^biaya payment gateway$/i)).toBeVisible()
    })
  })

  test.describe('AC #3 — read-only', () => {
    test('no approve / reject controls in the list or the detail modal', async ({ page }) => {
      await installMockApi(page)
      await seedAuthenticatedSession(page)
      await page.goto('/transactions')
      await expect(page.getByRole('button', { name: /1000\.00 USDX/ })).toBeVisible({
        timeout: 15000,
      })
      await expect(page.getByRole('button', { name: /^approve$/i })).toHaveCount(0)
      await expect(page.getByRole('button', { name: /^reject$/i })).toHaveCount(0)

      await page.getByRole('button', { name: /1000\.00 USDX/ }).click()
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible()
      await expect(dialog.getByRole('button', { name: /approve/i })).toHaveCount(0)
      await expect(dialog.getByRole('button', { name: /reject/i })).toHaveCount(0)
    })
  })

  test.describe('edge cases', () => {
    test('deep-link /transactions/:id opens the detail modal on load', async ({ page }) => {
      await installMockApi(page)
      await seedAuthenticatedSession(page)
      await page.goto('/transactions/ord_completed')

      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible({ timeout: 15000 })
      await expect(dialog.getByText(/order mint/i)).toBeVisible()
    })

    test('order without a chosen channel shows a dash for Total pay (IDR)', async ({ page }) => {
      await installMockApi(page)
      await seedAuthenticatedSession(page)
      await page.goto('/transactions?paymentStatus=REQUESTED')

      // Only the unpaid order remains; its Total pay (IDR) cell is a dash.
      await expect(page.getByRole('button', { name: /120\.50 USDX/ })).toBeVisible({
        timeout: 15000,
      })
      await expect(page.getByRole('button', { name: /1000\.00 USDX/ })).toHaveCount(0)
      await expect(page.getByText('—').first()).toBeVisible()
    })
  })
})
