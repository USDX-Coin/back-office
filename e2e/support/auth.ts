import { expect, type Page } from '@playwright/test'
import { ADMIN_STAFF, MOCK_TOKEN } from './mock-api'

const STORAGE_KEY = 'usdx_auth_user'

/** Sign in via the login form (use for tests that exercise the auth UI itself). */
export async function loginViaForm(page: Page, email = 'admin@usdx.io', password = 'admin123456') {
  await page.goto('/login')
  await page.getByLabel(/^email$/i).fill(email)
  await page.getByLabel(/^password$/i).fill(password)
  await page.getByRole('button', { name: /^sign in$/i }).click()
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 })
}

/**
 * Pre-seed a valid v4 session in localStorage before any page script runs, so
 * tests that aren't *about* login start authenticated without driving the form.
 * AuthProvider revalidates the token via GET /api/v1/auth/me — the mock API
 * answers that. Call this AFTER installMockApi and BEFORE the first goto.
 */
export async function seedAuthenticatedSession(page: Page) {
  await page.addInitScript(
    ({ key, value }) => window.localStorage.setItem(key, value),
    {
      key: STORAGE_KEY,
      value: JSON.stringify({ version: 4, staff: ADMIN_STAFF, token: MOCK_TOKEN, issuedAt: Date.now() }),
    }
  )
}
