import { test, expect } from '@playwright/test'
import { installMockApi, seedOrders, seedRedeemOrders } from './support/mock-api'
import { seedAuthenticatedSession } from './support/auth'

// USDX-245 — User Transaction extended to redeem orders + fee config redeem
// fields. Mock-backed (support/mock-api.ts § seedRedeemOrders / FEE_CONFIG).
// E2E acceptance criteria:
//   1. filter type=REDEEM → redeem rows; Status options switch to RedeemStatus
//   2. redeem detail → fee / net payout / bank (masked) + burn tx
//   3. read-only — no approve/reject
//   4. fee config pre-fills 5 fields; admin updates redeem fee → active

test.describe('USDX-245 user transaction redeem @e2e', () => {
  const mixedOrders = () => [...seedOrders(), ...seedRedeemOrders()]

  test.describe('positive', () => {
    test('AC #1 — filter type=REDEEM narrows the list to redeem orders', async ({ page }) => {
      await installMockApi(page, { orders: mixedOrders() })
      await seedAuthenticatedSession(page)
      await page.goto('/transactions')
      await expect(page.getByRole('button', { name: /1000\.00 USDX/ })).toBeVisible({
        timeout: 15000,
      })

      await page.getByRole('button', { name: /^filter/i }).click()
      await page.getByRole('combobox', { name: 'Type' }).click()
      await page.getByRole('option', { name: /^redeem$/i }).click()
      await page.getByRole('button', { name: /^apply$/i }).click()

      await expect(page).toHaveURL(/type=REDEEM/)
      await expect(page.getByRole('button', { name: /100\.00 USDX/ })).toBeVisible()
      await expect(page.getByRole('button', { name: /250\.00 USDX/ })).toBeVisible()
      // Mint rows are filtered out.
      await expect(page.getByRole('button', { name: /1000\.00 USDX/ })).toHaveCount(0)
    })

    test('AC #1 — Status options switch to RedeemStatus when type=REDEEM', async ({ page }) => {
      await installMockApi(page, { orders: seedRedeemOrders() })
      await seedAuthenticatedSession(page)
      await page.goto('/transactions?type=REDEEM')
      await expect(page.getByRole('button', { name: /100\.00 USDX/ })).toBeVisible({
        timeout: 15000,
      })

      await page.getByRole('button', { name: /^filter/i }).click()
      await page.getByRole('combobox', { name: 'Status' }).click()
      await expect(page.getByRole('option', { name: /awaiting burn/i })).toBeVisible()
      await expect(page.getByRole('option', { name: /payout complete/i })).toBeVisible()
    })

    test('AC #2 — redeem detail shows fee / net payout / bank (full) + burn tx', async ({
      page,
    }) => {
      await installMockApi(page, { orders: seedRedeemOrders() })
      await seedAuthenticatedSession(page)
      await page.goto('/transactions')
      await page.getByRole('button', { name: /100\.00 USDX/ }).click()

      await expect(page).toHaveURL(/\/transactions\/ord_redeem_done/)
      const dialog = page.getByRole('dialog')
      await expect(dialog.getByText(/redeem order/i)).toBeVisible()
      await expect(dialog.getByText(/spread jual/i)).toBeVisible()
      await expect(dialog.getByText(/disbursement fee/i)).toBeVisible()
      await expect(dialog.getByText(/net payout/i)).toBeVisible()
      await expect(dialog.getByText(/bank tujuan/i)).toBeVisible()
      // Bank name + full account number + account name shown (un-mask, USDX-270).
      await expect(dialog.getByText('BCA')).toBeVisible()
      await expect(dialog.getByText('1234563271')).toBeVisible()
      await expect(dialog.getByText('BUDI SANTOSO')).toBeVisible()
      // Burn tx hash field present (redeem on-chain reference).
      await expect(dialog.getByText(/burn tx hash/i)).toBeVisible()
    })
  })

  test.describe('AC #3 — read-only', () => {
    test('redeem detail modal has no approve / reject controls', async ({ page }) => {
      await installMockApi(page, { orders: seedRedeemOrders() })
      await seedAuthenticatedSession(page)
      await page.goto('/transactions/ord_redeem_done')
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible({ timeout: 15000 })
      await expect(dialog.getByRole('button', { name: /approve/i })).toHaveCount(0)
      await expect(dialog.getByRole('button', { name: /reject/i })).toHaveCount(0)
    })
  })
})

test.describe('USDX-245 fee config redeem fields @e2e', () => {
  test.describe('positive', () => {
    test('AC #4 — fee card shows redeem fee % + disbursement fee flat', async ({ page }) => {
      await installMockApi(page)
      await seedAuthenticatedSession(page)
      await page.goto('/settings/fee')

      await expect(page.getByLabel(/redeem fee percent/i)).toHaveText('1%', { timeout: 15000 })
      await expect(page.getByLabel(/disbursement fee flat/i)).toHaveText(/5\.000/)
    })

    test('AC #4 — admin updates redeem fee + disbursement → new config active', async ({
      page,
    }) => {
      await installMockApi(page)
      await seedAuthenticatedSession(page)
      await page.goto('/settings/fee')

      const redeem = page.locator('#redeemFeePct')
      await expect(redeem).toHaveValue('1.0', { timeout: 15000 })
      await redeem.fill('1.5')
      await page.locator('#disbursementFeeFlat').fill('6000')
      await page.getByRole('button', { name: /update fee config/i }).click()

      // Card reflects the new active redeem config (full 5-field snapshot).
      await expect(page.getByLabel(/redeem fee percent/i)).toHaveText('1.5%')
      await expect(page.getByLabel(/disbursement fee flat/i)).toHaveText(/6\.000/)
    })
  })
})
