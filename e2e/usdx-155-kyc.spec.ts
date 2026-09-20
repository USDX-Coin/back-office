import { test, expect, type Page } from '@playwright/test'
import { installMockApi } from './support/mock-api'
import { seedAuthenticatedSession } from './support/auth'

// USDX-154/155 — Critical flow: KYC review. Sidebar COMPLIANCE badge → /kyc
// list (oldest first) → /kyc/:id detail modal (PII + presigned photos) →
// approve / reject → list + badge refresh. Hermetic via support/mock-api.ts.

// 1×1 transparent PNG — stands in for the presigned bucket photos so the
// <img> elements actually load (and the CSP img-src allowance is exercised).
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
)

async function stubPhotos(page: Page) {
  await page.route('**://t3.storageapi.dev/**', (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: TINY_PNG })
  )
}

test.describe('USDX-155 KYC review @e2e', () => {
  test.describe('positive', () => {
    test('sidebar COMPLIANCE badge counts PENDING and routes to the oldest-first list', async ({ page }) => {
      await installMockApi(page)
      await seedAuthenticatedSession(page)
      await page.goto('/dashboard')

      // Badge = 1 (one seeded PENDING submission).
      const badge = page.getByTestId('nav-badge-kyc')
      await expect(badge).toHaveText('1')

      // § 4 P2-1 — "KYC Review" jadi "Verifikasi Perorangan" di menu.
      // § 4 P1-3 — Beranda kini juga punya kartu antrean ke /kyc, jadi nama
      // yang sama muncul dua kali. Yang diuji tes ini tetap SIDEBAR-nya.
      await page.locator('aside').getByRole('link', { name: /^verifikasi perorangan/i }).click()
      await expect(page).toHaveURL(/\/kyc$/)

      // Oldest submission (the PENDING one) is row #1 — fixed ascending sort.
      const rows = page.getByRole('button', { name: /buka berkas kyc/i })
      await expect(rows).toHaveCount(3)
      await expect(rows.first()).toContainText('alice.pending@example.com')
    })

    test('row click opens detail modal with decrypted PII + photos; close returns to /kyc', async ({ page }) => {
      await installMockApi(page)
      await stubPhotos(page)
      await seedAuthenticatedSession(page)
      await page.goto('/kyc')

      await page.getByRole('button', { name: /buka berkas kyc alice\.pending/i }).click()
      await expect(page).toHaveURL(/\/kyc\/kyc_pending$/)

      const dialog = page.getByRole('dialog')
      await expect(dialog.getByText('Alice Anderson')).toBeVisible()
      await expect(dialog.getByText('3171234567890123')).toBeVisible()
      await expect(dialog.getByText(/tautan foto kedaluwarsa dalam/i)).toBeVisible()
      await expect(dialog.getByAltText('Foto KTP')).toBeVisible()
      await expect(dialog.getByAltText('Selfie dengan KTP')).toBeVisible()

      // USDX-545 — the CDD block is on the review screen. Without it the
      // reviewer decides without seeing the data that was just collected.
      await expect(dialog.getByText(/uji tuntas nasabah/i)).toBeVisible()
      // Permendagri label, not the `PEGAWAI_NEGERI_SIPIL` enum value — the
      // officer is comparing this against the "Pekerjaan" column of the KTP
      // shown right below it.
      await expect(
        dialog.getByTestId('kyc-occupation').getByText('Pegawai Negeri Sipil (PNS)'),
      ).toBeVisible()
      await expect(dialog.getByText('Business')).toBeVisible()
      await expect(dialog.getByText('Rp 500 juta – 1 miliar')).toBeVisible()
      await expect(dialog.getByText('Remittance')).toBeVisible()
      await expect(dialog.getByText('Not a PEP')).toBeVisible()
      // USDX-587 — the nine answers the customer gives and the reviewer could
      // not see until this ticket. Without them Approve is a stamp, not the
      // "hasil analisis" Pasal 63 ayat (2) huruf c requires to be on file.
      await expect(
        dialog.getByTestId('kyc-gender').getByText('Perempuan'),
      ).toBeVisible()
      await expect(
        dialog.getByTestId('kyc-marital-status').getByText('Belum Kawin'),
      ).toBeVisible()
      await expect(
        dialog.getByTestId('kyc-net-worth').getByText('Rp 500 juta – 2 miliar'),
      ).toBeVisible()
      await expect(
        dialog.getByTestId('kyc-source-of-wealth').getByText('Akumulasi gaji'),
      ).toBeVisible()
      // The operator here is ADMIN, so the PII fields are readable (masking for
      // other roles is covered by the unit tests, which can pick a role per
      // render).
      await expect(dialog.getByText('123456789012345')).toBeVisible()
      await expect(
        dialog.getByTestId('kyc-mothers-maiden-name').getByText('Siti Rohmah'),
      ).toBeVisible()
      await expect(
        dialog
          .getByTestId('kyc-employer-address')
          .getByText('Jl. Gatot Subroto No. 12, Jakarta Selatan'),
      ).toBeVisible()

      await page.keyboard.press('Escape')
      await expect(page).toHaveURL(/\/kyc$/)
      await expect(page.getByRole('dialog')).toBeHidden()
    })

    test('deep link /kyc/:id is refresh-safe (modal opens from a cold load)', async ({ page }) => {
      await installMockApi(page)
      await stubPhotos(page)
      await seedAuthenticatedSession(page)
      await page.goto('/kyc/kyc_pending')

      const dialog = page.getByRole('dialog')
      await expect(dialog.getByText(/berkas verifikasi perorangan/i).first()).toBeVisible()
      await expect(dialog.getByText('Alice Anderson')).toBeVisible()
    })

    // USDX-610 — berkas yang salah satu daftarnya tidak terbaca harus MENGATAKANNYA,
    // dan Approve TETAP bisa ditekan. Yang diperbaiki adalah kebisuannya: satu berkas
    // KYB memegang `LIST_UNAVAILABLE` untuk DPPSPM lalu disetujui 69 detik kemudian.
    test('screening panel names the unreadable list and does NOT block approve', async ({ page }) => {
      await installMockApi(page)
      await stubPhotos(page)
      await seedAuthenticatedSession(page)
      await page.goto('/kyc/kyc_pending')

      const dialog = page.getByRole('dialog').first()
      const banner = dialog.getByTestId('screening-unchecked')
      await expect(banner).toBeVisible()
      await expect(banner).toContainText('DPPSPM')
      await expect(banner).toContainText('LIST_UNAVAILABLE')
      // Daftar yang MEMANG tercek tampil dengan versinya, bukan cuma "lolos".
      await expect(dialog.getByTestId('screening-list-DTTOT')).toContainText('2026-08-16')
      await expect(dialog.getByRole('button', { name: /^setujui$/i })).toBeEnabled()
    })

    test('approve: confirm dialog → list shows VERIFIED and the badge clears', async ({ page }) => {
      await installMockApi(page)
      await stubPhotos(page)
      await seedAuthenticatedSession(page)
      await page.goto('/kyc/kyc_pending')

      const dialog = page.getByRole('dialog').first()
      await expect(dialog.getByText('Alice Anderson')).toBeVisible()
      await dialog.getByRole('button', { name: /^setujui$/i }).click()

      const confirm = page.getByRole('dialog').filter({ hasText: /setujui berkas kyc ini\?/i })
      await confirm.getByRole('button', { name: /^ya, setujui$/i }).click()

      // Modal closes back to the list; the row is VERIFIED now.
      await expect(page).toHaveURL(/\/kyc$/)
      const row = page.getByRole('button', { name: /buka berkas kyc alice\.pending/i })
      await expect(row).toContainText('Terverifikasi')
      // No PENDING left → the (N) badge unmounts.
      await expect(page.getByTestId('nav-badge-kyc')).toHaveCount(0)
    })

    test('reject: empty reason blocks, valid reason lands REJECTED on the list', async ({ page }) => {
      await installMockApi(page)
      await stubPhotos(page)
      await seedAuthenticatedSession(page)
      await page.goto('/kyc/kyc_pending')

      const dialog = page.getByRole('dialog').first()
      await expect(dialog.getByText('Alice Anderson')).toBeVisible()
      await dialog.getByRole('button', { name: /^tolak$/i }).click()

      const rejectDialog = page.getByRole('dialog').filter({ hasText: /tolak berkas kyc ini\?/i })
      // Submit empty → inline validation, no navigation.
      await rejectDialog.getByRole('button', { name: /^ya, tolak$/i }).click()
      await expect(rejectDialog.getByText(/alasan penolakan wajib diisi/i)).toBeVisible()

      // USDX-610 — satu huruf juga ditahan di sini, bukan dikirim lalu dijawab 400.
      // Nasabah yang menerima "x" lewat email `kyc-rejected.html` tidak tahu apa
      // yang harus diperbaiki, jadi ia mengunggah ulang berkas yang sama persis.
      await rejectDialog.getByLabel('Alasan penolakan').fill('x')
      await rejectDialog.getByRole('button', { name: /^ya, tolak$/i }).click()
      await expect(
        rejectDialog.getByRole('alert').filter({ hasText: /minimal 10 karakter/i }),
      ).toBeVisible()
      await expect(page).toHaveURL(/\/kyc\/kyc_pending$/)

      await rejectDialog.getByLabel('Alasan penolakan').fill('Foto KTP buram, mohon submit ulang')
      await rejectDialog.getByRole('button', { name: /^ya, tolak$/i }).click()

      await expect(page).toHaveURL(/\/kyc$/)
      const row = page.getByRole('button', { name: /buka berkas kyc alice\.pending/i })
      await expect(row).toContainText('Ditolak')
    })
  })

  test.describe('negative', () => {
    test('audit trail expands with SUBMITTED + VIEWED rows (detail GET is audit-logged)', async ({ page }) => {
      await installMockApi(page)
      await stubPhotos(page)
      await seedAuthenticatedSession(page)
      await page.goto('/kyc/kyc_pending')

      const dialog = page.getByRole('dialog')
      await expect(dialog.getByText('Alice Anderson')).toBeVisible()
      await dialog.getByRole('button', { name: /jejak audit/i }).click()

      // The deep-link's own detail GET already wrote a VIEWED row. Exact match:
      // the modal header also contains "Submitted {date}".
      await expect(dialog.getByText('Dilihat', { exact: true }).first()).toBeVisible()
      await expect(dialog.getByText('Diajukan', { exact: true })).toBeVisible()
    })
  })
})
