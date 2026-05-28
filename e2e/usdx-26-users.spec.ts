import { test, expect } from '@playwright/test'
import { installMockApi } from './support/mock-api'
import { seedAuthenticatedSession } from './support/auth'

// USDX-26 — Critical flow #5: user CRUD (create → password reveal → list, edit
// KYC status, delete with confirmation) plus the directory filters. Mock-backed.

function uniqueEmail(prefix = 'usdx26-e2e') {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}@example.test`
}

test.describe('USDX-26 user CRUD @e2e', () => {
  test.beforeEach(async ({ page }) => {
    await installMockApi(page)
    await seedAuthenticatedSession(page)
    await page.goto('/users')
    await expect(page.getByRole('heading', { name: /^user/i, level: 1 })).toBeVisible({ timeout: 15000 })
  })

  test.describe('positive', () => {
    test('should render the Name / Email / Entity / KYC / Status columns', async ({ page }) => {
      const head = page.locator('thead')
      await expect(head.getByText('Name')).toBeVisible()
      await expect(head.getByText('Email')).toBeVisible()
      await expect(head.getByText('Entity')).toBeVisible()
      await expect(head.getByText('KYC')).toBeVisible()
      await expect(head.getByText('Status')).toBeVisible()
      await expect(page.getByText('Robert Deon')).toBeVisible()
    })

    test('should create a user, show the temporary-password modal, and list the user', async ({ page }) => {
      const name = `E2E Probe ${Math.random().toString(36).slice(2, 6)}`
      await page.getByRole('button', { name: /add user/i }).first().click()
      await page.getByLabel(/^name$/i).fill(name)
      await page.getByLabel(/^email$/i).fill(uniqueEmail())
      await page.getByRole('button', { name: /create user/i }).click()

      await expect(page.getByRole('heading', { name: /temporary password/i })).toBeVisible({ timeout: 10000 })
      await expect(page.getByRole('button', { name: 'Done' })).toBeDisabled()
      await page.getByLabel(/i have saved this password securely/i).check()
      await expect(page.getByRole('button', { name: 'Done' })).toBeEnabled()
      await page.getByRole('button', { name: 'Done' }).click()

      await expect(page.getByRole('heading', { name: /temporary password/i })).toHaveCount(0)
      await expect(page.getByRole('row', { name: new RegExp(name) })).toBeVisible({ timeout: 10000 })
    })

    test('should save a KYC-status edit and show a confirmation toast', async ({ page }) => {
      await page.getByRole('button', { name: /^edit /i }).first().click()
      await expect(page.getByRole('dialog', { name: /edit user/i })).toBeVisible()
      // Radix Select trigger isn't reliably label-associated — target it by id.
      await page.locator('#kycStatus').click()
      await page.getByRole('option', { name: /^verified$/i }).click()
      await page.getByRole('button', { name: /save changes/i }).click()
      await expect(page.getByText(/user updated/i)).toBeVisible({ timeout: 10000 })
    })

    test('should delete a user after confirmation and remove the row', async ({ page }) => {
      // create a disposable user first so the test is non-destructive
      const name = `Delete Probe ${Math.random().toString(36).slice(2, 6)}`
      await page.getByRole('button', { name: /add user/i }).first().click()
      await page.getByLabel(/^name$/i).fill(name)
      await page.getByLabel(/^email$/i).fill(uniqueEmail('delete-probe'))
      await page.getByRole('button', { name: /create user/i }).click()
      await page.getByLabel(/i have saved this password securely/i).check()
      await page.getByRole('button', { name: 'Done' }).click()
      const row = page.getByRole('row', { name: new RegExp(name) })
      await expect(row).toBeVisible({ timeout: 10000 })

      await row.getByRole('button', { name: /^delete /i }).click()
      await page.getByRole('button', { name: /^delete$/i }).click()
      await expect(page.getByText(/removed/i)).toBeVisible({ timeout: 10000 })
      await expect(page.getByRole('row', { name: new RegExp(name) })).toHaveCount(0)
    })
  })

  test.describe('negative', () => {
    test('should show a client-side validation error and send no request for a name over 255 chars', async ({ page }) => {
      let posted = false
      page.on('request', (r) => { if (r.method() === 'POST' && r.url().includes('/api/v1/users')) posted = true })
      await page.getByRole('button', { name: /add user/i }).first().click()
      await page.getByLabel(/^name$/i).fill('a'.repeat(260))
      await page.getByLabel(/^email$/i).fill(uniqueEmail())
      await page.getByRole('button', { name: /create user/i }).click()
      await expect(page.getByText(/under 255 characters/i)).toBeVisible()
      expect(posted).toBe(false)
    })

    test('should show a client-side validation error for notes over 2000 chars', async ({ page }) => {
      await page.getByRole('button', { name: /add user/i }).first().click()
      await page.getByLabel(/^name$/i).fill('Notes Probe')
      await page.getByLabel(/^email$/i).fill(uniqueEmail())
      await page.getByLabel(/notes/i).fill('x'.repeat(2100))
      await page.getByRole('button', { name: /create user/i }).click()
      await expect(page.getByText(/under 2000 characters/i)).toBeVisible()
    })

    test('should surface a backend 409 in the modal for a duplicate email', async ({ page }) => {
      await page.getByRole('button', { name: /add user/i }).first().click()
      await page.getByLabel(/^name$/i).fill('Dup Email Probe')
      await page.getByLabel(/^email$/i).fill('robert.deon@example.com') // already in the seeded directory
      await page.getByRole('button', { name: /create user/i }).click()
      await expect(page.getByText(/already exists/i)).toBeVisible({ timeout: 10000 })
      // modal stays open (still on /users with the dialog present)
      await expect(page.getByRole('dialog')).toBeVisible()
    })
  })

  test.describe('edge cases', () => {
    test('should reflect a KYC-status filter in the URL', async ({ page }) => {
      // USDX-27: filters now live behind a "Filter" popover (TableToolbar).
      await page.getByRole('button', { name: /^filter/i }).click()
      await page.getByRole('combobox', { name: 'KYC' }).click()
      await page.getByRole('option', { name: /^verified$/i }).click()
      await page.getByRole('button', { name: /^apply$/i }).click()
      await expect(page).toHaveURL(/kycStatus=VERIFIED/)
    })

    test('should reflect an entity-type filter in the URL', async ({ page }) => {
      await page.getByRole('button', { name: /^filter/i }).click()
      await page.getByRole('combobox', { name: 'Entity' }).click()
      await page.getByRole('option', { name: /^individual$/i }).click()
      await page.getByRole('button', { name: /^apply$/i }).click()
      await expect(page).toHaveURL(/entityType=INDIVIDUAL/)
    })

    test('should add no user when the create modal is cancelled', async ({ page }) => {
      const before = await page.getByRole('row').count()
      await page.getByRole('button', { name: /add user/i }).first().click()
      await page.getByLabel(/^name$/i).fill('Cancelled Probe')
      await page.getByLabel(/^email$/i).fill(uniqueEmail())
      await page.keyboard.press('Escape')
      await expect(page.getByRole('dialog')).toHaveCount(0)
      expect(await page.getByRole('row').count()).toBe(before)
    })
  })
})
