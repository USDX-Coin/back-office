import { test, expect } from '@playwright/test'
import { installMockApi } from './support/mock-api'
import { seedAuthenticatedSession } from './support/auth'

// USDX-26 — Critical flow #5: user CRUD (create → list, edit KYC status,
// delete with confirmation) plus the directory filters. Mock-backed.
// PM Okt 2026: a row opens the customer SUMMARY MODAL in the centre
// (`/users?nasabah=:id`, the table keeps its full width); edit and delete live
// under its footer "Lainnya" menu, delete confirms INLINE in the footer, and
// "Buka profil lengkap" goes to the full `/users/:id` page.
// USDX-156 dropped the temporary-password reveal: create now just queues an
// activation email (the user sets their own password via the 7-day link).

function uniqueEmail(prefix = 'usdx26-e2e') {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}@example.test`
}

test.describe('USDX-26 user CRUD @e2e', () => {
  test.beforeEach(async ({ page }) => {
    await installMockApi(page)
    await seedAuthenticatedSession(page)
    await page.goto('/users')
    await expect(page.getByRole('heading', { name: /^daftar nasabah$/i, level: 1 })).toBeVisible({ timeout: 15000 })
  })

  test.describe('positive', () => {
    test('should render the Name / Email / Entity / KYC / Status columns', async ({ page }) => {
      const head = page.locator('thead')
      await expect(head.getByText('Nama')).toBeVisible()
      await expect(head.getByText('Email')).toBeVisible()
      await expect(head.getByText('Jenis')).toBeVisible()
      await expect(head.getByText('KYC')).toBeVisible()
      await expect(head.getByText('Status')).toBeVisible()
      await expect(page.getByText('Robert Deon')).toBeVisible()
    })

    test('should create a user (no password anywhere) and list the user', async ({ page }) => {
      const name = `E2E Probe ${Math.random().toString(36).slice(2, 6)}`
      await page.getByRole('button', { name: /tambah nasabah/i }).first().click()
      // USDX-156 AC: no password field in the DOM; the modal explains the
      // activation email instead.
      await expect(page.getByLabel(/kata sandi/i)).toHaveCount(0)
      await expect(page.getByRole('dialog').getByText(/email aktivasi/i)).toBeVisible()
      await page.getByLabel(/^nama$/i).fill(name)
      await page.getByLabel(/^email$/i).fill(uniqueEmail())
      await page.getByRole('button', { name: /^buat nasabah$/i }).click()

      await expect(page.getByText(/nasabah dibuat\. email aktivasi terkirim\./i)).toBeVisible({ timeout: 10000 })
      await expect(page.getByRole('heading', { name: /kata sandi sementara/i })).toHaveCount(0)
      await expect(page.getByRole('button', { name: new RegExp(`^Buka nasabah ${name}`) })).toBeVisible({ timeout: 10000 })
    })

    test('should open the customer summary modal in the centre on row click, then the full profile', async ({ page }) => {
      await page.getByRole('button', { name: /^Buka nasabah Robert Deon/ }).click()
      await expect(page).toHaveURL(/[?&]nasabah=/)
      const modal = page.getByTestId('customer-modal')
      await expect(modal.getByRole('heading', { name: 'Robert Deon' })).toBeVisible()
      await expect(modal.getByRole('button', { name: /lainnya/i })).toBeVisible()
      await expect(page.getByRole('region', { name: 'Detail nasabah' })).toHaveCount(0)
      await modal.getByRole('button', { name: 'Buka profil lengkap' }).click()
      await expect(page).toHaveURL(/\/users\/[^?]+$/)
      await expect(page.getByTestId('customer-modal')).toHaveCount(0)
    })

    test('should save a KYC-status edit and show a confirmation toast', async ({ page }) => {
      await page.getByRole('button', { name: /^Buka nasabah Robert Deon/ }).click()
      const modal = page.getByTestId('customer-modal')
      await modal.getByRole('button', { name: /lainnya/i }).click()
      await page.getByRole('menuitem', { name: 'Ubah data nasabah' }).click()
      await expect(page.getByRole('dialog', { name: /ubah data nasabah/i })).toBeVisible()
      // Radix Select trigger isn't reliably label-associated — target it by id.
      await page.locator('#kycStatus').click()
      await page.getByRole('option', { name: /^terverifikasi$/i }).click()
      await page.getByRole('button', { name: /simpan perubahan/i }).click()
      await expect(page.getByText(/data nasabah diperbarui/i)).toBeVisible({ timeout: 10000 })
    })

    test('should delete a user after confirmation and remove the row', async ({ page }) => {
      // create a disposable user first so the test is non-destructive
      const name = `Delete Probe ${Math.random().toString(36).slice(2, 6)}`
      await page.getByRole('button', { name: /tambah nasabah/i }).first().click()
      await page.getByLabel(/^nama$/i).fill(name)
      await page.getByLabel(/^email$/i).fill(uniqueEmail('delete-probe'))
      await page.getByRole('button', { name: /^buat nasabah$/i }).click()
      const row = page.getByRole('button', { name: new RegExp(`^Buka nasabah ${name}`) })
      await expect(row).toBeVisible({ timeout: 10000 })

      await row.click()
      const modal = page.getByTestId('customer-modal')
      await modal.getByRole('button', { name: /lainnya/i }).click()
      await page.getByRole('menuitem', { name: 'Hapus nasabah' }).click()
      // Inline confirmation in the modal footer that names the customer — no second dialog.
      await expect(modal.getByText(`Hapus ${name}?`)).toBeVisible()
      await modal.getByRole('button', { name: /^ya, hapus nasabah$/i }).click()
      await expect(page.getByTestId('customer-modal')).toHaveCount(0)
      await expect(page.getByText(new RegExp(`${name} dihapus`))).toBeVisible({ timeout: 10000 })
      await expect(page.getByRole('button', { name: new RegExp(`^Buka nasabah ${name}`) })).toHaveCount(0)
    })
  })

  test.describe('negative', () => {
    test('should show a client-side validation error and send no request for a name over 255 chars', async ({ page }) => {
      let posted = false
      page.on('request', (r) => { if (r.method() === 'POST' && r.url().includes('/api/v1/users')) posted = true })
      await page.getByRole('button', { name: /tambah nasabah/i }).first().click()
      await page.getByLabel(/^nama$/i).fill('a'.repeat(260))
      await page.getByLabel(/^email$/i).fill(uniqueEmail())
      await page.getByRole('button', { name: /^buat nasabah$/i }).click()
      await expect(page.getByText(/maksimal 255 karakter/i)).toBeVisible()
      expect(posted).toBe(false)
    })

    test('should show a client-side validation error for notes over 2000 chars', async ({ page }) => {
      await page.getByRole('button', { name: /tambah nasabah/i }).first().click()
      await page.getByLabel(/^nama$/i).fill('Notes Probe')
      await page.getByLabel(/^email$/i).fill(uniqueEmail())
      await page.getByLabel(/catatan/i).fill('x'.repeat(2100))
      await page.getByRole('button', { name: /^buat nasabah$/i }).click()
      await expect(page.getByText(/maksimal 2000 karakter/i)).toBeVisible()
    })

    test('should surface a backend 409 in the modal for a duplicate email', async ({ page }) => {
      await page.getByRole('button', { name: /tambah nasabah/i }).first().click()
      await page.getByLabel(/^nama$/i).fill('Dup Email Probe')
      await page.getByLabel(/^email$/i).fill('robert.deon@example.com') // already in the seeded directory
      await page.getByRole('button', { name: /^buat nasabah$/i }).click()
      // Kode server (`EMAIL_ALREADY_REGISTERED`, sama dengan backend) diterjemahkan peta galat.
      await expect(page.getByText(/email ini sudah terdaftar/i).first()).toBeVisible({ timeout: 10000 })
      // modal stays open (still on /users with the dialog present)
      await expect(page.getByRole('dialog')).toBeVisible()
    })
  })

  test.describe('edge cases', () => {
    test('should reflect a KYC-status filter in the URL', async ({ page }) => {
      // USDX-27: filters now live behind a "Filter" popover (TableToolbar).
      await page.getByRole('button', { name: /^filter/i }).click()
      await page.getByRole('combobox', { name: 'KYC' }).click()
      await page.getByRole('option', { name: /^terverifikasi$/i }).click()
      await page.getByRole('button', { name: /^terapkan$/i }).click()
      await expect(page).toHaveURL(/kycStatus=VERIFIED/)
    })

    test('should reflect an entity-type filter in the URL', async ({ page }) => {
      await page.getByRole('button', { name: /^filter/i }).click()
      await page.getByRole('combobox', { name: 'Jenis' }).click()
      await page.getByRole('option', { name: /^perorangan$/i }).click()
      await page.getByRole('button', { name: /^terapkan$/i }).click()
      await expect(page).toHaveURL(/entityType=INDIVIDUAL/)
    })

    test('should add no user when the create modal is cancelled', async ({ page }) => {
      // Count only after the list has loaded — counting during the skeleton
      // reads 0 and the comparison below becomes a race, not a check.
      await expect(page.getByRole('button', { name: /^Buka nasabah/ }).first()).toBeVisible({ timeout: 10000 })
      const before = await page.getByRole('button', { name: /^Buka nasabah/ }).count()
      await page.getByRole('button', { name: /tambah nasabah/i }).first().click()
      await page.getByLabel(/^nama$/i).fill('Cancelled Probe')
      await page.getByLabel(/^email$/i).fill(uniqueEmail())
      await page.keyboard.press('Escape')
      await expect(page.getByRole('dialog')).toHaveCount(0)
      expect(await page.getByRole('button', { name: /^Buka nasabah/ }).count()).toBe(before)
    })
  })
})
