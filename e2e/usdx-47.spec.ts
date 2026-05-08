import { test, expect, Page } from '@playwright/test'

// USDX-47 e2e — User management page rework. All ACs run against the real BE
// reachable through the Vite proxy. Tests skip if real credentials aren't
// configured. The PR description tracks BE readiness; ACs that require fields
// the BE doesn't yet return will fail (intentionally) until BE catches up.
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

// Random suffix so concurrent runs/local re-runs don't collide on email unique.
function uniqueEmail(prefix = 'usdx47-e2e') {
  const tag = Math.random().toString(36).slice(2, 8)
  return `${prefix}-${tag}@example.test`
}

test.describe('USDX-47 user management @e2e', () => {
  test.describe('positive', () => {
    test('AC1: /users renders email/entityType/kycStatus/suspended columns', async ({
      page,
    }) => {
      test.skip(!HAS_CREDS, 'real credentials not provided')
      await login(page)
      await page.goto('/users')

      const headers = page.locator('thead')
      await expect(headers.getByText('Name')).toBeVisible()
      await expect(headers.getByText('Email')).toBeVisible()
      await expect(headers.getByText('Entity')).toBeVisible()
      await expect(headers.getByText('KYC')).toBeVisible()
      await expect(headers.getByText('Status')).toBeVisible()
    })

    test('AC3: filter by kycStatus=VERIFIED reflects in URL', async ({ page }) => {
      test.skip(!HAS_CREDS, 'real credentials not provided')
      await login(page)
      await page.goto('/users')
      await page.getByLabel('Filter by KYC status').click()
      await page.getByRole('option', { name: 'Verified' }).click()
      await expect(page).toHaveURL(/kycStatus=VERIFIED/)
    })

    test('AC4: filter by entityType=INDIVIDUAL reflects in URL', async ({
      page,
    }) => {
      test.skip(!HAS_CREDS, 'real credentials not provided')
      await login(page)
      await page.goto('/users')
      await page.getByLabel('Filter by entity type').click()
      await page.getByRole('option', { name: 'Individual' }).click()
      await expect(page).toHaveURL(/entityType=INDIVIDUAL/)
    })

    test('AC5: create user → 201 → password reveal modal', async ({ page }) => {
      test.skip(!HAS_CREDS, 'real credentials not provided')
      await login(page)
      await page.goto('/users')

      await page.getByRole('button', { name: /add user/i }).first().click()
      await page.getByLabel(/^name$/i).fill('USDX-47 E2E Probe')
      await page.getByLabel(/^email$/i).fill(uniqueEmail())
      // Default entityType=INDIVIDUAL is already selected.
      await page.getByRole('button', { name: /create user/i }).click()

      // Password dialog opens (Done disabled until ack)
      await expect(
        page.getByRole('heading', { name: /temporary password/i }),
      ).toBeVisible({ timeout: 15000 })
      await expect(page.getByRole('button', { name: 'Done' })).toBeDisabled()

      await page
        .getByLabel('I have saved this password securely')
        .check()
      await expect(page.getByRole('button', { name: 'Done' })).toBeEnabled()
      await page.getByRole('button', { name: 'Done' }).click()

      // Modal closes, list shows the new user
      await expect(
        page.getByRole('heading', { name: /temporary password/i }),
      ).not.toBeVisible()
    })

    test('AC8: edit user kycStatus → save → 200', async ({ page }) => {
      test.skip(!HAS_CREDS, 'real credentials not provided')
      await login(page)
      await page.goto('/users')

      // Pick the first row's edit button (assumes at least one user exists)
      const firstEdit = page.getByRole('button', { name: /^edit / }).first()
      await firstEdit.click()

      await page.getByLabel('KYC status').click()
      await page.getByRole('option', { name: 'Verified' }).click()
      await page.getByRole('button', { name: /save changes/i }).click()
      await expect(page.getByText(/user updated/i)).toBeVisible({
        timeout: 15000,
      })
    })

    test('AC9: delete user → confirm → user removed from list', async ({
      page,
    }) => {
      test.skip(!HAS_CREDS, 'real credentials not provided')
      await login(page)
      await page.goto('/users')

      // Create a disposable user first so the test isn't destructive.
      await page.getByRole('button', { name: /add user/i }).first().click()
      const probeName = `Delete Probe ${Math.random().toString(36).slice(2, 6)}`
      await page.getByLabel(/^name$/i).fill(probeName)
      await page.getByLabel(/^email$/i).fill(uniqueEmail('delete-probe'))
      await page.getByRole('button', { name: /create user/i }).click()
      // Skip the password reveal as fast as possible.
      await page
        .getByLabel('I have saved this password securely')
        .check()
      await page.getByRole('button', { name: 'Done' }).click()

      // Find the user we just created and delete it.
      const row = page.getByRole('row', { name: new RegExp(probeName) })
      await row.getByRole('button', { name: /^delete / }).click()
      await page.getByRole('button', { name: /^delete$/i }).click()
      await expect(page.getByText(/removed/i)).toBeVisible({ timeout: 15000 })
      await expect(
        page.getByRole('row', { name: new RegExp(probeName) }),
      ).not.toBeVisible()
    })
  })

  test.describe('negative', () => {
    test('AC6: name > 255 char → FE validation error', async ({ page }) => {
      test.skip(!HAS_CREDS, 'real credentials not provided')
      await login(page)
      await page.goto('/users')

      await page.getByRole('button', { name: /add user/i }).first().click()
      await page.getByLabel(/^name$/i).fill('a'.repeat(260))
      await page.getByLabel(/^email$/i).fill(uniqueEmail())
      await page.getByRole('button', { name: /create user/i }).click()
      await expect(page.getByText(/under 255 characters/i)).toBeVisible()
    })

    test('AC7: notes > 2000 char → FE validation error', async ({ page }) => {
      test.skip(!HAS_CREDS, 'real credentials not provided')
      await login(page)
      await page.goto('/users')

      await page.getByRole('button', { name: /add user/i }).first().click()
      await page.getByLabel(/^name$/i).fill('Notes Probe')
      await page.getByLabel(/^email$/i).fill(uniqueEmail())
      await page.getByLabel(/notes/i).fill('x'.repeat(2100))
      await page.getByRole('button', { name: /create user/i }).click()
      await expect(page.getByText(/under 2000 characters/i)).toBeVisible()
    })
  })
})
