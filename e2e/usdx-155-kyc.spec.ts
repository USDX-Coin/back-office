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

      await page.getByRole('link', { name: /kyc review/i }).click()
      await expect(page).toHaveURL(/\/kyc$/)

      // Oldest submission (the PENDING one) is row #1 — fixed ascending sort.
      const rows = page.getByRole('button', { name: /open kyc submission/i })
      await expect(rows).toHaveCount(3)
      await expect(rows.first()).toContainText('alice.pending@example.com')
    })

    test('row click opens detail modal with decrypted PII + photos; close returns to /kyc', async ({ page }) => {
      await installMockApi(page)
      await stubPhotos(page)
      await seedAuthenticatedSession(page)
      await page.goto('/kyc')

      await page.getByRole('button', { name: /open kyc submission for alice\.pending/i }).click()
      await expect(page).toHaveURL(/\/kyc\/kyc_pending$/)

      const dialog = page.getByRole('dialog')
      await expect(dialog.getByText('Alice Anderson')).toBeVisible()
      await expect(dialog.getByText('3171234567890123')).toBeVisible()
      await expect(dialog.getByText(/photo links expire in/i)).toBeVisible()
      await expect(dialog.getByAltText('KTP photo')).toBeVisible()
      await expect(dialog.getByAltText('Selfie with KTP')).toBeVisible()

      // USDX-545 — the CDD block is on the review screen. Without it the
      // reviewer decides without seeing the data that was just collected.
      await expect(dialog.getByText(/customer due diligence/i)).toBeVisible()
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
      await expect(dialog.getByText(/kyc submission/i).first()).toBeVisible()
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
      await expect(dialog.getByRole('button', { name: /^approve$/i })).toBeEnabled()
    })

    test('approve: confirm dialog → list shows VERIFIED and the badge clears', async ({ page }) => {
      await installMockApi(page)
      await stubPhotos(page)
      await seedAuthenticatedSession(page)
      await page.goto('/kyc/kyc_pending')

      const dialog = page.getByRole('dialog').first()
      await expect(dialog.getByText('Alice Anderson')).toBeVisible()
      await dialog.getByRole('button', { name: /^approve$/i }).click()

      const confirm = page.getByRole('dialog').filter({ hasText: /approve this kyc submission\?/i })
      await confirm.getByRole('button', { name: /^approve$/i }).click()

      // Modal closes back to the list; the row is VERIFIED now.
      await expect(page).toHaveURL(/\/kyc$/)
      const row = page.getByRole('button', { name: /open kyc submission for alice\.pending/i })
      await expect(row).toContainText('Verified')
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
      await dialog.getByRole('button', { name: /^reject$/i }).click()

      const rejectDialog = page.getByRole('dialog').filter({ hasText: /reject this kyc submission\?/i })
      // Submit empty → inline validation, no navigation.
      await rejectDialog.getByRole('button', { name: /^reject$/i }).click()
      await expect(rejectDialog.getByText(/rejection reason is required/i)).toBeVisible()

      // USDX-610 — satu huruf juga ditahan di sini, bukan dikirim lalu dijawab 400.
      // Nasabah yang menerima "x" lewat email `kyc-rejected.html` tidak tahu apa
      // yang harus diperbaiki, jadi ia mengunggah ulang berkas yang sama persis.
      await rejectDialog.getByLabel('Rejection reason').fill('x')
      await rejectDialog.getByRole('button', { name: /^reject$/i }).click()
      await expect(
        rejectDialog.getByRole('alert').filter({ hasText: /at least 10 characters/i }),
      ).toBeVisible()
      await expect(page).toHaveURL(/\/kyc\/kyc_pending$/)

      await rejectDialog.getByLabel('Rejection reason').fill('Foto KTP buram, mohon submit ulang')
      await rejectDialog.getByRole('button', { name: /^reject$/i }).click()

      await expect(page).toHaveURL(/\/kyc$/)
      const row = page.getByRole('button', { name: /open kyc submission for alice\.pending/i })
      await expect(row).toContainText('Rejected')
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
      await dialog.getByRole('button', { name: /audit trail/i }).click()

      // The deep-link's own detail GET already wrote a VIEWED row. Exact match:
      // the modal header also contains "Submitted {date}".
      await expect(dialog.getByText('Viewed', { exact: true }).first()).toBeVisible()
      await expect(dialog.getByText('Submitted', { exact: true })).toBeVisible()
    })
  })
})
