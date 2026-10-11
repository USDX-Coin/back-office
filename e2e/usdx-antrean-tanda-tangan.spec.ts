import { test, expect, type Page } from '@playwright/test'
import { installMockApi } from './support/mock-api'
import { seedAuthenticatedSession } from './support/auth'

// Antrean Tanda Tangan (PM Okt 2026, "ops fokus ke transaksi, bukan on-chain"):
// detail = modal tengah (pola OTC/Transaksi), di depan hanya transaksi dalam
// kata; alamat/hash/calldata/nonce di Detail teknis. Jendela wallet RainbowKit
// harus tetap bisa diklik dari modal ini.

async function openQueue(page: Page, path = '/multisig') {
  await installMockApi(page)
  await seedAuthenticatedSession(page)
  await page.goto(path)
  await expect(page.getByRole('heading', { name: 'Antrean Tanda Tangan', level: 1 })).toBeVisible({ timeout: 15000 })
}

const frontText = (page: Page) =>
  page.getByTestId('multisig-modal').evaluate((el) => {
    const c = el.cloneNode(true) as HTMLElement
    c.querySelector('[data-testid="detail-teknis"]')?.remove()
    return c.textContent ?? ''
  })

test.describe('Antrean Tanda Tangan @e2e', () => {
  test.describe('positive', () => {
    test('should list activities in words and open a centered modal with signers by name', async ({ page }) => {
      await openQueue(page)
      const table = page.locator('table')
      await expect(table.getByText('Mint 100 USDX')).toBeVisible({ timeout: 15000 })
      await expect(table.getByText(/^MINT$|^BURN$/)).toHaveCount(0)
      await expect(table.getByText('Safe Staf').first()).toBeVisible()
      await expect(table).not.toContainText('0x')

      await table.getByText('Mint 100 USDX').click()
      await expect(page).toHaveURL(/\/multisig\/stx_mint_pending/)
      const modal = page.getByTestId('multisig-modal')
      await expect(modal.getByRole('heading', { name: 'Mint 100 USDX' })).toBeVisible({ timeout: 15000 })
      await expect(page.getByTestId('multisig-status-sentence')).toHaveText(/Menunggu 1 tanda tangan lagi/)
      const signers = page.getByTestId('multisig-signers')
      await expect(signers).toContainText('Marcus Thorne')
      await expect(signers).toContainText('Linda Chen')
      await expect(signers).toContainText('Belum')
      expect(await frontText(page)).not.toMatch(/0x[0-9a-fA-F]{6,}/)
      // Format waktu seragam: `12 Sep 2026, 08:00:09`, WIB hanya di label.
      const front = await frontText(page)
      expect(front).toMatch(/Diajukan \(WIB\)\d{1,2} [A-Z][a-z]{2} \d{4}, \d{2}:\d{2}:\d{2}/)
      expect(front).not.toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}|\d{2}\.\d{2}\.\d{2}/)
      await expect(modal.getByRole('button', { name: 'Hubungkan wallet' })).toBeInViewport()

      // Modal di tengah layar.
      const box = (await modal.boundingBox())!
      const vw = page.viewportSize()!.width
      expect(Math.abs(box.x + box.width / 2 - vw / 2)).toBeLessThan(4)
    })

    test('should keep the wallet window clickable from the modal', async ({ page }) => {
      await openQueue(page, '/multisig/stx_mint_pending')
      const modal = page.getByTestId('multisig-modal')
      await modal.getByRole('button', { name: 'Hubungkan wallet' }).click({ timeout: 15000 })
      const rk = page.locator('[data-rk] [role="dialog"]')
      await expect(rk).toBeVisible({ timeout: 10000 })
      // Klik nyata di dalam jendela wallet (bukan sekadar terlihat).
      await rk.getByRole('button').filter({ hasText: 'MetaMask' }).click({ timeout: 5000 })
      await expect(modal).toBeVisible()
    })
  })

  test.describe('negative', () => {
    test('should keep raw on-chain values folded in Detail teknis, not deleted', async ({ page }) => {
      await openQueue(page, '/multisig/stx_mint_pending')
      const teknis = page.getByTestId('detail-teknis')
      await expect(teknis).toHaveAttribute('data-state', 'closed', { timeout: 15000 })
      await teknis.getByRole('button', { name: /detail teknis/i }).click()
      await expect(teknis).toContainText('Nonce')
      await expect(teknis).toContainText('Alamat Safe')
      await expect(teknis).toContainText('0x')
    })
  })

  test.describe('edge cases', () => {
    test('should move between rows with ↑/↓ and close back to the list with Esc', async ({ page }) => {
      await openQueue(page, '/multisig/stx_mint_pending')
      const modal = page.getByTestId('multisig-modal')
      await expect(page.getByTestId('record-modal-position')).toHaveText('1 dari 2', { timeout: 15000 })
      await page.keyboard.press('ArrowDown')
      await expect(page).toHaveURL(/\/multisig\/stx_burn_pending/)
      await expect(modal.getByRole('heading', { name: 'Burn 10 USDX' })).toBeVisible()
      await expect(modal.getByRole('button', { name: 'Hubungkan wallet' })).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(page).toHaveURL(/\/multisig$/)
      await expect(modal).toHaveCount(0)
    })

    test('should fit a 390px phone screen with the footer button visible', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 })
      await openQueue(page, '/multisig/stx_mint_pending')
      await expect(page.getByTestId('multisig-modal').getByRole('button', { name: 'Hubungkan wallet' })).toBeInViewport({ timeout: 15000 })
    })
  })
})
