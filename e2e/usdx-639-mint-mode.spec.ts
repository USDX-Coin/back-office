import { test, expect } from '@playwright/test'
import { installMockApi, ADMIN_STAFF } from './support/mock-api'
import { seedAuthenticatedSession } from './support/auth'

// USDX-639 — kartu Mode Mint + banner merah global.
// AC E2E:
//   1. buka halaman → kartu menampilkan mode aktif
//   2. geser ke uji tanpa alasan → tombol simpan tidak aktif
//   3. berhasil geser → banner merah muncul, dan tetap ada setelah pindah rute
//   4. STAFF → tidak ada tombol ke mode uji; tombol kembali ke PROD ada
//   5. backend 422 → daftar env tampil di dialog, mode tidak berubah

function asRole(role: 'STAFF' | 'MANAGER' | 'DEVELOPER') {
  return {
    routes: {
      'GET /api/v1/auth/me': (route: { fulfill: (r: unknown) => void }) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'success',
            metadata: null,
            data: { ...ADMIN_STAFF, role },
          }),
        })
        return true
      },
    },
  }
}

test.describe('USDX-639 mode mint @e2e', () => {
  test.describe('positive', () => {
    test('AC #1 + #3 — admin menggeser ke mode uji, banner merah menempel di semua halaman', async ({
      page,
    }) => {
      await installMockApi(page)
      await seedAuthenticatedSession(page)
      await page.goto('/settings/mint-mode')

      await expect(page.getByLabel(/mode mint aktif/i)).toHaveText('PROD', { timeout: 15000 })
      await expect(page.getByTestId('mint-test-mode-banner')).toHaveCount(0)

      await page.getByRole('button', { name: /geser ke mode uji/i }).click()
      const dialog = page.getByRole('dialog')
      await dialog.getByLabel(/alasan/i).fill('Uji bayar produksi bersama DurianPay')
      await dialog.getByLabel(/durasi \(jam\)/i).fill('2')
      await dialog.getByRole('button', { name: /geser ke mode uji/i }).click()

      const banner = page.getByTestId('mint-test-mode-banner')
      await expect(banner).toContainText(/mint mencetak token uji, bukan USDX/i)
      await expect(banner).toContainText(/Berakhir \d{2}:\d{2} WIB/)

      // Pindah rute: banner ikut, dan tidak ada tombol untuk menutupnya.
      await page.getByRole('link', { name: /^dashboard$/i }).click()
      await expect(page.getByTestId('mint-test-mode-banner')).toBeVisible()
      await expect(banner.getByRole('button')).toHaveCount(0)
    })
  })

  test.describe('negative', () => {
    test('AC #2 — tanpa alasan, tombol simpan tetap mati', async ({ page }) => {
      await installMockApi(page)
      await seedAuthenticatedSession(page)
      await page.goto('/settings/mint-mode')

      await page.getByRole('button', { name: /geser ke mode uji/i }).click()
      const dialog = page.getByRole('dialog')
      await dialog.getByLabel(/durasi \(jam\)/i).fill('2')
      await expect(dialog.getByRole('button', { name: /geser ke mode uji/i })).toBeDisabled()

      await dialog.getByLabel(/alasan/i).fill('Uji bayar produksi')
      await expect(dialog.getByRole('button', { name: /geser ke mode uji/i })).toBeEnabled()
    })

    test('AC #5 — 422 env uji kurang: daftar env tampil, mode tidak berubah', async ({ page }) => {
      await installMockApi(page, {
        routes: {
          'POST /api/v1/mint-mode': (route) => {
            route.fulfill({
              status: 422,
              contentType: 'application/json',
              body: JSON.stringify({
                status: 'error',
                metadata: null,
                data: null,
                error: {
                  code: 'VALIDATION_ERROR',
                  message: 'Env mode uji belum lengkap',
                  details: ['MINT_TEST_SAFE_ADDRESS', 'MINT_TEST_TOKEN_ADDRESS'],
                },
              }),
            })
            return true
          },
        },
      })
      await seedAuthenticatedSession(page)
      await page.goto('/settings/mint-mode')

      await page.getByRole('button', { name: /geser ke mode uji/i }).click()
      const dialog = page.getByRole('dialog')
      await dialog.getByLabel(/alasan/i).fill('Uji bayar produksi')
      await dialog.getByLabel(/durasi \(jam\)/i).fill('2')
      await dialog.getByRole('button', { name: /geser ke mode uji/i }).click()

      await expect(dialog.getByText(/env mode uji belum lengkap/i)).toBeVisible()
      await expect(dialog.getByText('MINT_TEST_SAFE_ADDRESS')).toBeVisible()
      await expect(dialog.getByText('MINT_TEST_TOKEN_ADDRESS')).toBeVisible()
      await expect(page.getByTestId('mint-test-mode-banner')).toHaveCount(0)
    })
  })

  test.describe('AC #4 — gerbang role', () => {
    test('STAFF: tidak ada tombol ke mode uji', async ({ page }) => {
      await installMockApi(page, asRole('STAFF'))
      await seedAuthenticatedSession(page)
      await page.goto('/settings/mint-mode')

      await expect(page.getByLabel(/mode mint aktif/i)).toHaveText('PROD', { timeout: 15000 })
      await expect(page.getByRole('button', { name: /geser ke mode uji/i })).toHaveCount(0)
      await expect(
        page.getByText(/hanya manager dan admin yang bisa menggeser/i),
      ).toBeVisible()
    })

    test('MANAGER melihat menu Mode Mint walau Settings lain tertutup untuknya', async ({
      page,
    }) => {
      await installMockApi(page, asRole('MANAGER'))
      await seedAuthenticatedSession(page)
      await page.goto('/dashboard')

      await expect(page.getByRole('link', { name: /^mode mint$/i })).toBeVisible({
        timeout: 15000,
      })
      await expect(page.getByRole('link', { name: /^rate$/i })).toHaveCount(0)
      await expect(page.getByRole('link', { name: /^threshold$/i })).toHaveCount(0)
    })
  })
})
