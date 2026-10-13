import { test, expect } from '@playwright/test'
import { ADMIN_STAFF, installMockApi } from './support/mock-api'
import { loginViaForm, seedAuthenticatedSession } from './support/auth'

// Ringkasan (10 Okt 2026) — halaman pertama setelah masuk, hanya data yang
// sudah disajikan backend dev: queue-counts, dashboard/stats, saldo BNI (tarik
// MANUAL), cadangan (Admin & Developer), DurianPay "Belum tersedia".

test.describe('Ringkasan @e2e', () => {
  test.describe('positive', () => {
    test('login lands on Ringkasan, the first menu item', async ({ page }) => {
      await installMockApi(page)
      await loginViaForm(page)
      await expect(page.getByRole('heading', { name: /^ringkasan$/i, level: 1 })).toBeVisible()
      const first = page.getByRole('complementary').getByRole('link').first()
      await expect(first).toHaveAccessibleName(/^Ringkasan/)
      await expect(first).toHaveAttribute('aria-current', 'page')
    })

    test('shows token, OTC (labelled OTC-only) and the queue count linked to Transaksi', async ({ page }) => {
      await installMockApi(page)
      await seedAuthenticatedSession(page)
      await page.goto('/dashboard')
      await expect(page).toHaveURL(/\/ringkasan$/)
      await expect(page.getByTestId('ringkasan-pasokan')).toHaveText('1.000.000,00USDX', { timeout: 15000 })
      await expect(page.getByTestId('ringkasan-otc')).toContainText(/khusus permintaan OTC/i)
      await expect(page.getByTestId('ringkasan-cadangan-saldo')).toHaveText('51.249,75USD')
      await expect(page.getByTestId('ringkasan-durianpay')).toContainText('Belum tersedia')
      const card = page.getByTestId('ringkasan-perlu-tindakan')
      await expect(card.getByTestId('ringkasan-transaksi-perlu-tindakan')).toHaveText(/^\d+$/)
      await card.getByRole('link', { name: /buka transaksi/i }).click()
      await expect(page).toHaveURL(/\/transactions$/)
      await expect(page.getByRole('tab', { name: /^Perlu tindakan/ })).toHaveAttribute('aria-selected', 'true')
    })

    test('BNI balances are pulled only on "Cek saldo", with the pull time shown', async ({ page }) => {
      let pulls = 0
      page.on('request', (r) => {
        if (new URL(r.url()).pathname === '/api/v1/bni-accounts/balances') pulls += 1
      })
      await installMockApi(page)
      await seedAuthenticatedSession(page)
      await page.goto('/ringkasan')
      const card = page.getByTestId('ringkasan-bni')
      await expect(card.getByText('Belum dicek').first()).toBeVisible({ timeout: 15000 })
      await page.waitForTimeout(500)
      expect(pulls).toBe(0)
      await card.getByTestId('ringkasan-cek-saldo').click()
      await expect(card.getByTestId('ringkasan-bni-ditarik')).toHaveText(/^\d{1,2} [A-Z][a-z]{2} \d{4}, \d{2}:\d{2}:\d{2}$/)
      await expect(card.getByText('Ditarik (WIB)')).toBeVisible()
      expect(pulls).toBe(1)
    })
  })

  test.describe('negative', () => {
    test('STAFF sees no reserve card and the ledger is never requested', async ({ page }) => {
      let ledger = 0
      page.on('request', (r) => {
        if (new URL(r.url()).pathname === '/api/v1/transparency/ledger') ledger += 1
      })
      await installMockApi(page, {
        routes: {
          'GET /api/v1/auth/me': async (route) => {
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({ status: 'success', metadata: null, data: { ...ADMIN_STAFF, role: 'STAFF' } }),
            })
            return true
          },
        },
      })
      // Profil tersimpan = STAFF juga (sesi nyata STAFF), bukan ADMIN yang dikoreksi /auth/me.
      await seedAuthenticatedSession(page, { ...ADMIN_STAFF, role: 'STAFF' })
      await page.goto('/ringkasan')
      await expect(page.getByTestId('ringkasan-token')).toBeVisible({ timeout: 15000 })
      await page.waitForTimeout(500)
      await expect(page.getByTestId('ringkasan-cadangan')).toHaveCount(0)
      expect(ledger).toBe(0)
    })
  })

  test.describe('edge cases', () => {
    test('phone width: cards stack without horizontal scroll', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 })
      await installMockApi(page)
      await seedAuthenticatedSession(page)
      await page.goto('/ringkasan')
      await expect(page.getByTestId('ringkasan-pasokan')).toBeVisible({ timeout: 15000 })
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      expect(overflow).toBeLessThanOrEqual(0)
    })
  })
})
