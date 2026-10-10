import { test, expect, type Page } from '@playwright/test'
import { installMockApi, VERIFIED_USER } from './support/mock-api'
import { seedAuthenticatedSession } from './support/auth'

// PM Okt 2026 — "semua detail pakai modal tengah": klik baris di mana pun
// membuka modal di TENGAH (pola RecordModal) dengan URL sendiri, ↑/↓ antar
// baris, dan TIDAK ADA panel samping yang membuat tabel menyempit. Spec ini
// menjaga tiga halaman yang terakhir pindah: Verifikasi, Daftar Nasabah, dan
// Jejak Audit.

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

async function tableWidth(page: Page): Promise<number> {
  const box = await page.locator('table').first().boundingBox()
  expect(box).not.toBeNull()
  return Math.round(box!.width)
}

/** Modal terlihat di tengah layar (bukan menempel di sisi kanan seperti panel). */
async function expectCentred(page: Page, testId: string) {
  const box = await page.getByTestId(testId).boundingBox()
  const vw = page.viewportSize()!.width
  expect(box).not.toBeNull()
  const centre = box!.x + box!.width / 2
  expect(Math.abs(centre - vw / 2)).toBeLessThan(4)
}

/** Seksi panel lama tidak ada di mana pun, dan tidak ada grid tabel + panel 440px. */
async function expectNoSidePanel(page: Page) {
  await expect(page.getByRole('region', { name: /^detail (verifikasi|nasabah)$/i })).toHaveCount(0)
  await expect(page.locator('[class*="_440px]"]')).toHaveCount(0)
}

const LOG_ROWS = [
  { id: 'log_3', action: 'POST /api/v1/kyc/:id/approve', resourceType: 'KYC', resourceId: 'kyc_1', metadata: {}, createdAt: '2026-10-10T03:00:00.000Z' },
  { id: 'log_2', action: 'PATCH /api/v1/users/:id', resourceType: 'USER', resourceId: 'usr_1', metadata: {}, createdAt: '2026-10-10T02:00:00.000Z' },
  { id: 'log_1', action: 'AUTH_LOGIN', resourceType: 'AUTH', resourceId: null, metadata: {}, createdAt: '2026-10-10T01:00:00.000Z' },
]

