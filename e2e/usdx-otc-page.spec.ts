import { test, expect, type Page } from '@playwright/test'
import { ADMIN_STAFF, installMockApi } from './support/mock-api'
import { seedAuthenticatedSession } from './support/auth'

// Redesain fase 1 — OTC: SATU halaman untuk mint OTC + redeem OTC, status tanda
// tangan multisig dicocokkan lewat safeTxHash, klik baris → panel kanan.
// Menggantikan spec daftar Mint/Burn lama (usdx-26-requests).

function asStaff() {
  return {
    routes: {
      'GET /api/v1/auth/me': async (route: import('@playwright/test').Route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'success', metadata: null, data: { ...ADMIN_STAFF, role: 'STAFF' } }),
        })
        return true
      },
    },
  }
}

async function openOtc(page: Page, path = '/otc') {
  await page.goto(path)
  await expect(page.getByRole('heading', { name: /^otc$/i, level: 1 })).toBeVisible({ timeout: 15000 })
}

const actionGroup = (page: Page) => page.locator('tbody[data-group="action"]')
const historyGroup = (page: Page) => page.locator('tbody[data-group="history"]')

test.describe('OTC page @e2e', () => {
  test.describe('positive', () => {
    test.beforeEach(async ({ page }) => {
      await installMockApi(page)
      await seedAuthenticatedSession(page)
    })

    test('lists mint + redeem in one table, action group on top with "x dari y" signatures', async ({ page }) => {
      const statuses: string[] = []
      page.on('request', (r) => {
        const u = new URL(r.url())
        if (u.pathname === '/api/v1/requests') statuses.push(u.searchParams.get('status') ?? '')
      })
      await openOtc(page)
      await expect(actionGroup(page).getByText('1 dari 2 tanda tangan')).toBeVisible({ timeout: 10000 })
      await expect(actionGroup(page).getByText('Siap dieksekusi')).toBeVisible()
      await expect(actionGroup(page).getByText('Redeem OTC')).toBeVisible()
      await expect(historyGroup(page).getByText('Rupiah sudah dikirim')).toBeVisible()
      await expect(historyGroup(page).getByText('Ditolak')).toBeVisible()
      expect(statuses).toEqual(expect.arrayContaining(['PENDING_APPROVAL,APPROVED', 'EXECUTED,IDR_TRANSFERRED,REJECTED']))
      // One vocabulary on screen: redeem, never burn.
      await expect(page.getByText(/\bburn\b/i)).toHaveCount(0)
    })

    test('row click opens the right panel next to the table, with one primary action', async ({ page }) => {
      await openOtc(page)
      await page.getByRole('button', { name: /^Buka Mint OTC Robert Deon, 100,00 USDX/ }).first().click()
      await expect(page).toHaveURL(/\/otc\/req_mint_pending/)
      const panel = page.getByRole('region', { name: 'Detail permintaan OTC' })
      await expect(panel.getByText('Yang perlu kamu lakukan')).toBeVisible()
      await expect(panel.getByText('Marcus Thorne', { exact: true })).toBeVisible()
      // No wallet in the test browser → the one action is to connect it.
      await expect(panel.getByRole('button', { name: 'Hubungkan wallet' })).toBeVisible()
      await expect(panel.getByRole('button', { name: /lainnya/i })).toBeVisible()
      // Table still there and still clickable (no overlay).
      await expect(page.locator('table')).toBeVisible()
      await page.getByRole('button', { name: /^Buka Redeem OTC Robert Deon, 10,00 USDX/ }).click()
      await expect(panel.getByText(/Tanda tangan sudah lengkap/)).toBeVisible()
    })

    test('Jenis + search write to the URL and narrow both groups', async ({ page }) => {
      await openOtc(page)
      await page.getByLabel('Jenis').selectOption('burn')
      await expect(page).toHaveURL(/[?&]jenis=burn/)
      await expect(page.getByRole('button', { name: /^Buka Mint OTC/ })).toHaveCount(0)
      await page.getByRole('textbox', { name: 'Cari permintaan OTC' }).fill('robert')
      await expect(page).toHaveURL(/[?&]search=robert/)
    })
  })

  test.describe('negative', () => {
    test('STAFF does not see the OTC menu and is redirected away from /otc', async ({ page }) => {
      await installMockApi(page, asStaff())
      await seedAuthenticatedSession(page)
      await page.goto('/otc')
      await expect(page).toHaveURL(/\/transactions/, { timeout: 15000 })
      await expect(page.getByRole('link', { name: /^OTC/ })).toHaveCount(0)
    })
  })

  test.describe('edge cases', () => {
    test.beforeEach(async ({ page }) => {
      await installMockApi(page)
      await seedAuthenticatedSession(page)
    })

    test('old list URLs keep working as redirects', async ({ page }) => {
      await page.goto('/mint')
      await expect(page).toHaveURL(/\/otc\?jenis=mint/, { timeout: 15000 })
      await page.goto('/burn/req_burn_pending')
      await expect(page).toHaveURL(/\/otc\/req_burn_pending/)
      await expect(page.getByRole('region', { name: 'Detail permintaan OTC' })).toBeVisible()
    })

    test('on a phone the panel takes the screen with "‹ Kembali ke tabel"', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 })
      await openOtc(page, '/otc/req_mint_pending')
      const panel = page.getByRole('region', { name: 'Detail permintaan OTC' })
      await expect(panel).toBeVisible()
      await expect(page.locator('table')).toBeHidden()
      await panel.getByRole('button', { name: /kembali ke tabel/i }).click()
      await expect(page).toHaveURL(/\/otc$/)
      await expect(page.locator('table')).toBeVisible()
    })
  })
})
