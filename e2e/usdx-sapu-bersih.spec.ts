import { test, expect, type Page, type Route } from '@playwright/test'
import { installMockApi, ADMIN_STAFF, FAILED_ACTIVATION_USER } from './support/mock-api'
import { seedAuthenticatedSession } from './support/auth'

// Sapu bersih 11 Okt 2026 (GO PM: "pakai standar yang baru … rapiin semuanya"):
// Kurs & Biaya judul di atas + tab di bawah, satu paginasi untuk semua tabel,
// jalan balik ringkas di ponsel, dan Staf / Kontak Darurat ikut "klik baris =
// modal" (tanpa ikon pensil/tong sampah per baris).

const ok = (route: Route, data: unknown, metadata: unknown = null) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'success', metadata, data }) })

const SECOND_STAFF = {
  ...ADMIN_STAFF,
  id: '00000000-0000-7000-8000-0000000000a2',
  name: 'Linda Chen',
  email: 'linda.c@usdx.io',
  role: 'MANAGER' as const,
  createdAt: '2026-09-25T09:00:00.000Z',
  updatedAt: '2026-09-25T09:00:00.000Z',
}

const CONTACTS = [
  { id: 'oc-1', name: 'Budi Santoso', role: 'Ops Lead', channel: 'PHONE', contactValue: '+6281234567890', categories: ['PAYOUT', 'RECONCILIATION'], createdBy: null, updatedBy: null, createdAt: '2026-10-01T02:00:00.000Z', updatedAt: '2026-10-01T02:00:00.000Z' },
  { id: 'oc-2', name: 'Ops Uang', role: 'Kanal tim', channel: 'SLACK', contactValue: '#ops-uang', categories: ['SECURITY'], createdBy: null, updatedBy: null, createdAt: '2026-10-02T02:00:00.000Z', updatedAt: '2026-10-02T02:00:00.000Z' },
]

const ROUTES = {
  'GET /api/v1/staff': async (route: Route) => {
    await ok(route, [ADMIN_STAFF, SECOND_STAFF], { page: 1, limit: 100, total: 2, totalPages: 1 })
    return true
  },
  'GET /api/v1/oncall-contacts': async (route: Route) => {
    await ok(route, CONTACTS)
    return true
  },
  'GET /api/v1/transparency/ledger': async (route: Route) => {
    await ok(route, {
      entries: [{ id: 'led-1', entryType: 'SEED', amount: '50000.00', currency: 'USD', reason: 'Setoran awal cadangan ke rekening kustodian', occurredAt: '2026-08-26', createdByName: 'Demo Admin', createdAt: '2026-08-27T01:44:14.000Z' }],
      page: 1, take: 50, total: 1, balance: { amount: '50000.00', currency: 'USD' },
    })
    return true
  },
  'GET /api/v1/transparency/attestations': async (route: Route) => {
    await ok(route, { items: [], page: 1, take: 24, total: 0 })
    return true
  },
}

async function open(page: Page, url: string, width = 1440) {
  await installMockApi(page, { routes: ROUTES })
  await seedAuthenticatedSession(page)
  await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
  await page.goto(url)
}

