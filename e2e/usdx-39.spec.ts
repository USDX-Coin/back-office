import { test, expect } from '@playwright/test'

// USDX-39 e2e: hits the real BE through the Vite/Netlify same-origin proxy
// (FE makes relative `/api/*` calls; the proxy forwards them server-side).
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
    await page.getByLabel(/^password$/i).fill('definitely-wrong-password')
    await page.getByRole('button', { name: /^sign in$/i }).click()
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 15000 })
    await expect(page).toHaveURL(/\/login/)
  })

  test('AC #1 + #3 + #6: real login → role visible → logout clears session', async ({
    page,
  }) => {
    test.skip(!HAS_CREDS, 'real credentials not provided')

    await page.goto('/login')
    await page.getByLabel(/^email$/i).fill(EMAIL)
    await page.getByLabel(/^password$/i).fill(PASSWORD)
    await page.getByRole('button', { name: /^sign in$/i }).click()
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 20000 })

    const token = await page.evaluate(() =>
      window.localStorage.getItem('usdx_auth_token'),
    )
    expect(token).toBeTruthy()

    const role = page.getByTestId('staff-role')
    await expect(role).toHaveText(/admin/i)

    await page.getByRole('button', { name: /open profile menu/i }).click()
    await page.getByRole('menuitem', { name: /logout/i }).click()
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 })
    const tokenAfter = await page.evaluate(() =>
      window.localStorage.getItem('usdx_auth_token'),
    )
    expect(tokenAfter).toBeNull()
  })

  test('AC #4 + #5: navigate to /requests after login', async ({ page }) => {
    test.skip(!HAS_CREDS, 'real credentials not provided')

    await page.goto('/login')
    await page.getByLabel(/^email$/i).fill(EMAIL)
    await page.getByLabel(/^password$/i).fill(PASSWORD)
    await page.getByRole('button', { name: /^sign in$/i }).click()
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 20000 })

    await page.goto('/requests')
    // Whether BE returns rows, empty, or 404, the FE must render its header
    // and filter controls without crashing.
    await expect(
      page.getByRole('heading', { name: /^requests$/i }),
    ).toBeVisible({ timeout: 15000 })
    await expect(page.getByLabel(/filter by type/i)).toBeVisible()
    await expect(page.getByLabel(/filter by status/i)).toBeVisible()
  })
})