test.describe('semua detail = modal tengah @e2e', () => {
  test.describe('positive', () => {
    test('Verifikasi: klik baris → modal berkas di tengah, lebar tabel tidak berubah, ↑/↓ pindah berkas', async ({ page }) => {
      await installMockApi(page)
      await page.route('**://t3.storageapi.dev/**', (r) => r.fulfill({ status: 200, contentType: 'image/png', body: TINY_PNG }))
      await seedAuthenticatedSession(page)
      await page.setViewportSize({ width: 1440, height: 900 })
      await page.goto('/verifikasi')
      await expect(page.locator('tbody[data-group="pending"]').getByRole('button')).toHaveCount(2)
      const before = await tableWidth(page)

      await page.getByRole('button', { name: /buka berkas perorangan alice\.pending/i }).click()
      await expect(page).toHaveURL(/\/verifikasi\/perorangan\/kyc_pending$/)
      const modal = page.getByTestId('kyc-modal')
      await expect(modal.getByRole('heading', { name: 'Alice Anderson' })).toBeVisible()
      await expect(modal.getByTestId('record-modal-position')).toHaveText('2 dari 4')
      expect(await tableWidth(page)).toBe(before)
      await expectCentred(page, 'kyc-modal')
      await expectNoSidePanel(page)

      // ↑ ke berkas badan usaha di atasnya (terlama dulu), ↓ kembali.
      await page.keyboard.press('ArrowUp')
      await expect(page).toHaveURL(/\/verifikasi\/badan-usaha\/kyb_pending$/)
      await expect(page.getByTestId('kyb-modal').getByTestId('record-modal-position')).toHaveText('1 dari 4')
      await page.getByTestId('kyb-modal').getByRole('button', { name: 'Berikutnya' }).click()
      await expect(page).toHaveURL(/\/verifikasi\/perorangan\/kyc_pending$/)
      await expect(page.getByTestId('kyc-modal').getByTestId('record-modal-position')).toHaveText('2 dari 4')
    })

    test('Daftar Nasabah: klik baris → modal ringkasan di tengah, lebar tabel tidak berubah, ↑/↓', async ({ page }) => {
      await installMockApi(page)
      await seedAuthenticatedSession(page)
      await page.setViewportSize({ width: 1440, height: 900 })
      await page.goto('/users')
      await expect(page.getByRole('button', { name: /^Buka nasabah Robert Deon/ })).toBeVisible({ timeout: 15000 })
      const before = await tableWidth(page)

      await page.getByRole('button', { name: /^Buka nasabah Robert Deon/ }).click()
      await expect(page).toHaveURL(new RegExp(`[?&]nasabah=${VERIFIED_USER.id}`))
      const modal = page.getByTestId('customer-modal')
      await expect(modal.getByRole('heading', { name: 'Robert Deon' })).toBeVisible()
      await expect(modal.getByRole('button', { name: 'Buka profil lengkap' })).toBeVisible()
      expect(await tableWidth(page)).toBe(before)
      await expectCentred(page, 'customer-modal')
      await expectNoSidePanel(page)

      const pos = modal.getByTestId('record-modal-position')
      await expect(pos).toHaveText(/^1 dari \d+$/)
      await page.keyboard.press('ArrowDown')
      await expect(pos).toHaveText(/^2 dari \d+$/)
      await expect(page).not.toHaveURL(new RegExp(`nasabah=${VERIFIED_USER.id}`))
      await page.keyboard.press('Escape')
      await expect(page.getByTestId('customer-modal')).toHaveCount(0)
      await expect(page).not.toHaveURL(/nasabah=/)
    })

    test('Jejak Audit: klik baris → modal di /jejak-audit/:id, ↑/↓, lebar tabel tidak berubah', async ({ page }) => {
      const state = await installMockApi(page)
      state.activityLogs.push(...LOG_ROWS)
      await seedAuthenticatedSession(page)
      await page.setViewportSize({ width: 1440, height: 900 })
      await page.goto('/jejak-audit')
      const rows = page.getByRole('button', { name: /^jejak /i })
      await expect(rows).toHaveCount(3, { timeout: 15000 })
      const before = await tableWidth(page)

      await rows.first().click()
      await expect(page).toHaveURL(/\/jejak-audit\/log_3$/)
      const modal = page.getByTestId('jejak-modal')
      await expect(modal.getByTestId('record-modal-position')).toHaveText('1 dari 3')
      expect(await tableWidth(page)).toBe(before)
      await expectCentred(page, 'jejak-modal')

      await page.keyboard.press('ArrowDown')
      await expect(page).toHaveURL(/\/jejak-audit\/log_2$/)
      await expect(modal.getByTestId('record-modal-position')).toHaveText('2 dari 3')
      await modal.getByRole('button', { name: 'Sebelumnya' }).click()
      await expect(page).toHaveURL(/\/jejak-audit\/log_3$/)
    })
  })

  test.describe('negative', () => {
    test('deep link: tiap modal terbuka dari muatan dingin', async ({ page }) => {
      const state = await installMockApi(page)
      state.activityLogs.push(...LOG_ROWS)
      await seedAuthenticatedSession(page)

      await page.goto('/verifikasi/perorangan/kyc_pending')
      await expect(page.getByTestId('kyc-modal').getByRole('heading', { name: 'Alice Anderson' })).toBeVisible({ timeout: 15000 })

      await page.goto('/kyc/kyc_pending')
      await expect(page.getByTestId('kyc-modal').getByRole('heading', { name: 'Alice Anderson' })).toBeVisible({ timeout: 15000 })

      await page.goto(`/users?nasabah=${VERIFIED_USER.id}`)
      await expect(page.getByTestId('customer-modal').getByRole('heading', { name: 'Robert Deon' })).toBeVisible({ timeout: 15000 })

      await page.goto('/jejak-audit/log_2')
      await expect(page.getByTestId('jejak-modal').getByTestId('record-modal-position')).toHaveText('2 dari 3', { timeout: 15000 })
    })

    test('jejak yang tidak ada di halaman ini dikatakan, bukan modal kosong', async ({ page }) => {
      const state = await installMockApi(page)
      state.activityLogs.push(...LOG_ROWS)
      await seedAuthenticatedSession(page)
      await page.goto('/jejak-audit/log_tidak_ada')
      await expect(page.getByTestId('jejak-modal').getByRole('heading', { name: 'Jejak tidak ada di halaman ini' })).toBeVisible({
        timeout: 15000,
      })
    })
  })

  test.describe('edge cases', () => {
    test('390px: modal nasabah dan berkas muat, tombol footer terlihat, tanpa gulir mendatar', async ({ page }) => {
      await installMockApi(page)
      await seedAuthenticatedSession(page)
      await page.setViewportSize({ width: 390, height: 844 })

      await page.goto(`/users?nasabah=${VERIFIED_USER.id}`)
      const customer = page.getByTestId('customer-modal')
      await expect(customer.getByRole('button', { name: 'Buka profil lengkap' })).toBeInViewport({ timeout: 15000 })
      await expect(customer.getByRole('button', { name: 'Berikutnya' })).toBeInViewport()

      await page.goto('/verifikasi/perorangan/kyc_pending')
      const berkas = page.getByTestId('kyc-modal')
      await expect(berkas.getByRole('button', { name: /^setujui$/i })).toBeInViewport({ timeout: 15000 })
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      expect(overflow).toBeLessThanOrEqual(0)
    })
  })
})
