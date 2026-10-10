import { test, expect, type Route } from '@playwright/test'
import { ADMIN_STAFF, installMockApi } from './support/mock-api'
import { loginViaForm, seedAuthenticatedSession } from './support/auth'

// Halaman galat (Okt 2026): 404 di dalam layout, 403 di tempat (tanpa request
// data halaman terlarang), dan sesi habis → Login dengan pesan + kembali ke
// halaman tadi (`?next=` divalidasi; open redirect ditolak).

const STAFF = { ...ADMIN_STAFF, role: 'STAFF' }

const unauthorized = (route: Route) =>
  route.fulfill({
    status: 401,
    contentType: 'application/json',
    body: JSON.stringify({ status: 'error', metadata: null, data: null, error: { code: 'UNAUTHORIZED', message: 'UNAUTHORIZED' } }),
  })

function asStaff() {
  return {
    'GET /api/v1/auth/me': async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'success', metadata: null, data: STAFF }),
      })
      return true
    },
  }
}

test.describe('halaman galat @e2e', () => {
  test.describe('positive', () => {
    test('should show the 404 page inside the layout for an unknown route', async ({ page }) => {
      await installMockApi(page)
      await seedAuthenticatedSession(page)
      await page.goto('/halaman-yang-tidak-ada')
      await expect(page.getByRole('heading', { name: 'Halaman tidak ditemukan', level: 1 })).toBeVisible({ timeout: 15000 })
      await expect(page).toHaveURL(/\/halaman-yang-tidak-ada$/)
      await expect(page.getByTestId('route-notice-path')).toHaveText('/halaman-yang-tidak-ada')
      await expect(page.locator('aside')).toBeVisible()
      await page.getByRole('link', { name: 'Ke Ringkasan' }).click()
      await expect(page).toHaveURL(/\/ringkasan$/)
    })

    test('should show the 403 page with the role as a word and never fetch the forbidden data', async ({ page }) => {
      await installMockApi(page, { routes: asStaff() })
      await seedAuthenticatedSession(page, STAFF)
      const forbidden: string[] = []
      page.on('request', (r) => {
        const p = new URL(r.url()).pathname
        if (p.startsWith('/api/v1/activity-logs') || p.startsWith('/api/v1/transparency')) forbidden.push(p)
      })
      await page.goto('/jejak-audit')
      await expect(page.getByRole('heading', { name: 'Kamu tidak punya akses ke halaman ini', level: 1 })).toBeVisible({ timeout: 15000 })
      await expect(page).toHaveURL(/\/jejak-audit$/)
      await expect(page.getByTestId('route-notice-role')).toHaveText('Staf')
      await page.goto('/transparency')
      await expect(page.getByRole('heading', { name: /tidak punya akses/i, level: 1 })).toBeVisible({ timeout: 15000 })
      await page.waitForTimeout(500)
      expect(forbidden).toEqual([])
    })

    test('should return to the same page after the session expired mid-session', async ({ page }) => {
      let expired = false
      await installMockApi(page, {
        routes: {
          'GET /api/v1/auth/me': async (route) => (expired ? (await unauthorized(route), true) : false),
          'GET /api/v1/transactions': async (route) => (expired ? (await unauthorized(route), true) : false),
        },
      })
      await seedAuthenticatedSession(page)
      await page.goto('/users?search=budi')
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15000 })

      expired = true
      await page.locator('aside').getByRole('link', { name: /^transaksi/i }).click()
      await expect(page).toHaveURL(/\/login\?next=%2Ftransactions/, { timeout: 15000 })
      await expect(page.getByTestId('session-expired-notice')).toHaveText(/Sesimu sudah habis, silakan masuk lagi\./)

      expired = false
      await page.getByLabel(/^email$/i).fill('admin@usdx.io')
      await page.getByLabel(/^kata sandi$/i).fill('admin123456')
      await page.getByRole('button', { name: /^masuk$/i }).click()
      await expect(page).toHaveURL(/\/transactions(\?|$)/, { timeout: 15000 })
      await expect(page.getByRole('heading', { name: /^transaksi$/i, level: 1 })).toBeVisible()
    })
  })

  test.describe('negative', () => {
    test('should NOT show the expired message after a normal logout', async ({ page }) => {
      await installMockApi(page)
      await loginViaForm(page)
      await page.getByRole('button', { name: /buka menu profil/i }).click()
      await page.getByRole('menuitem', { name: /keluar/i }).click()
      await expect(page).toHaveURL(/\/login$/)
      await expect(page.getByRole('heading', { name: /^masuk$/i })).toBeVisible()
      await expect(page.getByTestId('session-expired-notice')).toHaveCount(0)
    })

    for (const next of ['//evil.com', 'https://evil.com', '/\\evil.com']) {
      test(`should reject next=${next} (open redirect) and land on Ringkasan`, async ({ page }) => {
        await installMockApi(page)
        await page.goto(`/login?next=${encodeURIComponent(next)}`)
        await page.getByLabel(/^email$/i).fill('admin@usdx.io')
        await page.getByLabel(/^kata sandi$/i).fill('admin123456')
        await page.getByRole('button', { name: /^masuk$/i }).click()
        await expect(page).toHaveURL(/^http:\/\/localhost:\d+\/ringkasan$/, { timeout: 15000 })
      })
    }
  })

  test.describe('edge cases', () => {
    test('should keep the intentional redirects (/dashboard, /mint) instead of a 404', async ({ page }) => {
      await installMockApi(page)
      await seedAuthenticatedSession(page)
      await page.goto('/dashboard')
      await expect(page).toHaveURL(/\/ringkasan$/, { timeout: 15000 })
      await page.goto('/mint')
      await expect(page).toHaveURL(/\/otc\/mint$/, { timeout: 15000 })
      await expect(page.getByRole('heading', { name: 'Halaman tidak ditemukan' })).toHaveCount(0)
    })

    test('should treat a 401 on reload as expired and keep the path in ?next=', async ({ page }) => {
      await installMockApi(page, { routes: { 'GET /api/v1/auth/me': async (route) => (await unauthorized(route), true) } })
      await seedAuthenticatedSession(page)
      await page.goto('/otc/redeem')
      await expect(page).toHaveURL(/\/login\?next=%2Fotc%2Fredeem$/, { timeout: 15000 })
      await expect(page.getByTestId('session-expired-notice')).toBeVisible()
    })

    test('should fit a 390px screen without horizontal scroll on the 404 page', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 })
      await installMockApi(page)
      await seedAuthenticatedSession(page)
      await page.goto('/tidak-ada/sama/sekali-dengan-path-yang-sangat-panjang-sekali-untuk-uji-pemotongan')
      await expect(page.getByRole('heading', { name: 'Halaman tidak ditemukan' })).toBeVisible({ timeout: 15000 })
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow).toBeLessThanOrEqual(0)
    })
  })
})
