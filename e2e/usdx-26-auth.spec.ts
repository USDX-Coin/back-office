import { test, expect } from '@playwright/test'
import { installMockApi } from './support/mock-api'
import { loginViaForm, seedAuthenticatedSession } from './support/auth'

// USDX-26 — Critical flow #1: login (valid + invalid) + access control / session.
// Hermetic: API is mocked (see support/mock-api.ts), so this runs in CI with no
// backend. Access-control / session cases double as light OWASP WSTG coverage
// (WSTG-ATHN / WSTG-SESS); full security testing lives in USDX-69.

const STORAGE_KEY = 'usdx_auth_user'

test.describe('USDX-26 auth @e2e', () => {
  test.describe('positive', () => {
    test('valid credentials → dashboard, session persisted', async ({ page }) => {
      await installMockApi(page)
      await loginViaForm(page)
      await expect(page.getByRole('heading', { name: /dashboard/i, level: 1 })).toBeVisible()
      const stored = await page.evaluate((k) => window.localStorage.getItem(k), STORAGE_KEY)
      expect(stored).toBeTruthy()
      expect(JSON.parse(stored!)).toMatchObject({ version: 4, token: expect.any(String) })
    })

    test('session restored on reload — no re-login needed', async ({ page }) => {
      await installMockApi(page)
      await seedAuthenticatedSession(page)
      await page.goto('/dashboard')
      await expect(page.getByRole('heading', { name: /dashboard/i, level: 1 })).toBeVisible({ timeout: 15000 })
      await page.reload()
      await expect(page).toHaveURL(/\/dashboard/)
      await expect(page.getByRole('heading', { name: /dashboard/i, level: 1 })).toBeVisible()
    })

    test('logout clears the session and returns to /login', async ({ page }) => {
      await installMockApi(page)
      await loginViaForm(page)
      await page.getByRole('button', { name: /open profile menu/i }).click()
      await page.getByRole('menuitem', { name: /logout/i }).click()
      await expect(page).toHaveURL(/\/login/)
      const stored = await page.evaluate((k) => window.localStorage.getItem(k), STORAGE_KEY)
      expect(stored).toBeNull()
      // Going back to a protected route must bounce to /login again
      await page.goto('/dashboard')
      await expect(page).toHaveURL(/\/login/)
    })
  })

  test.describe('negative', () => {
    test('wrong password → inline error from the API, stays on /login', async ({ page }) => {
      await installMockApi(page)
      await page.goto('/login')
      await page.getByLabel(/^email$/i).fill('admin@usdx.io')
      await page.getByLabel(/^password$/i).fill('definitely-wrong')
      await page.getByRole('button', { name: /^sign in$/i }).click()
      await expect(page.getByRole('alert')).toBeVisible({ timeout: 10000 })
      await expect(page).toHaveURL(/\/login/)
      const stored = await page.evaluate((k) => window.localStorage.getItem(k), STORAGE_KEY)
      expect(stored).toBeNull()
    })

    test('empty fields → client-side validation, no request sent', async ({ page }) => {
      await installMockApi(page)
      let loginCalled = false
      page.on('request', (r) => { if (r.url().includes('/api/v1/auth/login')) loginCalled = true })
      await page.goto('/login')
      await page.getByRole('button', { name: /^sign in$/i }).click()
      await expect(page.getByText(/email is required/i)).toBeVisible()
      await expect(page.getByText(/password is required/i)).toBeVisible()
      await expect(page).toHaveURL(/\/login/)
      expect(loginCalled).toBe(false)
    })

    test('stale/invalid token in storage → /auth/me 401 → bounced to /login', async ({ page }) => {
      await installMockApi(page, {
        routes: {
          'GET /api/v1/auth/me': (route) => {
            route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ status: 'error', metadata: null, data: null, error: { code: 'UNAUTHORIZED', message: 'UNAUTHORIZED' } }) })
            return true
          },
        },
      })
      await seedAuthenticatedSession(page)
      await page.goto('/dashboard')
      await expect(page).toHaveURL(/\/login/, { timeout: 15000 })
      const stored = await page.evaluate((k) => window.localStorage.getItem(k), STORAGE_KEY)
      expect(stored).toBeNull()
    })
  })

  test.describe('edge cases / access control', () => {
    for (const path of ['/dashboard', '/users', '/staff', '/mint', '/mint/new', '/burn', '/requests', '/settings/rate', '/profile']) {
      test(`unauthenticated ${path} → /login`, async ({ page }) => {
        await installMockApi(page)
        await page.goto(path)
        await expect(page).toHaveURL(/\/login/)
        await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible()
      })
    }

    test('"remember this device" checkbox is toggleable', async ({ page }) => {
      await installMockApi(page)
      await page.goto('/login')
      const remember = page.getByRole('checkbox', { name: /remember this device/i })
      const wasChecked = await remember.isChecked()
      await remember.click()
      expect(await remember.isChecked()).toBe(!wasChecked)
    })

    test('show/hide password toggle reveals the entered password', async ({ page }) => {
      await installMockApi(page)
      await page.goto('/login')
      const pw = page.getByLabel(/^password$/i)
      await pw.fill('hunter2')
      expect(await pw.getAttribute('type')).toBe('password')
      await page.getByRole('button', { name: /show password/i }).click()
      expect(await pw.getAttribute('type')).toBe('text')
    })
  })
})
