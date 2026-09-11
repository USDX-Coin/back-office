import { test, expect } from '@playwright/test'
import { installMockApi } from './support/mock-api'
import { seedAuthenticatedSession } from './support/auth'

// USDX-631 — backoffice "Rekening BNI" (sot/bni-integration.md § 16.4).
// Mock-backed via page.route (support/mock-api.ts § Rekening BNI). Covers the
// flows Vitest cannot see end to end: sidebar → page, three live cards, the
// pull → table → CSV download in a real browser, and the "belum
// dikonfigurasi" page state.

test.describe('USDX-631 Rekening BNI @e2e', () => {
  test.describe('positive', () => {
    test('sidebar Treasury → Rekening BNI renders three balance cards', async ({ page }) => {
      await installMockApi(page)
      await seedAuthenticatedSession(page)
      await page.goto('/dashboard')

      await page.getByRole('link', { name: /rekening bni/i }).click()
      await expect(page).toHaveURL(/\/bni-accounts/)
      await expect(page.getByRole('heading', { name: /rekening bni/i })).toBeVisible({ timeout: 15000 })

      const cards = page.locator('[data-testid^="bni-balance-card-"]')
      await expect(cards).toHaveCount(3)
      await expect(cards.nth(0)).toHaveAttribute('data-state', 'ok')
      await expect(page.getByTestId('bni-balance-card-TREASURY_USD')).toContainText('$12,500.75')
      await expect(page.getByTestId('bni-inquired-at-bank')).toHaveText('2026-09-09 14:30')
      await expect(page.getByTestId('bni-pulled-at')).toHaveText('2026-09-09 14:31:02 WIB')
    })

    test('pick account + Keluar + Tarik → DEBIT rows, then Unduh CSV downloads a BOM-prefixed file', async ({ page }) => {
      await installMockApi(page)
      await seedAuthenticatedSession(page)
      await page.goto('/bni-accounts')
      await expect(page.getByRole('heading', { name: /rekening bni/i })).toBeVisible({ timeout: 15000 })

      const pull = page.getByTestId('bni-statement-pull')
      await expect(pull).toBeDisabled()

      await page.getByRole('combobox', { name: 'Rekening' }).click()
      await page.getByRole('option', { name: /treasury np/i }).click()
      await page.getByRole('combobox', { name: 'Jenis mutasi' }).click()
      await page.getByRole('option', { name: 'Keluar' }).click()
      await page.getByRole('button', { name: '7 hari terakhir' }).click()

      const statementRequest = page.waitForRequest((r) => r.url().includes('/statement?'))
      await pull.click()
      const req = await statementRequest
      expect(req.url()).toContain('type=DEBIT')
      expect(req.url()).toContain('/bni-accounts/108098391/statement')

      await expect(page.getByTestId('bni-statement-applied')).toContainText('Treasury NP')
      await expect(page.getByTestId('bni-statement-applied')).toContainText('Keluar')
      await expect(page.getByTestId('bni-statement-row-count')).toContainText('4 baris')
      // Only "Keluar" pills in the table body.
      await expect(page.getByRole('table').getByText('Masuk')).toHaveCount(0)

      const download = page.waitForEvent('download')
      await page.getByTestId('bni-statement-export-csv').click()
      const file = await download
      expect(file.suggestedFilename()).toMatch(/^mutasi-bni-108098391-\d{8}-\d{8}-DEBIT\.csv$/)
      const stream = await file.createReadStream()
      const chunks: Buffer[] = []
      for await (const chunk of stream) chunks.push(Buffer.from(chunk))
      const bytes = Buffer.concat(chunks)
      expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
      const text = bytes.subarray(3).toString('utf8')
      expect(text.split('\n')[0]).toBe('Tanggal Posting,D/C,Nominal,Saldo,Deskripsi,No. Jurnal,Cabang')
      expect(text.split('\n')).toHaveLength(1 + 4)
    })
  })

  test.describe('negative', () => {
    test('empty account list → "belum dikonfigurasi" and no balances call', async ({ page }) => {
      await installMockApi(page, { bniAccounts: [] })
      await seedAuthenticatedSession(page)
      const balancesCalls: string[] = []
      page.on('request', (r) => {
        if (r.url().includes('/bni-accounts/balances')) balancesCalls.push(r.url())
      })
      await page.goto('/bni-accounts')
      await expect(page.getByTestId('bni-unconfigured')).toBeVisible({ timeout: 15000 })
      await expect(page.getByText('Rekening BNI belum dikonfigurasi')).toBeVisible()
      expect(balancesCalls).toHaveLength(0)
    })

    test('503 on balances → three "belum aktif" cards still labelled, Tarik ulang stays', async ({ page }) => {
      await installMockApi(page, {
        routes: {
          'GET /api/v1/bni-accounts/balances': async (route) => {
            await route.fulfill({
              status: 503,
              contentType: 'application/json',
              body: JSON.stringify({ status: 'error', metadata: null, data: null, error: { code: 'BNI_SERVICE_UNCONFIGURED', message: 'x' } }),
            })
            return true
          },
        },
      })
      await seedAuthenticatedSession(page)
      await page.goto('/bni-accounts')
      const cards = page.locator('[data-testid^="bni-balance-card-"]')
      await expect(cards).toHaveCount(3, { timeout: 15000 })
      for (let i = 0; i < 3; i++) {
        await expect(cards.nth(i)).toHaveAttribute('data-state', 'unavailable')
        await expect(cards.nth(i)).toContainText('belum aktif')
      }
      await expect(cards.nth(1)).toContainText('Treasury NP (Tabungan IDR)')
      await expect(page.getByTestId('bni-refetch-balances')).toBeEnabled()
    })
  })

  test.describe('edge cases', () => {
    test('a 33-day range disables Tarik with the 31-day message and sends nothing', async ({ page }) => {
      await installMockApi(page)
      await seedAuthenticatedSession(page)
      const statementCalls: string[] = []
      page.on('request', (r) => {
        if (r.url().includes('/statement?')) statementCalls.push(r.url())
      })
      await page.goto('/bni-accounts')
      await expect(page.getByRole('heading', { name: /rekening bni/i })).toBeVisible({ timeout: 15000 })

      await page.getByRole('combobox', { name: 'Rekening' }).click()
      await page.getByRole('option', { name: /collection/i }).click()
      await page.getByLabel('Tanggal mulai').fill('2026-08-01')
      await page.getByLabel('Tanggal akhir').fill('2026-09-02')

      await expect(page.getByRole('alert')).toContainText('31 hari')
      await expect(page.getByTestId('bni-statement-pull')).toBeDisabled()
      expect(statementCalls).toHaveLength(0)
    })
  })
})
