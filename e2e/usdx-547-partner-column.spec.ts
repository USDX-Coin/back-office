import { test, expect } from '@playwright/test'
import { installMockApi, seedOrders, seedPartnerOrders } from './support/mock-api'
import { seedAuthenticatedSession } from './support/auth'

// ─────────────────────────────────────────────────────────────────────────────
// USDX-547 — Partner column + Owner filter on the User Transaction list.
//
// What this proves in a real browser, beyond the unit tests:
//   1. a partner order names its PARTNER, so ops knows who to contact
//   2. a retail order's Partner cell is EMPTY (not "—", not "N/A")
//   3. the Owner filter narrows a MIXED list, both ways
//   4. the partner's own order number (`external_reference`) is readable in full
// ─────────────────────────────────────────────────────────────────────────────

/** Retail + partner rows in one list — the situation the column exists for. */
const MIXED_ORDERS = [...seedOrders(), ...seedPartnerOrders()]

/** Index of the "Partner" column header, then the matching cell in a row. */
async function partnerCellText(page: import('@playwright/test').Page, rowName: RegExp) {
  const headers = await page.getByRole('columnheader').allTextContents()
  const index = headers.findIndex((h) => h.trim() === 'Partner')
  expect(index).toBeGreaterThan(-1)
  const row = page.getByRole('button', { name: rowName })
  return (await row.getByRole('cell').nth(index).textContent()) ?? ''
}

test.describe('USDX-547 partner column @e2e', () => {
  test.describe('positive', () => {
    test('a partner order names its partner (display name + code)', async ({ page }) => {
      await installMockApi(page, { orders: MIXED_ORDERS })
      await seedAuthenticatedSession(page)
      await page.goto('/transactions')

      await expect(page.getByRole('button', { name: /750\.00 USDX/ })).toBeVisible({
        timeout: 15000,
      })
      const cell = await partnerCellText(page, /750\.00 USDX/)
      expect(cell).toContain('PT Juara Remiten Indonesia')
      expect(cell).toContain('juara')
      // The email cell still carries the marker — correct now that the partner is
      // readable in the next column.
      await expect(page.getByText('(partner customer)')).toBeVisible()
    })

    test("a partner's OWN order counts as a partner order despite a real email", async ({
      page,
    }) => {
      await installMockApi(page, { orders: MIXED_ORDERS })
      await seedAuthenticatedSession(page)
      await page.goto('/transactions')

      await expect(page.getByRole('button', { name: /300\.00 USDX/ })).toBeVisible({
        timeout: 15000,
      })
      const cell = await partnerCellText(page, /300\.00 USDX/)
      expect(cell).toContain('PT Juara Remiten Indonesia')
      await expect(page.getByText('ops@juara.co.id')).toBeVisible()
    })

    test('the detail modal shows the external reference in full', async ({ page }) => {
      await installMockApi(page, { orders: MIXED_ORDERS })
      await seedAuthenticatedSession(page)
      await page.goto('/transactions/ord_partner_cust')

      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible({ timeout: 15000 })
      await expect(dialog.getByText('PT Juara Remiten Indonesia')).toBeVisible()
      // Character for character — this is the number the partner quotes.
      await expect(dialog.getByText('JUARA-ORD-2026-000042')).toBeVisible()
      await expect(dialog.getByText("Partner's customer")).toBeVisible()
    })

    test('Owner=Partner narrows the mixed list to partner orders only', async ({ page }) => {
      await installMockApi(page, { orders: MIXED_ORDERS })
      await seedAuthenticatedSession(page)
      await page.goto('/transactions')
      await expect(page.getByRole('button', { name: /1000\.00 USDX/ })).toBeVisible({
        timeout: 15000,
      })

      await page.getByRole('button', { name: /^filter/i }).click()
      await page.getByRole('combobox', { name: 'Owner' }).click()
      await page.getByRole('option', { name: /partner orders/i }).click()
      await page.getByRole('button', { name: /^apply$/i }).click()

      await expect(page).toHaveURL(/ownerType=PARTNER/)
      await expect(page.getByRole('button', { name: /750\.00 USDX/ })).toBeVisible()
      await expect(page.getByRole('button', { name: /300\.00 USDX/ })).toBeVisible()
      // Retail rows are gone.
      await expect(page.getByRole('button', { name: /1000\.00 USDX/ })).toHaveCount(0)
      await expect(page.getByRole('button', { name: /500\.00 USDX/ })).toHaveCount(0)
    })

    test('Owner=Retail narrows to retail orders only', async ({ page }) => {
      await installMockApi(page, { orders: MIXED_ORDERS })
      await seedAuthenticatedSession(page)
      await page.goto('/transactions?ownerType=RETAIL')

      await expect(page.getByRole('button', { name: /1000\.00 USDX/ })).toBeVisible({
        timeout: 15000,
      })
      await expect(page.getByRole('button', { name: /750\.00 USDX/ })).toHaveCount(0)
      await expect(page.getByRole('button', { name: /300\.00 USDX/ })).toHaveCount(0)
      await expect(page.getByText('(partner customer)')).toHaveCount(0)
    })
  })

  test.describe('negative', () => {
    test('a retail order leaves the Partner cell empty — no dash, no "N/A"', async ({
      page,
    }) => {
      await installMockApi(page, { orders: MIXED_ORDERS })
      await seedAuthenticatedSession(page)
      await page.goto('/transactions')
      await expect(page.getByRole('button', { name: /1000\.00 USDX/ })).toBeVisible({
        timeout: 15000,
      })

      const cell = await partnerCellText(page, /1000\.00 USDX/)
      expect(cell.trim()).toBe('')
      expect(cell).not.toContain('N/A')
    })

    test('a retail detail modal has no partner block at all', async ({ page }) => {
      await installMockApi(page, { orders: MIXED_ORDERS })
      await seedAuthenticatedSession(page)
      await page.goto('/transactions/ord_completed')

      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible({ timeout: 15000 })
      await expect(dialog.getByText(/exchange rate & spread/i)).toBeVisible()
      await expect(dialog.getByText('External reference')).toHaveCount(0)
      await expect(dialog.getByText('On behalf of')).toHaveCount(0)
    })
  })

  test.describe('edge cases', () => {
    test('switching Type keeps the Owner filter — they are independent questions', async ({
      page,
    }) => {
      await installMockApi(page, { orders: MIXED_ORDERS })
      await seedAuthenticatedSession(page)
      await page.goto('/transactions?ownerType=PARTNER')
      await expect(page.getByRole('button', { name: /750\.00 USDX/ })).toBeVisible({
        timeout: 15000,
      })

      await page.getByRole('button', { name: /^filter/i }).click()
      await page.getByRole('combobox', { name: 'Type' }).click()
      await page.getByRole('option', { name: /^mint$/i }).click()
      await page.getByRole('button', { name: /^apply$/i }).click()

      await expect(page).toHaveURL(/ownerType=PARTNER/)
      await expect(page).toHaveURL(/type=MINT/)
    })
  })
})
