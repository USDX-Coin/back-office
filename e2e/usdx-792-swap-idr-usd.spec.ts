import { test, expect } from '@playwright/test'
import { ADMIN_STAFF, installMockApi } from './support/mock-api'
import { seedAuthenticatedSession } from './support/auth'
import { MOCK_PG_BATCH_MISMATCH_ID } from '../src/mocks/data'

// USDX-792 (D29) — Swap IDR→USD, Swap Bermasalah, Pencairan PG, Settings → Payment
// Gateway, tarif kontrak PG. Mock kontrak via page.route (support/mock-api.ts § D29);
// seed sama dengan MSW (`createMockMintSwaps` / `createMockPgSettlements`).

const BUDI = '019f5d01-0792-7c31-9b2d-000000000001'
const DEWI = '019f5d01-0792-7c31-9b2d-000000000004'
const REASON = 'Prefunding sudah diisi treasury'

test.describe('USDX-792 Swap IDR→USD @e2e', () => {
  test.describe('positive', () => {
    test('keyboard only: sidebar badge → queue → Enter on a row → RETRY → row leaves, badge drops, focus returns', async ({ page }) => {
      await installMockApi(page)
      await seedAuthenticatedSession(page)
      await page.goto('/swap-bermasalah')
      await expect(page.getByRole('heading', { name: 'Swap Bermasalah' })).toBeVisible({ timeout: 15000 })
      await expect(page.getByTestId('nav-badge-swap-bermasalah')).toHaveText('4')

      const row = page.getByRole('button', { name: /Swap bermasalah Budi Santoso/ })
      await row.focus()
      await page.keyboard.press('Enter')
      const modal = page.getByRole('dialog', { name: /Swap IDR→USD/ })
      await expect(modal.getByRole('button', { name: 'Coba lagi' })).toBeVisible({ timeout: 15000 })
      await modal.getByRole('button', { name: 'Coba lagi' }).focus()
      await page.keyboard.press('Enter')

      const dialog = page.getByRole('dialog', { name: 'Coba lagi swap ini?' })
      await expect(dialog.getByTestId('resolve-impact')).toContainText('order dilanjutkan ke mint 1.000 USDX')
      await dialog.getByLabel(/^Alasan/).focus()
      await page.keyboard.type(REASON)
      // Tab sampai tombol kirim — urutan fokus wajar: Alasan → Batal → Coba lagi.
      const submit = dialog.getByRole('button', { name: 'Coba lagi' })
      for (let i = 0; i < 4 && !(await submit.evaluate((el) => el === document.activeElement)); i++) {
        await page.keyboard.press('Tab')
      }
      await expect(submit).toBeFocused()
      await page.keyboard.press('Enter')
      await expect(dialog).toHaveCount(0)
      // Fokus ke kotak status (tombol pemicu hilang), Esc menutup modal → fokus ke baris.
      await page.keyboard.press('Escape')
      await expect(page).toHaveURL(/\/swap-bermasalah$/)
      await expect(page.getByRole('button', { name: /Swap bermasalah Budi Santoso/ })).toHaveCount(0)
      await expect(page.getByTestId('nav-badge-swap-bermasalah')).toHaveText('3')
    })

    test('SETTLED_MANUAL → 202 → "menunggu persetujuan", row stays', async ({ page }) => {
      const state = await installMockApi(page)
      await seedAuthenticatedSession(page)
      await page.goto(`/swap-bermasalah/${DEWI}`)
      const modal = page.getByRole('dialog', { name: /Swap IDR→USD/ })
      await modal.getByRole('button', { name: 'Sudah ditukar manual' }).click({ timeout: 15000 })
      // UNKNOWN + NEEDS_REVIEW: tombol lain tidak dirender.
      const dialog = page.getByRole('dialog', { name: 'Nyatakan sudah ditukar manual?' })
      await dialog.getByLabel(/Nomor referensi BNI/).fill('FX-MANUAL-01')
      await dialog.getByLabel(/Dolar yang diterima/).fill('1000.5')
      await dialog.getByLabel(/^Alasan/).fill('Treasury menukar di BNIdirect')
      await dialog.getByRole('button', { name: 'Kirim usulan' }).click()
      await expect(page.getByTestId('mint-swap-pending-approval')).toContainText('Menunggu persetujuan orang kedua')
      expect(state.d29Writes.at(-1)?.body).toEqual({
        action: 'SETTLED_MANUAL',
        reason: 'Treasury menukar di BNIdirect',
        externalRef: 'FX-MANUAL-01',
        creditedUsd: '1000.50',
      })
      await page.keyboard.press('Escape')
      await expect(page.getByRole('button', { name: /Swap bermasalah Dewi Lestari.*menunggu persetujuan/ })).toBeVisible()
      // Fokus kembali ke baris yang terakhir dibuka.
      await expect(page.locator(`[data-row-id="${DEWI}"]`)).toBeFocused()
      await expect(page.getByTestId('nav-badge-swap-bermasalah')).toHaveText('4')
    })

    test('Pencairan PG: MISMATCH shows the difference + candidates; manual link needs a ≥10-char reason', async ({ page }) => {
      const state = await installMockApi(page)
      await seedAuthenticatedSession(page)
      await page.goto('/pencairan-pg')
      await expect(page.getByRole('heading', { name: 'Pencairan PG' })).toBeVisible({ timeout: 15000 })
      await expect(page.getByTestId('nav-badge-pencairan-pg')).toHaveText('1')
      await page.getByRole('button', { name: /Batch 1 Nov 2026, Tidak cocok/ }).click()
      const modal = page.getByTestId('pg-settlement-modal')
      await expect(modal.getByTestId('pg-difference')).toContainText('kurang Rp 150.000,00')
      await modal.getByRole('button', { name: 'Tautkan manual' }).click()
      const dialog = page.getByRole('dialog', { name: 'Tautkan batch secara manual?' })
      await dialog.getByRole('radio', { name: /^Rp 54.450.000,00/ }).check()
      await dialog.getByLabel(/^Alasan/).fill('pendek')
      await expect(dialog.getByRole('button', { name: 'Tautkan manual' })).toBeDisabled()
      await dialog.getByLabel(/^Alasan/).fill('Sudah dicek di dashboard Durianpay')
      await dialog.getByRole('button', { name: 'Tautkan manual' }).click()
      await expect(dialog).toHaveCount(0)
      await expect(page.getByTestId('pg-settlement-status')).toContainText('Ditautkan manual')
      expect(state.d29Writes.at(-1)).toMatchObject({
        path: `/api/v1/pg-settlements/${MOCK_PG_BATCH_MISMATCH_ID}/match-manual`,
        body: { creditEntryId: 'stmt-np-1101-a', reason: 'Sudah dicek di dashboard Durianpay' },
      })
    })

    test('Settings → Payment Gateway saves with a reason; invalid values never leave the browser', async ({ page }) => {
      const state = await installMockApi(page)
      await seedAuthenticatedSession(page)
      await page.goto('/settings/payment-gateway')
      await page.getByRole('button', { name: 'Ubah pengaturan' }).click({ timeout: 15000 })
      const dialog = page.getByRole('dialog', { name: 'Ubah pengaturan payment gateway' })
      await dialog.getByLabel(/Batas saldo prefunding/).fill('1.000.000')
      await dialog.getByLabel(/^Alasan/).fill('Naikkan batas prefunding')
      await dialog.getByRole('button', { name: 'Simpan' }).click()
      await expect(dialog.getByText(/tanpa titik ribuan/)).toBeVisible()
      expect(state.d29Writes).toHaveLength(0)
      await dialog.getByLabel(/Batas saldo prefunding/).fill('300000000')
      await dialog.getByRole('button', { name: 'Simpan' }).click()
      await expect(dialog).toHaveCount(0)
      await expect(page.getByTestId('pg-settings-card')).toContainText('Rp 300.000.000,00')
      expect(state.d29Writes[0]?.body).toEqual({ mode: 'NET', senderPattern: 'DURIANPAY', prefundingLowIdr: '300000000.00', reason: 'Naikkan batas prefunding' })
    })
  })

  test.describe('negative', () => {
    test('STAFF sees the queue read-only: no action buttons are rendered', async ({ page }) => {
      const staff = { ...ADMIN_STAFF, role: 'STAFF' }
      await installMockApi(page, {
        routes: {
          'GET /api/v1/auth/me': async (route) => {
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'success', metadata: null, data: staff }) })
            return true
          },
        },
      })
      // Server tiruan tetap mengirim allowedActions — yang diuji gerbang peran di FE.
      await seedAuthenticatedSession(page, staff)
      await page.goto(`/swap-bermasalah/${BUDI}`)
      const modal = page.getByRole('dialog', { name: /Swap IDR→USD/ })
      await expect(modal.getByTestId('mint-swap-no-action')).toContainText('Manager dan Admin', { timeout: 15000 })
      await expect(modal.getByRole('button', { name: 'Coba lagi' })).toHaveCount(0)
      await expect(modal.getByRole('button', { name: 'Tutup swap' })).toHaveCount(0)
    })

    test('409 ALREADY_RESOLVED is explained in the dialog', async ({ page }) => {
      await installMockApi(page, {
        routes: {
          [`POST /api/v1/mint-swaps/${BUDI}/resolve`]: async (route) => {
            await route.fulfill({
              status: 409,
              contentType: 'application/json',
              body: JSON.stringify({ status: 'error', metadata: null, data: null, error: { code: 'CONFLICT', message: 'ALREADY_RESOLVED' } }),
            })
            return true
          },
        },
      })
      await seedAuthenticatedSession(page)
      await page.goto(`/swap-bermasalah/${BUDI}`)
      const modal = page.getByRole('dialog', { name: /Swap IDR→USD/ })
      await modal.getByRole('button', { name: 'Tutup swap' }).click({ timeout: 15000 })
      const dialog = page.getByRole('dialog', { name: 'Tutup swap tanpa ditukar?' })
      await dialog.getByLabel(/^Alasan/).fill('Nasabah minta refund rupiah')
      await dialog.getByRole('button', { name: 'Tutup swap' }).click()
      await expect(dialog.getByRole('alert')).toContainText('sudah diselesaikan orang lain')
    })
  })

  test.describe('edge cases', () => {
    test('Swap IDR→USD detail: timeline in time order with a source on every row; profit waits for PG', async ({ page }) => {
      await installMockApi(page)
      await seedAuthenticatedSession(page)
      await page.goto(`/swap-idr-usd/${BUDI}`)
      const modal = page.getByTestId('mint-swap-modal')
      const items = modal.getByTestId('mint-swap-timeline').locator('li')
      await expect(items.first()).toHaveAttribute('data-kind', 'ORDER_CREATED', { timeout: 15000 })
      const count = await items.count()
      for (let i = 0; i < count; i++) await expect(items.nth(i)).toContainText('Sumber:')
      await expect(modal.getByTestId('mint-swap-profit')).toContainText('Menunggu pencairan PG')
    })
  })
})
