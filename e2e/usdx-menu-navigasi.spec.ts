import { test, expect, type Page } from '@playwright/test'
import { installMockApi, FAILED_ACTIVATION_USER } from './support/mock-api'
import { seedAuthenticatedSession } from './support/auth'

// Bug 11 Okt 2026: pindah halaman lewat item menu "Lainnya" di dalam modal
// meninggalkan `pointer-events: none` di <body> — sidebar & breadcrumb tidak
// bisa diklik dan konten tidak bisa digulir sampai halaman dimuat ulang.
// Penyebab: DropdownMenu Radix mode modal bertumpuk di atas Dialog modal; saat
// item memanggil navigate(), menu dan dialog dilepas bersamaan dan kunci
// pointer-events milik menu tidak pernah dikembalikan. Spec ini menjaga setiap
// jalur menu yang memindah halaman.

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

/** Setelah pindah halaman: body bebas kunci, konten bisa digulir, sidebar bisa diklik. */
async function expectPageUsable(page: Page) {
  // Radix melepas kuncinya setelah animasi tutup; beri waktu yang sama dengan pengguna.
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.body).pointerEvents))
    .not.toBe('none')
  await expect(page.locator('body')).not.toHaveAttribute('style', /pointer-events:\s*none/)
  await expect(page.getByRole('dialog')).toHaveCount(0)

  // Gulir konten dengan roda tetikus (bukan scrollTop langsung) — itu yang dulu mati.
  const main = page.locator('main')
  const box = await main.boundingBox()
  expect(box).not.toBeNull()
  const scrollable = await main.evaluate((m) => m.scrollHeight > m.clientHeight)
  if (scrollable) {
    await page.mouse.move(box!.x + box!.width / 2, box!.y + Math.min(200, box!.height / 2))
    await page.mouse.wheel(0, 400)
    await expect.poll(() => main.evaluate((m) => m.scrollTop)).toBeGreaterThan(0)
  }

  // Link sidebar benar-benar menerima klik (tanpa force).
  await page.locator('aside').getByRole('link', { name: 'Ringkasan' }).click({ timeout: 5000 })
  await expect(page).toHaveURL(/\/ringkasan$/)
}

