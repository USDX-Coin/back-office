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
 * Pre-seed an authenticated session before any page script runs, so tests that
 * aren't *about* login start signed in without driving the form.
 *
 * USDX-392: auth rides on the httpOnly `usdx_session` cookie — seed it in the
 * browser context so GET /api/v1/auth/me (cookie-gated) succeeds. localStorage
 * only holds the non-sensitive v5 Staff profile for synchronous UI restore (no
 * token). Call this AFTER installMockApi and BEFORE the first goto.
 */
export async function seedAuthenticatedSession(page: Page) {
  await page.context().addCookies([
    {
      name: 'usdx_session',
      value: MOCK_TOKEN,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ])
  await page.addInitScript(
    ({ key, value }) => window.localStorage.setItem(key, value),
    {
      key: STORAGE_KEY,
      value: JSON.stringify({ version: 5, staff: ADMIN_STAFF, issuedAt: Date.now() }),
    }
  )
}
