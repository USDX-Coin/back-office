import { test, expect } from '@playwright/test'
import { installMockApi, ADMIN_STAFF } from './support/mock-api'
import { seedAuthenticatedSession } from './support/auth'

// USDX-207 — Rate page (spread beli/jual) + Fee config page (admin).
// Mock-backed (support/mock-api.ts). E2E acceptance criteria:
//   1. non-admin → field/aksi disabled atau 403
//   2. update rate spread beli/jual → tersimpan (tampil di card / order baru)
//   3. update fee config → row baru aktif

test.describe('USDX-207 rate + fee config @e2e', () => {
  test.describe('positive', () => {
    test('AC #2 — admin updates spread beli/jual and it persists on the rate card', async ({ page }) => {
      await installMockApi(page)
      await seedAuthenticatedSession(page)
      await page.goto('/settings/rate')

      const buy = page.getByLabel(/spread beli/i)
      await expect(buy).toBeVisible({ timeout: 15000 })

      // Seeded mode is MANUAL → manual rate is required for a valid submit.
      await page.getByLabel(/manual rate/i).fill('16300')
      await buy.fill('2.5')
      await page.getByLabel(/spread jual/i).fill('1.5')

      await page.getByRole('button', { name: /review and update/i }).click()
      const dialog = page.getByRole('dialog')
      await expect(dialog.getByText(/spread beli/i)).toBeVisible()
      await expect(dialog.getByText(/spread jual/i)).toBeVisible()
      await dialog.getByRole('button', { name: /yes, update rate/i }).click()

      // After save + refetch, the current-rate card reflects the new spreads.
      await expect(page.getByText('2.5%')).toBeVisible()
      await expect(page.getByText('1.5%')).toBeVisible()
    })

    test('AC #3 — admin updates fee config and the new mint fee is active', async ({ page }) => {
      await installMockApi(page)
      await seedAuthenticatedSession(page)
      await page.goto('/settings/fee')

      // Target inputs by id — the card reuses similar aria-labels, so a
      // label-text match would be ambiguous.
      const mint = page.locator('#mintFeePct')
      await expect(mint).toBeVisible({ timeout: 15000 })
      await mint.fill('2.5')
      await page.locator('#pgFeeVaFlat').fill('5000')
      await page.locator('#pgFeeQrisPct').fill('0.8')

      await page.getByRole('button', { name: /update fee config/i }).click()

      // Card (aria-label "mint fee percent") reflects the new active config.
      await expect(page.getByLabel(/mint fee percent/i)).toHaveText('2.5%')
    })

    // USDX-637 — Minimum Mint (Rp) rides in the same snapshot.
    test('USDX-637 — admin lowers the minimum mint and the card shows it', async ({ page }) => {
      await installMockApi(page)
      await seedAuthenticatedSession(page)
      await page.goto('/settings/fee')

      const minMint = page.locator('#minMintIdr')
      await expect(minMint).toBeVisible({ timeout: 15000 })
      // Seeded from the active config, not blank.
      await expect(minMint).toHaveValue('20000')

      await minMint.fill('15000')
      await page.getByRole('button', { name: /update fee config/i }).click()

      await expect(page.getByLabel(/minimum mint idr/i)).toHaveText(/15\.000/)
    })
  })

  test.describe('negative', () => {
    // The Rp 10.000 floor is the backend's; the client answers first so the
    // operator is not sent on a round trip to be told no.
    test('USDX-637 — below the floor is refused inline and never leaves the browser', async ({
      page,
    }) => {
      await installMockApi(page)
      await seedAuthenticatedSession(page)
      await page.goto('/settings/fee')

      let posted = false
      page.on('request', (req) => {
        if (req.method() === 'POST' && req.url().includes('/api/v1/fee-config')) posted = true
      })

      const minMint = page.locator('#minMintIdr')
      await expect(minMint).toBeVisible({ timeout: 15000 })
      await minMint.fill('5000')
      await page.getByRole('button', { name: /update fee config/i }).click()

      await expect(page.getByText(/minimum mint must be at least 10,000/i)).toBeVisible()
      expect(posted).toBe(false)
      // The active value is untouched.
      await expect(page.getByLabel(/minimum mint idr/i)).toHaveText(/20\.000/)
    })
  })

  test.describe('AC #1 — non-admin gating', () => {
    test('DEVELOPER sees the fee config read-only (no update form)', async ({ page }) => {
      await installMockApi(page, {
        routes: {
          'GET /api/v1/auth/me': (route) => {
            route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({
                status: 'success',
                metadata: null,
                data: { ...ADMIN_STAFF, role: 'DEVELOPER' },
              }),
            })
            return true
          },
        },
      })
      await seedAuthenticatedSession(page)
      await page.goto('/settings/fee')

      await expect(page.getByText(/your role does not have permission/i)).toBeVisible({
        timeout: 15000,
      })
      await expect(page.getByRole('button', { name: /update fee config/i })).toHaveCount(0)
      // The current config is still readable.
      await expect(page.getByLabel(/mint fee percent/i)).toBeVisible()
    })

    test('DEVELOPER sees the rate page read-only (no update form)', async ({ page }) => {
      await installMockApi(page, {
        routes: {
          'GET /api/v1/auth/me': (route) => {
            route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({
                status: 'success',
                metadata: null,
                data: { ...ADMIN_STAFF, role: 'DEVELOPER' },
              }),
            })
            return true
          },
        },
      })
      await seedAuthenticatedSession(page)
      await page.goto('/settings/rate')

      await expect(page.getByText(/your role does not have permission/i)).toBeVisible({
        timeout: 15000,
      })
      await expect(page.getByRole('button', { name: /review and update/i })).toHaveCount(0)
    })
  })
})
