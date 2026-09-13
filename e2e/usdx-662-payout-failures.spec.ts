import { test, expect } from '@playwright/test'
import { installMockApi } from './support/mock-api'
import { seedAuthenticatedSession } from './support/auth'

// USDX-662 — back-office "Pencairan Bermasalah" (sot/bni-integration.md § 17.9).
// Mock-backed via page.route (support/mock-api.ts § Pencairan Bermasalah). Menutup
// alur yang tidak terlihat utuh dari Vitest: sidebar → antrean → detail → dialog
// resolve bersarang → antrean ditarik ulang, plus satu 409 di browser sungguhan.

const REASON = 'Ditransfer treasury lewat BNIdirect'

// Dialog resolve dicari lewat JUDULNYA: saat ia terbuka Radix menandai modal detail
// `aria-hidden`, jadi `getByRole('dialog')` tanpa nama hanya melihat lapisan teratas.

test.describe('USDX-662 Pencairan Bermasalah @e2e', () => {
  test.describe('positive', () => {
    test('sidebar → queue → detail → SETTLED_MANUAL drops the row and shows the trail', async ({ page }) => {
      await installMockApi(page)
      await seedAuthenticatedSession(page)
      await page.goto('/dashboard')

      await page.getByRole('link', { name: /pencairan bermasalah/i }).click()
      await expect(page).toHaveURL(/\/payout-failures$/)
      await expect(page.getByRole('heading', { name: /pencairan bermasalah/i })).toBeVisible({ timeout: 15000 })
      await expect(page.getByTestId('nav-badge-payout-failures')).toHaveText('2')

      await page.getByRole('button', { name: /Buka detail pencairan RINA SUSANTI/ }).click()
      const detail = page.getByRole('dialog', { name: /Pencairan bermasalah/ })
      await expect(detail.getByText('RDM260912A1B2C3')).toBeVisible()
      await expect(detail.getByText('8730012245')).toBeVisible()

      await detail.getByRole('button', { name: 'Tandai dibayar manual' }).click()
      const resolve = page.getByRole('dialog', { name: 'Tandai sudah dibayar manual' })
      const submit = resolve.getByRole('button', { name: 'Tandai dibayar manual' })
      await resolve.getByLabel(/^Alasan/).fill(REASON)
      await expect(submit).toBeDisabled()
      await resolve.getByLabel(/Nomor referensi transfer bank/).fill('TRX-778812')

      const resolveRequest = page.waitForRequest((r) => r.url().endsWith('/resolve') && r.method() === 'POST')
      await submit.click()
      const body = (await resolveRequest).postDataJSON()
      expect(body).toEqual({ action: 'SETTLED_MANUAL', reason: REASON, externalRef: 'TRX-778812' })

      await expect(resolve).toHaveCount(0)
      await expect(page.getByTestId('resolved-note')).toContainText('Dibayar di luar sistem')
      await expect(page.getByTestId('reviews')).toContainText('TRX-778812')

      await detail.getByRole('button', { name: 'Tutup', exact: true }).click()
      await expect(page).toHaveURL(/\/payout-failures$/)
      await expect(page.getByRole('button', { name: /Buka detail pencairan RINA SUSANTI/ })).toHaveCount(0)
      await expect(page.getByRole('button', { name: /Buka detail pencairan DEWI KARTIKA/ })).toBeVisible()
    })
  })

  test.describe('negative', () => {
    test('409 ALREADY_RESOLVED is explained inside the dialog and the screen does not hang', async ({ page }) => {
      await installMockApi(page, {
        routes: {
          'POST /api/v1/payout-failures/019f2a01-0662-7c31-9b2d-00000000e2e1/resolve': async (route) => {
            await route.fulfill({
              status: 409,
              contentType: 'application/json',
              body: JSON.stringify({
                status: 'error',
                metadata: null,
                data: null,
                error: { code: 'CONFLICT', message: 'ALREADY_RESOLVED' },
              }),
            })
            return true
          },
        },
      })
      await seedAuthenticatedSession(page)
      await page.goto('/payout-failures/019f2a01-0662-7c31-9b2d-00000000e2e1')

      const detail = page.getByRole('dialog', { name: /Pencairan bermasalah/ })
      await detail.getByRole('button', { name: 'Tutup tanpa pembayaran' }).click({ timeout: 15000 })
      const resolve = page.getByRole('dialog', { name: 'Tutup tanpa pembayaran' })
      await resolve.getByLabel(/^Alasan/).fill('Nasabah setuju tidak dibayar')
      await resolve.getByRole('button', { name: 'Tutup tanpa pembayaran' }).click()

      await expect(resolve.getByRole('alert')).toContainText('sudah diselesaikan orang lain')
      await expect(resolve.getByRole('button', { name: 'Tutup tanpa pembayaran' })).toBeEnabled()
      await resolve.getByRole('button', { name: 'Batal' }).click()
      await expect(resolve).toHaveCount(0)
      await expect(detail).toBeVisible()
    })
  })

  test.describe('edge cases', () => {
    test('BURN_REJECTED offers no RESENT and says no transfer was ever submitted', async ({ page }) => {
      await installMockApi(page)
      await seedAuthenticatedSession(page)
      await page.goto('/payout-failures?issueKind=BURN_REJECTED')

      await page.getByRole('button', { name: /Buka detail pencairan DEWI KARTIKA/ }).click({ timeout: 15000 })
      const detail = page.getByRole('dialog', { name: /Pencairan bermasalah/ })
      await expect(detail.getByTestId('submissions-empty')).toBeVisible()
      await expect(detail.getByRole('button', { name: 'Tandai dibayar manual' })).toBeVisible()
      await expect(detail.getByRole('button', { name: 'Kirim ulang' })).toHaveCount(0)
    })
  })
})
