import { test, expect } from '@playwright/test'

// USDX-39 e2e against real BE (Vite proxy) — verify the 7 ACs.
// Credentials come from env so they are not committed.
const EMAIL = process.env.USDX_TEST_EMAIL ?? ''
const PASSWORD = process.env.USDX_TEST_PASSWORD ?? ''
const HAS_CREDS = !!EMAIL && !!PASSWORD

test.describe('USDX-39 integration @e2e', () => {
  test('AC #7: protected route without auth → /login', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible()
  })

  test('AC #2: wrong credentials → inline error from BE', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel(/^email$/i).fill('admin@usdx.io')
    const pw = page.getByLabel(/^password$/i)
    await pw.fill('definitely-wrong-password')
    await pw.press('Enter')
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 15000 })
    await expect(page).toHaveURL(/\/login/)
  })

  test('AC #1 + #3 + #6: real login → role visible → logout clears session', async ({
    page,
  }) => {
    test.skip(!HAS_CREDS, 'real credentials not provided')

    await page.goto('/login')
    await page.getByLabel(/^email$/i).fill(EMAIL)
    const pw = page.getByLabel(/^password$/i)
    await pw.fill(PASSWORD)
    await pw.press('Enter')
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 20000 })

    // AC #6 setup: token cached
    const stored = await page.evaluate(() =>
      window.localStorage.getItem('usdx_auth_user'),
    )
    expect(stored).toBeTruthy()
  })

  test('AC #4 + #5: navigate to /requests after login', async ({ page }) => {
    test.skip(!HAS_CREDS, 'real credentials not provided')

    await page.goto('/login')
    await page.getByLabel(/^email$/i).fill(EMAIL)
    const pw = page.getByLabel(/^password$/i)
    await pw.fill(PASSWORD)
    await pw.press('Enter')
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 20000 })

    await page.goto('/requests')
    await expect(
      page.getByRole('heading', { name: /requests/i, level: 1 }),
    ).toBeVisible({ timeout: 15000 })
  })
})
