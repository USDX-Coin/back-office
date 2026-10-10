import { test, expect } from '@playwright/test'
import { installMockApi, seedOrders, seedPartnerOrders, seedRedeemOrders } from './support/mock-api'
import { seedAuthenticatedSession } from './support/auth'

// Fase 2 redesain — Transaksi gabungan (⚠️ DRAF SOT PR #50,
// `backoffice-transactions.yaml`). Menggantikan spec USDX-206 / USDX-245 /
// USDX-547 milik layar "User Transaction" yang sudah diganti: rincian order
// (fee/spread/pendapatan, rekening redeem, blok partner) kini dibuka dari panel
// lewat "Lihat rincian order", dan aksi antrean asal dijalankan dari footer
// modal detail (pola modal tengah, 10 Okt 2026 — panel samping dihapus).

const REASON = 'Ditransfer treasury lewat BNIdirect'
const ORDERS = [...seedOrders(), ...seedRedeemOrders(), ...seedPartnerOrders()]

test.describe('Transaksi gabungan @e2e', () => {
  test.describe('positive', () => {
    test('rows needing action sit on top; the badge counts them', async ({ page }) => {
      await installMockApi(page, { orders: ORDERS })
      await seedAuthenticatedSession(page)
      await page.goto('/dashboard')
      await expect(page).toHaveURL(/\/transactions/)
      await expect(page.getByRole('heading', { name: /^transaksi$/i, level: 1 })).toBeVisible({ timeout: 15000 })
      await expect(page.getByTestId('nav-badge-transactions')).toHaveText('2')

      await expect(page.getByRole('tab', { name: 'Perlu tindakan (2)' })).toHaveAttribute('aria-selected', 'true')
      const first = page.getByRole('button', { name: /^Buka (Mint|Redeem|Uang masuk)/ }).first()
      await expect(first).toHaveAccessibleName(/^Buka Redeem RINA SUSANTI/)
      await expect(page.getByText('Pencairan bermasalah').first()).toBeVisible()
      // No legacy strip of queue links any more.
      await expect(page.getByRole('navigation', { name: 'Antrean yang perlu tindakan' })).toHaveCount(0)
    })

    test('modal footer action resolves the payout failure through the original queue endpoint', async ({ page }) => {
      await installMockApi(page, { orders: ORDERS })
      await seedAuthenticatedSession(page)
      await page.goto('/transactions')
      await page.getByRole('button', { name: /^Buka Redeem RINA SUSANTI/ }).click({ timeout: 15000 })
      await expect(page).toHaveURL(/\/transactions\/[^/?]+/)
      const modal = page.getByTestId('transaction-modal')
      await expect(modal.getByTestId('record-todo')).toContainText(/kirim ulang, tandai dibayar manual, atau tutup/i)

      await modal.getByRole('button', { name: 'Tandai dibayar manual' }).click()
      const resolve = page.getByRole('dialog', { name: 'Tandai sudah dibayar manual' })
      await resolve.getByLabel(/^Alasan/).fill(REASON)
      await resolve.getByLabel(/Nomor referensi transfer bank/).fill('TRX-778812')
      const req = page.waitForRequest((r) => r.url().endsWith('/resolve') && r.method() === 'POST')
      await resolve.getByRole('button', { name: 'Tandai dibayar manual' }).click()
      expect((await req).postDataJSON()).toEqual({ action: 'SETTLED_MANUAL', reason: REASON, externalRef: 'TRX-778812' })
      await expect(resolve).toHaveCount(0)
      await expect(page.getByTestId('nav-badge-transactions')).toHaveText('1')
    })

    test('order detail (fee / spread / revenue) opens from the modal', async ({ page }) => {
      await installMockApi(page, { orders: ORDERS })
      await seedAuthenticatedSession(page)
      await page.goto('/transactions/ord_completed?tab=semua')
      const modal = page.getByTestId('transaction-modal')
      await expect(modal.getByText('Tidak ada yang perlu dilakukan')).toBeVisible({ timeout: 15000 })
      await modal.getByRole('button', { name: 'Lihat rincian order' }).click()
      const dialog = page.getByRole('dialog').last()
      await expect(dialog.getByText(/^kurs & spread$/i)).toBeVisible()
      await expect(dialog.getByText(/^perkiraan pendapatan$/i)).toBeVisible()
      // Read-only order: no approve/reject anywhere.
      await expect(dialog.getByRole('button', { name: /approve|setujui/i })).toHaveCount(0)
    })
  })

  test.describe('negative', () => {
    test('the list never shows a bank account number; it appears only in the order detail', async ({ page }) => {
      await installMockApi(page, { orders: ORDERS })
      await seedAuthenticatedSession(page)
      await page.goto('/transactions/ord_redeem_done?tab=semua')
      const modal = page.getByTestId('transaction-modal')
      await expect(modal.getByText('Tidak ada yang perlu dilakukan')).toBeVisible({ timeout: 15000 })
      await expect(page.getByText('1234563271')).toHaveCount(0)
      await modal.getByRole('button', { name: 'Lihat rincian order' }).click()
      await expect(page.getByRole('dialog').last().getByText('1234563271')).toBeVisible()
    })
  })

  test.describe('modal', () => {
    test('↑/↓ moves through the filtered list without closing; footer stays visible; Esc closes', async ({ page }) => {
      await installMockApi(page, { orders: ORDERS })
      await seedAuthenticatedSession(page)
      await page.goto('/transactions?tab=semua')
      const rows = page.getByRole('button', { name: /^Buka (Mint|Redeem|Uang masuk)/ })
      await rows.first().click({ timeout: 15000 })
      const modal = page.getByTestId('transaction-modal')
      await expect(modal.getByTestId('record-modal-position')).toHaveText(/^1 dari \d+$/)
      const firstTitle = await modal.getByRole('heading').first().textContent()

      await modal.getByRole('button', { name: 'Berikutnya' }).click()
      await expect(modal.getByTestId('record-modal-position')).toHaveText(/^2 dari \d+$/)
      await page.keyboard.press('ArrowDown')
      await expect(modal.getByTestId('record-modal-position')).toHaveText(/^3 dari \d+$/)
      await page.keyboard.press('ArrowUp')
      await expect(modal.getByTestId('record-modal-position')).toHaveText(/^2 dari \d+$/)
      await page.keyboard.press('ArrowUp')
      await expect(modal.getByTestId('record-modal-position')).toHaveText(/^1 dari \d+$/)
      await expect(modal.getByRole('heading').first()).toHaveText(firstTitle ?? '')

      // Footer (aksi + navigasi) tetap di layar walau isinya digulir.
      await page.setViewportSize({ width: 1280, height: 520 })
      await modal.locator('.overflow-y-auto').first().evaluate((el) => el.scrollTo(0, el.scrollHeight))
      await expect(modal.getByRole('button', { name: 'Berikutnya' })).toBeInViewport()

      await page.keyboard.press('Escape')
      await expect(modal).toHaveCount(0)
      await expect(page).toHaveURL(/\/transactions\?tab=semua$/)
    })
  })

  test.describe('edge cases', () => {
    test('Pemilik=Partner narrows to partner orders', async ({ page }) => {
      await installMockApi(page, { orders: ORDERS })
      await seedAuthenticatedSession(page)
      await page.goto('/transactions?tab=semua')
      await page.getByRole('combobox', { name: 'Pemilik' }).click({ timeout: 15000 })
      await page.getByRole('option', { name: 'Partner' }).click()
      await expect(page).toHaveURL(/pemilik=PARTNER/)
      await expect(page.getByRole('button', { name: /^Buka Mint \(partner customer\)/ })).toBeVisible()
      await expect(page.getByRole('button', { name: /^Buka Mint ops@juara\.co\.id/ })).toBeVisible()
      await expect(page.getByRole('button', { name: /^Buka Redeem RINA SUSANTI/ })).toHaveCount(0)
    })

    test('the merged legacy queue pages stay reachable by URL', async ({ page }) => {
      await installMockApi(page)
      await seedAuthenticatedSession(page)
      await page.goto('/payout-failures')
      await expect(page.getByRole('heading', { name: /pencairan bermasalah/i })).toBeVisible({ timeout: 15000 })
    })
  })
})
