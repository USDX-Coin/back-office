import { test, expect, type Route } from '@playwright/test'
import { installMockApi } from './support/mock-api'
import { seedAuthenticatedSession } from './support/auth'

// Cadangan & Atestasi (11 Okt 2026): PM bingung melihat form "Catat entri"
// besar terbuka di samping kartu saldo kecil. Susunan baru: ATAS kartu saldo +
// tombol "Catat entri"; BAWAH tabel riwayat buku besar + laporan atestasi.
// Form catat entri & unggah laporan di dialog; klik baris = modal tengah dengan
// URL sendiri dan ↑/↓, pola halaman lain.

const ENTRIES = [
  { id: 'led-3', entryType: 'ADJUSTMENT', amount: '-1250.75', currency: 'USD', reason: 'Koreksi pencatatan ganda pada setoran sebelumnya', occurredAt: '2026-10-05', createdByName: 'Demo Admin', createdAt: '2026-10-06T01:44:14.000Z' },
  { id: 'led-2', entryType: 'ADJUSTMENT', amount: '2500.50', currency: 'USD', reason: 'Tambahan setoran cadangan periode berjalan', occurredAt: '2026-09-20', createdByName: 'Demo Admin', createdAt: '2026-09-21T01:44:14.000Z' },
  { id: 'led-1', entryType: 'SEED', amount: '50000.00', currency: 'USD', reason: 'Setoran awal cadangan ke rekening kustodian', occurredAt: '2026-08-26', createdByName: 'Demo Admin', createdAt: '2026-08-27T01:44:14.000Z' },
]
const REPORTS = [
  { id: 'att-2', period: '2026-06', title: 'Laporan Atestasi Cadangan Juni 2026', fileUrl: 'https://storage.usdx.test/juni.pdf', publishedAt: '2026-09-11T03:00:00.000Z', revokedAt: null },
  { id: 'att-1', period: '2026-05', title: 'Laporan Atestasi Cadangan Mei 2026', fileUrl: 'https://storage.usdx.test/mei.pdf', publishedAt: '2026-08-11T03:00:00.000Z', revokedAt: null },
]

const ok = (route: Route, data: unknown) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'success', metadata: null, data }) })

const ROUTES = {
  'GET /api/v1/transparency/ledger': async (route: Route) => {
    await ok(route, { entries: ENTRIES, page: 1, take: 50, total: ENTRIES.length, balance: { amount: '51249.75', currency: 'USD' } })
    return true
  },
  'GET /api/v1/transparency/attestations': async (route: Route) => {
    await ok(route, { items: REPORTS, page: 1, take: 50, total: REPORTS.length })
    return true
  },
}

test.describe('Cadangan & Atestasi — saldo di atas, tabel di bawah, form di dialog @e2e', () => {
  test.describe('positive', () => {
    test('saldo + tombol Catat entri di atas, form baru muncul setelah tombol ditekan', async ({ page }) => {
      await installMockApi(page, { routes: ROUTES })
      await seedAuthenticatedSession(page)
      await page.setViewportSize({ width: 1440, height: 900 })
      await page.goto('/transparency')
      await expect(page.getByLabel('Saldo cadangan')).toContainText('51.249,75', { timeout: 15000 })
      await expect(page.getByLabel(/^nominal$/i)).toHaveCount(0)

      // Tombol di atas tabel riwayat.
      const button = page.getByRole('button', { name: 'Catat entri' })
      const table = page.getByRole('table', { name: 'Entri buku besar cadangan' })
      expect((await button.boundingBox())!.y).toBeLessThan((await table.boundingBox())!.y)

      await button.click()
      const form = page.getByRole('dialog', { name: 'Catat entri buku besar' })
      await expect(form.getByLabel(/^nominal$/i)).toBeVisible()
      await expect(form.getByRole('button', { name: 'Periksa lalu catat' })).toBeVisible()
      await form.getByRole('button', { name: 'Batal' }).click()
      await expect(form).toHaveCount(0)
    })

    test('klik baris buku besar = modal tengah dengan URL sendiri, ↑/↓ pindah entri, Esc kembali', async ({ page }) => {
      await installMockApi(page, { routes: ROUTES })
      await seedAuthenticatedSession(page)
      await page.setViewportSize({ width: 1440, height: 900 })
      await page.goto('/transparency')
      await page.getByRole('button', { name: /^Buka entri Koreksi -1\.250,75/ }).click({ timeout: 15000 })
      await expect(page).toHaveURL(/\/transparency\/entri\/led-3$/)
      const modal = page.getByTestId('ledger-entry-modal')
      await expect(modal.getByText('Koreksi pencatatan ganda pada setoran sebelumnya')).toBeVisible()
      const box = (await modal.boundingBox())!
      expect(Math.abs(box.x + box.width / 2 - 720)).toBeLessThan(4)

      await page.keyboard.press('ArrowDown')
      await expect(page).toHaveURL(/\/transparency\/entri\/led-2$/)
      await expect(modal.getByTestId('record-modal-position')).toHaveText('2 dari 3')
      await page.keyboard.press('Escape')
      await expect(page).toHaveURL(/\/transparency$/)
    })

    test('klik baris laporan = modal; Cabut ada di Lainnya; tautan langsung membuka modal', async ({ page }) => {
      await installMockApi(page, { routes: ROUTES })
      await seedAuthenticatedSession(page)
      await page.setViewportSize({ width: 1440, height: 900 })
      await page.goto('/transparency/laporan/att-1')
      const modal = page.getByTestId('attestation-modal')
      await expect(modal.getByRole('heading', { name: 'Laporan Atestasi Cadangan Mei 2026' })).toBeVisible({ timeout: 15000 })
      await modal.getByRole('button', { name: /^Lainnya/ }).click()
      await page.getByRole('menuitem', { name: 'Cabut laporan' }).click()
      await expect(page.getByRole('dialog', { name: 'Cabut laporan atestasi ini?' })).toBeVisible()
    })
  })

  test.describe('edge cases', () => {
    test('390px: tombol Catat entri terlihat, tanpa gulir mendatar', async ({ page }) => {
      await installMockApi(page, { routes: ROUTES })
      await seedAuthenticatedSession(page)
      await page.setViewportSize({ width: 390, height: 844 })
      await page.goto('/transparency')
      await expect(page.getByRole('button', { name: 'Catat entri' })).toBeVisible({ timeout: 15000 })
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow).toBeLessThanOrEqual(0)
    })
  })
})
