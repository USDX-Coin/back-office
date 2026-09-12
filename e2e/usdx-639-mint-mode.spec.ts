import { test, expect, type Locator } from '@playwright/test'
import { installMockApi, ADMIN_STAFF } from './support/mock-api'
import { seedAuthenticatedSession } from './support/auth'

// USDX-639 — kartu Mode Mint + banner merah global.
// AC E2E:
//   1. buka halaman → kartu menampilkan mode aktif
//   2. geser ke uji tanpa alasan → tombol simpan tidak aktif
//   3. berhasil geser → banner merah muncul, dan tetap ada setelah pindah rute
//   4. STAFF → tidak ada tombol ke mode uji; tombol kembali ke PROD ada
//   5. backend 422 → daftar env tampil di dialog, mode tidak berubah

// Alamat bundle uji (USDX-654) — contoh ber-checksum dari sot/api/mint-mode.yaml.
const TEST_USDX = '0x2702D70446C8d3b5B0Ef6Ad3eB58aA5D3d5a7426'
const TEST_STAFF_SAFE = '0x5b7C0000000000000000000000000000000000A1'
const TEST_MANAGER_SAFE = '0x5B7C0000000000000000000000000000000000B2'

async function fillBundle(dialog: Locator, usdx = TEST_USDX) {
  await dialog.getByLabel(/alamat token uji/i).fill(usdx)
  await dialog.getByLabel(/alamat safe staff uji/i).fill(TEST_STAFF_SAFE)
  await dialog.getByLabel(/alamat safe manager uji/i).fill(TEST_MANAGER_SAFE)
}

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
      // Daftar akses (tambahan lingkup 11 Sep 2026): dua email.
      const emailBox = dialog.getByLabel(/email yang boleh mint/i)
      await emailBox.fill('budi@usdx.io')
      await emailBox.press('Enter')
      await emailBox.fill('siti@usdx.io')
      await dialog.getByRole('button', { name: /^tambah$/i }).click()
      await fillBundle(dialog)
      await dialog.getByRole('button', { name: /geser ke mode uji/i }).click()

      // Bundle uji terbaca di kartu, dipersingkat (USDX-654).
      const bundleBox = page.getByTestId('test-bundle-addresses')
      await expect(bundleBox.getByTitle(TEST_USDX)).toBeVisible()
      await expect(bundleBox.getByTitle(TEST_STAFF_SAFE)).toBeVisible()
      await expect(bundleBox.getByTitle(TEST_MANAGER_SAFE)).toBeVisible()

      // Kartu menampilkan daftarnya tanpa membuka dialog lagi.
      const allowed = page.getByTestId('allowed-emails-list')
      await expect(allowed).toContainText('budi@usdx.io')
      await expect(allowed).toContainText('siti@usdx.io')

      const banner = page.getByTestId('mint-test-mode-banner')
      await expect(banner).toContainText(/mint mencetak token uji, bukan USDX/i)
      await expect(banner).toContainText(/Berakhir \d{2}:\d{2} WIB/)
      await expect(banner).toContainText(/dibatasi ke 2 email/i)

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
      // Sejak USDX-654 alasan + durasi saja belum cukup: bundle uji wajib.
      await expect(dialog.getByRole('button', { name: /geser ke mode uji/i })).toBeDisabled()

      await fillBundle(dialog)
      await expect(dialog.getByRole('button', { name: /geser ke mode uji/i })).toBeEnabled()
    })

    test('USDX-654 — alamat huruf kecil semua ditolak inline, simpan tetap mati', async ({
      page,
    }) => {
      await installMockApi(page)
      await seedAuthenticatedSession(page)
      await page.goto('/settings/mint-mode')

      await page.getByRole('button', { name: /geser ke mode uji/i }).click()
      const dialog = page.getByRole('dialog')
      await dialog.getByLabel(/alasan/i).fill('Uji bayar produksi bersama DurianPay')
      await dialog.getByLabel(/durasi \(jam\)/i).fill('2')
      await fillBundle(dialog, TEST_USDX.toLowerCase())
      // Pindahkan fokus supaya isiannya dinilai.
      await dialog.getByLabel(/alasan/i).click()

      await expect(
        dialog.getByText(/Alamat token uji harus ber-checksum EIP-55/i),
      ).toBeVisible()
      await expect(dialog.getByRole('button', { name: /geser ke mode uji/i })).toBeDisabled()
    })

    test('USDX-654 — penolakan verifikasi on-chain tampil apa adanya di dialog', async ({
      page,
    }) => {
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
                  code: 'MINT_MODE_TEST_ENV_INCOMPLETE',
                  message:
                    'Bundle uji tidak lolos pemeriksaan on-chain: Safe uji STAFF bukan pemegang MINTER_ROLE di token uji',
                  details: ['Safe uji STAFF bukan pemegang MINTER_ROLE di token uji'],
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
      await dialog.getByLabel(/alasan/i).fill('Uji bayar produksi bersama DurianPay')
      await dialog.getByLabel(/durasi \(jam\)/i).fill('2')
      await fillBundle(dialog)
      await dialog.getByRole('button', { name: /geser ke mode uji/i }).click()

      await expect(dialog.getByText(/tidak lolos pemeriksaan on-chain/i)).toBeVisible()
      await expect(
        dialog.getByTestId('mint-mode-error-details').getByText(/bukan pemegang MINTER_ROLE/i),
      ).toBeVisible()
      await expect(page.getByLabel(/mode mint aktif/i)).toHaveText('PROD')
    })

    test('AC tambahan — email berformat salah menahan simpan; daftar kosong diperingatkan', async ({
      page,
    }) => {
      await installMockApi(page)
      await seedAuthenticatedSession(page)
      await page.goto('/settings/mint-mode')

      await page.getByRole('button', { name: /geser ke mode uji/i }).click()
      const dialog = page.getByRole('dialog')
      await dialog.getByLabel(/alasan/i).fill('Uji bayar produksi bersama DurianPay')
      await dialog.getByLabel(/durasi \(jam\)/i).fill('2')

      // Kosong = tidak ada yang bisa mint, dinyatakan sebelum disimpan.
      const warning = dialog.getByTestId('allowed-emails-empty-warning')
      await expect(warning).toContainText(/TIDAK ADA yang bisa mint/i)
      await expect(warning).toContainText(/bukan berarti semua boleh/i)
      await fillBundle(dialog)
      await expect(dialog.getByRole('button', { name: /geser ke mode uji/i })).toBeEnabled()

      await dialog.getByLabel(/email yang boleh mint/i).fill('budi@usdx')
      await expect(dialog.getByText(/format email tidak valid/i)).toBeVisible()
      await expect(dialog.getByRole('button', { name: /geser ke mode uji/i })).toBeDisabled()
    })

    test('AC tambahan — nyalakan tanpa email lalu kembali ke PROD: kartu berkata tertutup, lalu daftar hilang', async ({
      page,
    }) => {
      await installMockApi(page)
      await seedAuthenticatedSession(page)
      await page.goto('/settings/mint-mode')

      await page.getByRole('button', { name: /geser ke mode uji/i }).click()
      const dialog = page.getByRole('dialog')
      await dialog.getByLabel(/alasan/i).fill('Uji bayar produksi bersama DurianPay')
      await dialog.getByLabel(/durasi \(jam\)/i).fill('2')
      await fillBundle(dialog)
      await dialog.getByRole('button', { name: /geser ke mode uji/i }).click()

      await expect(page.getByTestId('allowed-emails-empty')).toContainText(
        /tidak ada satu pun user yang bisa mint/i,
      )
      await expect(page.getByTestId('mint-test-mode-banner')).toContainText(
        /tertutup untuk semua user/i,
      )

      await page.getByRole('button', { name: /kembali ke prod/i }).click()
      const prodDialog = page.getByRole('dialog')
      await prodDialog.getByRole('button', { name: /kembali ke prod/i }).click()

      await expect(page.getByLabel(/mode mint aktif/i)).toHaveText('PROD')
      await expect(page.getByTestId('allowed-emails-empty')).toHaveCount(0)
      await expect(page.getByTestId('allowed-emails-list')).toHaveCount(0)
      // Alamat bundle uji ikut hilang — PROD tidak punya bundle uji (USDX-654).
      await expect(page.getByTestId('test-bundle-addresses')).toHaveCount(0)
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
      await fillBundle(dialog)
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