test.describe('sapu bersih — semua halaman ikut pola baru @e2e', () => {
  test.describe('positive', () => {
    test('Kurs & Biaya: judul + keterangan di atas, tab di bawahnya, kartu lebar penuh, waktu diformat', async ({ page }) => {
      await open(page, '/settings/rate')
      const title = page.getByRole('heading', { level: 1, name: 'Kurs & Biaya' })
      const tabs = page.getByRole('navigation', { name: 'Halaman pengaturan' })
      await expect(title).toBeVisible({ timeout: 15000 })
      const titleBox = (await title.boundingBox())!
      const tabsBox = (await tabs.boundingBox())!
      expect(tabsBox.y).toBeGreaterThan(titleBox.y)

      // Kartu selebar konten (dulu max-w-3xl = setengah layar).
      const card = page.getByText('Kurs saat ini').locator('xpath=ancestor::div[contains(@class,"rounded-md")][1]')
      expect((await card.boundingBox())!.width).toBeGreaterThan(1000)

      await expect(page.getByText('Terakhir diubah (WIB)')).toBeVisible()
      await expect(page.getByText(/^\d{1,2} [A-Z][a-z]{2} \d{4}, \d{2}:\d{2}:\d{2}$/).first()).toBeVisible()

      await tabs.getByRole('link', { name: 'Biaya' }).click()
      await expect(page).toHaveURL(/\/settings\/fee$/)
      await expect(page.getByRole('heading', { level: 1, name: 'Kurs & Biaya' })).toBeVisible()
    })

    test('Cadangan memakai paginasi DataTable (« ‹ 1 / 1 › + "1–1 dari 1"), bukan Sebelumnya/Berikutnya', async ({ page }) => {
      await open(page, '/transparency')
      await expect(page.getByText('1–1 dari 1')).toBeVisible({ timeout: 15000 })
      await expect(page.getByRole('button', { name: 'Halaman pertama buku besar' })).toBeDisabled()
      await expect(page.getByRole('button', { name: 'Sebelumnya', exact: true })).toHaveCount(0)
      await expect(page.getByText(/Halaman \d+ dari \d+/)).toHaveCount(0)
    })

    test('Staf: klik baris = modal di ?staf=, Ubah di footer, ↑/↓ antar staf, tanpa ikon per baris', async ({ page }) => {
      await open(page, '/staff')
      await expect(page.getByRole('button', { name: /^ubah /i })).toHaveCount(0)
      await page.getByRole('button', { name: 'Buka staf Linda Chen' }).click()
      const modal = page.getByTestId('staff-modal')
      await expect(modal.getByRole('heading', { name: 'Linda Chen' })).toBeVisible()
      await expect(page).toHaveURL(/staf=00000000-0000-7000-8000-0000000000a2/)
      await expect(modal.getByTestId('record-modal-position')).toHaveText('2 dari 2')
      await page.keyboard.press('ArrowUp')
      await expect(modal.getByRole('heading', { name: 'System Admin' })).toBeVisible()
      await modal.getByRole('button', { name: 'Ubah data staf' }).click()
      await expect(page.getByRole('dialog', { name: 'Ubah data staf' })).toBeVisible()
    })

    test('Kontak Darurat: klik baris = modal di ?kontak=, Hapus lewat Lainnya membuka dialog hapus lama', async ({ page }) => {
      await open(page, '/settings/oncall')
      await page.getByRole('button', { name: 'Buka kontak Budi Santoso' }).click({ timeout: 15000 })
      const modal = page.getByTestId('oncall-modal')
      await expect(modal.getByRole('heading', { name: 'Budi Santoso' })).toBeVisible()
      await expect(page).toHaveURL(/kontak=oc-1/)
      await modal.getByRole('button', { name: 'Lainnya' }).click()
      await page.getByRole('menuitem', { name: 'Hapus kontak' }).click()
      await expect(page.getByRole('dialog', { name: /hapus kontak darurat/i })).toBeVisible()
    })
  })

  test.describe('negative', () => {
    test('desktop: tidak ada tautan balik kedua di atas halaman — breadcrumb saja', async ({ page }) => {
      await open(page, `/users/${FAILED_ACTIVATION_USER.id}`)
      await expect(page.getByRole('navigation', { name: 'Lokasi halaman' })).toBeVisible({ timeout: 15000 })
      await expect(page.getByRole('navigation', { name: 'Kembali ke halaman induk' })).toBeHidden()
    })
  })

  test.describe('edge cases', () => {
    test('390px: profil nasabah punya "‹ Daftar Nasabah" yang kembali ke daftar', async ({ page }) => {
      await open(page, `/users/${FAILED_ACTIVATION_USER.id}`, 390)
      const back = page.getByRole('navigation', { name: 'Kembali ke halaman induk' }).getByRole('link', { name: 'Daftar Nasabah' })
      await expect(back).toBeVisible({ timeout: 15000 })
      await back.click()
      await expect(page).toHaveURL(/\/users$/)
    })

    test('390px: halaman menu utama tidak menampilkan tautan balik', async ({ page }) => {
      await open(page, '/transactions', 390)
      await expect(page.getByRole('heading', { level: 1, name: 'Transaksi' })).toBeVisible({ timeout: 15000 })
      await expect(page.getByRole('navigation', { name: 'Kembali ke halaman induk' })).toHaveCount(0)
    })

    test('390px: Versi daftar sanksi & Tambah berkas badan usaha juga punya jalan balik', async ({ page }) => {
      await open(page, '/screening/lists', 390)
      await expect(page.getByRole('link', { name: 'Daftar Sanksi' })).toBeVisible({ timeout: 15000 })
      await page.goto('/kyb/new')
      await expect(page.getByRole('link', { name: 'Verifikasi' })).toBeVisible({ timeout: 15000 })
    })
  })
})
