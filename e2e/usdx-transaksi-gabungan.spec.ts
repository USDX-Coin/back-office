import { test, expect } from '@playwright/test'
import { installMockApi, seedOrders, seedPartnerOrders, seedRedeemOrders } from './support/mock-api'
import { seedAuthenticatedSession } from './support/auth'

// Fase 2 redesain — Transaksi gabungan (⚠️ DRAF SOT PR #50,
// `backoffice-transactions.yaml`). Menggantikan spec USDX-206 / USDX-245 /
// USDX-547 milik layar "User Transaction" yang sudah diganti: rincian order
// (fee/spread/pendapatan, rekening redeem, blok partner) kini dibuka dari panel
// lewat "Lihat rincian order", dan aksi antrean asal dijalankan dari panel.

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

      const first = page.getByRole('button', { name: /^Buka (Mint|Redeem|Uang masuk)/ }).first()
      await expect(first).toHaveAccessibleName(/^Buka Redeem RINA SUSANTI/)
      await expect(page.getByText('Pencairan bermasalah').first()).toBeVisible()
      // No legacy strip of queue links any more.
      await expect(page.getByRole('navigation', { name: 'Antrean yang perlu tindakan' })).toHaveCount(0)
    })

    test('panel action resolves the payout failure through the original queue endpoint', async ({ page }) => {
      await installMockApi(page, { orders: ORDERS })
      await seedAuthenticatedSession(page)
      await page.goto('/transactions')
      await page.getByRole('button', { name: /^Buka Redeem RINA SUSANTI/ }).click({ timeout: 15000 })
      const panel = page.getByRole('region', { name: 'Detail transaksi' })
      await expect(panel.getByTestId('panel-todo')).toContainText(/kirim ulang, tandai dibayar manual, atau tutup/i)

      await panel.getByRole('button', { name: /^lainnya/i }).click()
      await page.getByRole('menuitem', { name: 'Tandai dibayar manual' }).click()
      const resolve = page.getByRole('dialog', { name: 'Tandai sudah dibayar manual' })
      await resolve.getByLabel(/^Alasan/).fill(REASON)
      await resolve.getByLabel(/Nomor referensi transfer bank/).fill('TRX-778812')
      const req = page.waitForRequest((r) => r.url().endsWith('/resolve') && r.method() === 'POST')
      await resolve.getByRole('button', { name: 'Tandai dibayar manual' }).click()
      expect((await req).postDataJSON()).toEqual({ action: 'SETTLED_MANUAL', reason: REASON, externalRef: 'TRX-778812' })
      await expect(resolve).toHaveCount(0)
      await expect(page.getByTestId('nav-badge-transactions')).toHaveText('1')
    })

    test('order detail (fee / spread / revenue) opens from the panel', async ({ page }) => {
      await installMockApi(page, { orders: ORDERS })
      await seedAuthenticatedSession(page)
      await page.goto('/transactions/ord_completed')
      const panel = page.getByRole('region', { name: 'Detail transaksi' })
      await expect(panel.getByText('Tidak ada yang perlu dilakukan')).toBeVisible({ timeout: 15000 })
      await panel.getByRole('button', { name: /^lainnya/i }).click()
      await page.getByRole('menuitem', { name: 'Lihat rincian order' }).click()
      const dialog = page.getByRole('dialog')
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
      await page.goto('/transactions/ord_redeem_done')
      await expect(page.getByRole('region', { name: 'Detail transaksi' })).toBeVisible({ timeout: 15000 })
      await expect(page.getByText('1234563271')).toHaveCount(0)
      await page.getByRole('region', { name: 'Detail transaksi' }).getByRole('button', { name: /^lainnya/i }).click()
      await page.getByRole('menuitem', { name: 'Lihat rincian order' }).click()
      await expect(page.getByRole('dialog').getByText('1234563271')).toBeVisible()
    })
  })

  test.describe('edge cases', () => {
    test('Pemilik=Partner narrows to partner orders and the Partner cell carries the code', async ({ page }) => {
      await installMockApi(page, { orders: ORDERS })
      await seedAuthenticatedSession(page)
      await page.goto('/transactions')
      await page.getByRole('combobox', { name: 'Pemilik' }).click({ timeout: 15000 })
      await page.getByRole('option', { name: 'Partner' }).click()
      await expect(page).toHaveURL(/pemilik=PARTNER/)
      await expect(page.getByRole('button', { name: /^Buka Mint \(partner customer\)/ })).toBeVisible()
      await expect(page.getByRole('button', { name: /^Buka Mint ops@juara\.co\.id/ })).toBeVisible()
      await expect(page.getByRole('button', { name: /^Buka Redeem RINA SUSANTI/ })).toHaveCount(0)
      await expect(page.getByText('juara').first()).toBeVisible()
    })

    test('the merged legacy queue pages stay reachable by URL', async ({ page }) => {
      await installMockApi(page)
      await seedAuthenticatedSession(page)
      await page.goto('/payout-failures')
      await expect(page.getByRole('heading', { name: /pencairan bermasalah/i })).toBeVisible({ timeout: 15000 })
    })
  })
})
