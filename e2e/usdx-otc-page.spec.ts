import { test, expect, type Page } from '@playwright/test'
import { ADMIN_STAFF, installMockApi } from './support/mock-api'
import { seedAuthenticatedSession } from './support/auth'

// OTC ▸ Mint / OTC ▸ Redeem (10 Okt 2026): satu halaman per jenis, status tanda
// tangan multisig dicocokkan lewat safeTxHash, klik baris → modal tengah
// dengan tanda tangan Safe di footer. Menggantikan spec OTC satu tabel (fase 1).

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

async function openOtc(page: Page, path = '/otc/mint', title = /^mint otc$/i) {
  await page.goto(path)
  await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible({ timeout: 15000 })
}

const actionGroup = (page: Page) => page.locator('tbody[data-group="action"]')
const historyGroup = (page: Page) => page.locator('tbody[data-group="history"]')

test.describe('OTC ▸ Mint / Redeem @e2e', () => {
  test.describe('positive', () => {
    test.beforeEach(async ({ page }) => {
      await installMockApi(page)
      await seedAuthenticatedSession(page)
    })

    test('OTC is a menu group with Mint and Redeem sub-menus, each with its own count', async ({ page }) => {
      await openOtc(page)
      const aside = page.getByRole('complementary')
      await expect(aside.getByRole('button', { name: /^OTC/ })).toHaveAttribute('aria-expanded', 'true')
      await expect(aside.getByRole('link', { name: /^Mint/ })).toHaveAttribute('aria-current', 'page')
      await expect(aside.getByTestId('nav-badge-otc-mint')).toBeVisible()
      await aside.getByRole('link', { name: /^Redeem/ }).click()
      await expect(page).toHaveURL(/\/otc\/redeem$/)
      await expect(page.getByRole('heading', { name: /^redeem otc$/i, level: 1 })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Buat redeem OTC' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Buat mint OTC' })).toHaveCount(0)
    })

    test('Mint lists only mint OTC, action group on top with "x dari y" signatures', async ({ page }) => {
      const urls: URL[] = []
      page.on('request', (r) => {
        const u = new URL(r.url())
        if (u.pathname === '/api/v1/requests' && u.searchParams.get('limit') !== '1') urls.push(u)
      })
      await openOtc(page)
      await expect(actionGroup(page).getByText('1 dari 2 tanda tangan')).toBeVisible({ timeout: 10000 })
      await expect(page.getByRole('button', { name: /^Buka Redeem OTC/ })).toHaveCount(0)
      expect(urls.map((u) => u.searchParams.get('status'))).toEqual(
        expect.arrayContaining(['PENDING_APPROVAL,APPROVED', 'EXECUTED,IDR_TRANSFERRED,REJECTED']),
      )
      expect(urls.every((u) => u.searchParams.get('type') === 'mint')).toBe(true)
      // One vocabulary on screen: redeem, never burn.
      await expect(page.getByText(/\bburn\b/i)).toHaveCount(0)
    })

    test('Redeem lists only redeem OTC', async ({ page }) => {
      await openOtc(page, '/otc/redeem', /^redeem otc$/i)
      await expect(actionGroup(page).getByText('Siap dieksekusi')).toBeVisible({ timeout: 10000 })
      await expect(historyGroup(page).getByText('Rupiah sudah dikirim')).toBeVisible()
      await expect(page.getByRole('button', { name: /^Buka Mint OTC/ })).toHaveCount(0)
    })

    test('row click opens the centered modal with its own URL and the Safe action in the footer', async ({ page }) => {
      await openOtc(page)
      await page.getByRole('button', { name: /^Buka Mint OTC Robert Deon, 100,00 USDX/ }).first().click()
      await expect(page).toHaveURL(/\/otc\/mint\/req_mint_pending/)
      const modal = page.getByTestId('otc-modal')
      // The modal waits on the lazily loaded signing hook (wallet libraries) +
      // /multisig — in the dev server under parallel workers that can pass 5s.
      await expect(modal.getByText('Yang perlu kamu lakukan')).toBeVisible({ timeout: 15000 })
      await expect(modal.getByText('Marcus Thorne', { exact: true })).toBeVisible({ timeout: 15000 })
      // Hash Safe tiruan dihitung dari isi transaksinya (mock-api), jadi pagar
      // anti blind-sign lolos.
      await expect(modal.getByText(/tidak cocok dengan server/i)).toHaveCount(0)
      // No wallet in the test browser → the one action is to connect it.
      await expect(modal.getByRole('button', { name: 'Hubungkan wallet' })).toBeVisible()
      await expect(modal.getByRole('button', { name: /lainnya/i })).toBeVisible()
      // Footer action stays on screen while the body scrolls.
      await page.setViewportSize({ width: 1280, height: 560 })
      await modal.locator('.overflow-y-auto').first().evaluate((el) => el.scrollTo(0, el.scrollHeight))
      await expect(modal.getByRole('button', { name: 'Hubungkan wallet' })).toBeInViewport()
      await page.keyboard.press('Escape')
      await expect(page).toHaveURL(/\/otc\/mint$/)
    })

    test('search writes to the URL', async ({ page }) => {
      await openOtc(page)
      await page.getByRole('textbox', { name: 'Cari permintaan OTC' }).fill('robert')
      await expect(page).toHaveURL(/[?&]search=robert/)
    })
  })

  test.describe('negative', () => {
    test('STAFF does not see the OTC menu and gets the 403 page on /otc/mint', async ({ page }) => {
      await installMockApi(page, asStaff())
      await seedAuthenticatedSession(page, { ...ADMIN_STAFF, role: 'STAFF' })
      await page.goto('/otc/mint')
      await expect(page.getByRole('heading', { name: /tidak punya akses/i, level: 1 })).toBeVisible({ timeout: 15000 })
      await expect(page).toHaveURL(/\/otc\/mint$/)
      await expect(page.getByRole('button', { name: /^OTC/ })).toHaveCount(0)
    })
  })

  test.describe('edge cases', () => {
    test.beforeEach(async ({ page }) => {
      await installMockApi(page)
      await seedAuthenticatedSession(page)
    })

    test('the wallet window opened from the modal is clickable (non-modal dialog)', async ({ page }) => {
      // Sebelum Okt 2026 modal OTC adalah Dialog Radix MODAL: body pointer-events
      // dikunci, jendela RainbowKit muncul tapi tidak bisa diklik.
      await page.goto('/otc/mint/req_mint_pending')
      const modal = page.getByTestId('otc-modal')
      await modal.getByRole('button', { name: 'Hubungkan wallet' }).click({ timeout: 15000 })
      const rk = page.locator('[data-rk] [role="dialog"]')
      await expect(rk).toBeVisible({ timeout: 10000 })
      await rk.getByRole('button').filter({ hasText: 'MetaMask' }).click({ timeout: 5000 })
      await expect(modal).toBeVisible()
    })

    test('old OTC URLs redirect to the matching sub-menu', async ({ page }) => {
      await page.goto('/mint')
      await expect(page).toHaveURL(/\/otc\/mint$/, { timeout: 15000 })
      await page.goto('/otc?jenis=burn')
      await expect(page).toHaveURL(/\/otc\/redeem$/)
      await page.goto('/burn/req_burn_pending')
      await expect(page).toHaveURL(/\/otc\/redeem\/req_burn_pending/)
      await expect(page.getByTestId('otc-modal')).toBeVisible({ timeout: 15000 })
    })

    test('on a phone the modal fits the screen and closes back to the table', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 })
      await page.goto('/otc/mint/req_mint_pending')
      const modal = page.getByTestId('otc-modal')
      await expect(modal).toBeVisible({ timeout: 15000 })
      await expect(modal.getByRole('button', { name: 'Hubungkan wallet' })).toBeInViewport({ timeout: 15000 })
      await modal.getByRole('button', { name: /tutup dialog/i }).click()
      await expect(page).toHaveURL(/\/otc\/mint$/)
      await expect(page.locator('table')).toBeVisible({ timeout: 15000 })
    })
  })
})