test.describe('menu "Lainnya" yang memindah halaman @e2e', () => {
  test.describe('positive', () => {
    test('Verifikasi → Lainnya → Lihat profil nasabah: halaman profil bisa diklik dan digulir', async ({ page }) => {
      await installMockApi(page)
      await page.route('**://t3.storageapi.dev/**', (r) => r.fulfill({ status: 200, contentType: 'image/png', body: TINY_PNG }))
      await seedAuthenticatedSession(page)
      await page.setViewportSize({ width: 1440, height: 500 })
      await page.goto('/verifikasi/perorangan/kyc_pending')
      const modal = page.getByTestId('kyc-modal')
      await expect(modal.getByRole('heading', { name: 'Alice Anderson' })).toBeVisible({ timeout: 15000 })

      await modal.getByRole('button', { name: /^Lainnya/ }).click()
      await page.getByRole('menuitem', { name: 'Lihat profil nasabah' }).click()
      await expect(page).toHaveURL(/\/users\/usr_kyc_pending$/)
      await expectPageUsable(page)
    })

    test('Daftar Nasabah → Lainnya → Lihat transaksinya: Transaksi bisa diklik dan digulir', async ({ page }) => {
      await installMockApi(page)
      await seedAuthenticatedSession(page)
      await page.setViewportSize({ width: 1440, height: 500 })
      await page.goto(`/users?nasabah=${FAILED_ACTIVATION_USER.id}`)
      const modal = page.getByTestId('customer-modal')
      await expect(modal.getByRole('heading', { name: FAILED_ACTIVATION_USER.name })).toBeVisible({ timeout: 15000 })

      await modal.getByRole('button', { name: /^Lainnya/ }).click()
      await page.getByRole('menuitem', { name: 'Lihat transaksinya' }).click()
      await expect(page).toHaveURL(/\/transactions\?userId=/)
      await expectPageUsable(page)
    })

    test('OTC → Lainnya → Buka halaman tanda tangan lengkap: halaman tanda tangan bisa diklik', async ({ page }) => {
      await installMockApi(page)
      await seedAuthenticatedSession(page)
      await page.setViewportSize({ width: 1440, height: 500 })
      await page.goto('/otc/mint/req_mint_pending')
      const modal = page.getByTestId('otc-modal')
      await expect(modal.getByRole('button', { name: /^Lainnya/ })).toBeVisible({ timeout: 15000 })

      await modal.getByRole('button', { name: /^Lainnya/ }).click()
      await page.getByRole('menuitem', { name: 'Buka halaman tanda tangan lengkap' }).click()
      await expect(page).toHaveURL(/\/multisig\//)
      // /multisig/:id membuka modal tanda tangan sendiri — tutup dulu, lalu periksa halamannya.
      const sig = page.getByTestId('multisig-modal')
      await expect(sig).toBeVisible({ timeout: 15000 })
      await page.keyboard.press('Escape')
      await expect(sig).toHaveCount(0)
      await expectPageUsable(page)
    })

    test('breadcrumb: "Daftar Nasabah" di profil = tautan ke daftar, grup & segmen terakhir teks', async ({ page }) => {
      await installMockApi(page)
      await seedAuthenticatedSession(page)
      await page.setViewportSize({ width: 1440, height: 900 })
      await page.goto(`/users/${FAILED_ACTIVATION_USER.id}`)
      const crumbs = page.getByRole('navigation', { name: 'Lokasi halaman' })
      await expect(crumbs.getByText('Profil nasabah')).toHaveAttribute('aria-current', 'page')
      await expect(crumbs.getByRole('link')).toHaveCount(1)
      await expect(crumbs.getByRole('link', { name: 'Nasabah', exact: true })).toHaveCount(0)
      // Tombol "← Kembali ke daftar nasabah" yang dobel sudah tidak ada.
      await expect(page.getByRole('button', { name: /kembali ke daftar nasabah/i })).toHaveCount(0)
      await crumbs.getByRole('link', { name: 'Daftar Nasabah' }).click()
      await expect(page).toHaveURL(/\/users$/)
    })

    test('menu profil di navbar → Profil: halaman tetap bisa diklik', async ({ page }) => {
      await installMockApi(page)
      await seedAuthenticatedSession(page)
      await page.setViewportSize({ width: 1440, height: 500 })
      await page.goto('/users')
      await page.locator('header').getByRole('button', { name: /System Admin/ }).click()
      await page.getByRole('menuitem', { name: /profil/i }).click()
      await expect(page).toHaveURL(/\/profile$/)
      await expectPageUsable(page)
    })
  })

  test.describe('edge cases', () => {
    test('menutup menu tanpa memilih tidak meninggalkan kunci setelah modal ditutup', async ({ page }) => {
      await installMockApi(page)
      await page.route('**://t3.storageapi.dev/**', (r) => r.fulfill({ status: 200, contentType: 'image/png', body: TINY_PNG }))
      await seedAuthenticatedSession(page)
      await page.setViewportSize({ width: 1440, height: 500 })
      await page.goto('/verifikasi/perorangan/kyc_pending')
      const modal = page.getByTestId('kyc-modal')
      await expect(modal.getByRole('heading', { name: 'Alice Anderson' })).toBeVisible({ timeout: 15000 })
      await modal.getByRole('button', { name: /^Lainnya/ }).click()
      await expect(page.getByRole('menuitem', { name: 'Lihat profil nasabah' })).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(page.getByRole('menuitem')).toHaveCount(0)
      await page.keyboard.press('Escape')
      await expect(modal).toHaveCount(0)
      await expectPageUsable(page)
    })
  })
})
