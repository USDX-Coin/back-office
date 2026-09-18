import { test, expect, type Page } from '@playwright/test'
import { installMockApi } from './support/mock-api'
import { seedAuthenticatedSession } from './support/auth'

// USDX-631 — backoffice "Rekening BNI" (sot/bni-integration.md § 16.4).
// Mock-backed via page.route (support/mock-api.ts § Rekening BNI). Covers the
// flows Vitest cannot see end to end: sidebar → page, three live cards, the
// pull → table → CSV download in a real browser, and the "belum
// dikonfigurasi" page state.
//
// USDX-692 (§ 16.8.8, D24): the statement is read from the USDX COPY — kolom
// Sumber, "direkam s/d", banner riwayat, penanda selisih, Segarkan dari bank.

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

      const refreshCalls: string[] = []
      page.on('request', (r) => {
        if (r.url().includes('/statement/refresh')) refreshCalls.push(r.url())
      })
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
      // USDX-692: kolom Sumber, header "direkam s/d … WIB" + pullId, ringkasan
      // menurut salinan — and Tarik alone never asks the bank to refresh.
      await expect(page.getByRole('columnheader', { name: 'Sumber' })).toBeVisible()
      await expect(page.getByRole('table').getByText('BANK')).toHaveCount(4)
      await expect(page.getByTestId('bni-statement-recorded-through')).toHaveText('direkam s/d 09/09/2026 14:30 WIB')
      await expect(page.getByTestId('bni-statement-applied')).toContainText('pull 019e2b00-0000-7000-8000-000000000202')
      await expect(page.getByTestId('bni-statement-summary')).toContainText('menurut salinan USDX')
      await expect(page.getByTestId('bni-statement-summary')).not.toContainText('Rentang posting')
      await expect(page.getByTestId('bni-statement-closing-balance')).toHaveText('Rp 504.500.000,00')
      await expect(page.getByTestId('bni-statement-history-notice')).toHaveCount(0)
      expect(refreshCalls).toHaveLength(0)

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
      expect(text.split('\n')[0]).toBe('Tanggal Posting,D/C,Nominal,Saldo,Deskripsi,No. Jurnal,Cabang,Sumber')
      expect(text.split('\n')[1]).toMatch(/,BANK$/)
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

// USDX-692 — sot/bni-integration.md § 16.8.8: the panel reads the USDX copy.
test.describe('USDX-692 Rekening BNI — mutasi dari salinan @e2e', () => {
  // Shared by the USDX-692 flows: pick Treasury NP, "Hari ini", Tarik.
  async function pullNpToday(page: Page) {
    await page.goto('/bni-accounts')
    await expect(page.getByRole('heading', { name: /rekening bni/i })).toBeVisible({ timeout: 15000 })
    await page.getByRole('combobox', { name: 'Rekening' }).click()
    await page.getByRole('option', { name: /treasury np/i }).click()
    await page.getByRole('button', { name: 'Hari ini' }).click()
    await page.getByTestId('bni-statement-pull').click()
    await expect(page.getByTestId('bni-statement-row-count')).toBeVisible()
  }

  test.describe('positive', () => {
    test('Segarkan dari bank → toast "2 mutasi baru terekam", table re-read with the applied params; again → "Tidak ada mutasi baru"', async ({ page }) => {
      await installMockApi(page)
      await seedAuthenticatedSession(page)
      await page.goto('/bni-accounts')
      await expect(page.getByRole('heading', { name: /rekening bni/i })).toBeVisible({ timeout: 15000 })
      const refresh = page.getByTestId('bni-statement-refresh')
      // idle: nothing pulled yet → nothing to refresh.
      await expect(refresh).toBeDisabled()

      await pullNpToday(page)
      await expect(page.getByTestId('bni-statement-row-count')).toContainText('12 baris')
      const statementUrls: string[] = []
      page.on('request', (r) => {
        if (r.url().includes('/statement?')) statementUrls.push(r.url())
      })

      const refreshRequest = page.waitForRequest((r) => r.url().includes('/statement/refresh'))
      await refresh.click()
      const req = await refreshRequest
      expect(req.method()).toBe('POST')
      expect(req.url()).toContain('/bni-accounts/108098391/statement/refresh')
      expect(req.postData()).toBeNull()

      await expect(page.getByText('2 mutasi baru terekam')).toBeVisible()
      await expect(page.getByTestId('bni-statement-row-count')).toContainText('14 baris')
      expect(statementUrls).toHaveLength(1)
      expect(statementUrls[0]).toContain('/bni-accounts/108098391/statement?')

      await expect(refresh).toBeEnabled()
      await refresh.click()
      await expect(page.getByText('Tidak ada mutasi baru')).toBeVisible()
    })

    test('history starting mid-range + two gaps → banner and two warnings ABOVE a table that still holds rows', async ({ page }) => {
      await installMockApi(page, {
        bniStatementCopy: {
          historyAvailableSince: '2099-01-01',
          gaps: [
            { kind: 'BETWEEN_ENTRIES', afterAt: '20260917134015', afterBalance: '10014440.00', beforeAt: '20260918091233', beforeBalance: '10024451.00', difference: '10011.00' },
            { kind: 'TAIL', afterAt: '20260918091233', afterBalance: '10024451.00', beforeAt: '202609181000', beforeBalance: '10000000.00', difference: null },
          ],
        },
      })
      await seedAuthenticatedSession(page)
      await pullNpToday(page)

      // `historyAvailableSince` lies after the whole range, but rows came back:
      // the banner sits above them instead of replacing them.
      await expect(page.getByTestId('bni-statement-history-notice')).toContainText(
        'Riwayat tersedia sejak 01/01/2099 — untuk tanggal sebelumnya lihat portal BNIDirect',
      )
      const gaps = page.getByTestId('bni-statement-gap')
      await expect(gaps).toHaveCount(2)
      await expect(gaps.nth(0)).toContainText('antara 2026-09-17 13:40:15 dan 2026-09-18 09:12:33 — selisih +Rp 10.011,00')
      await expect(gaps.nth(1)).toContainText('nominal tidak dapat dihitung')
      await expect(gaps.getByRole('button')).toHaveCount(0)
      await expect(page.getByTestId('bni-statement-row-count')).toContainText('12 baris')
    })
  })

  test.describe('negative', () => {
    test('refresh during bank EOD → the bank reason verbatim while the copy\'s table stays', async ({ page }) => {
      await installMockApi(page, {
        routes: {
          'POST /api/v1/bni-accounts/108098391/statement/refresh': async (route) => {
            await route.fulfill({
              status: 502,
              contentType: 'application/json',
              body: JSON.stringify({
                status: 'error',
                metadata: null,
                data: null,
                error: {
                  code: 'BNI_BANK_REJECTED',
                  message: 'Bank rejected the inquiry',
                  details: { bankReason: 'MW - EOD - Please try again at 01:00 AM' },
                },
              }),
            })
            return true
          },
        },
      })
      await seedAuthenticatedSession(page)
      await pullNpToday(page)

      await page.getByTestId('bni-statement-refresh').click()
      await expect(page.getByTestId('bni-statement-refresh-error')).toContainText('MW - EOD - Please try again at 01:00 AM')
      await expect(page.getByTestId('bni-statement-row-count')).toContainText('12 baris')
      await expect(page.getByRole('table').getByRole('row')).toHaveCount(1 + 10)
    })
  })

  test.describe('edge cases', () => {
    test('never recorded → "belum pernah direkam" + a dateless banner instead of "Tidak ada mutasi terekam"', async ({ page }) => {
      await installMockApi(page, {
        bniStatementCopy: { recordedThrough: null, historyAvailableSince: null },
        routes: {
          // An account the recorder never reached has no rows either.
          'GET /api/v1/bni-accounts/108098391/statement': async (route) => {
            const url = new URL(route.request().url())
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({
                status: 'success',
                metadata: null,
                data: {
                  pullId: '019e2b00-0000-7000-8000-000000000404',
                  pulledAt: '2026-09-09T07:32:10.000Z',
                  recordedThrough: null,
                  historyAvailableSince: null,
                  gaps: [],
                  applied: {
                    accountNo: '108098391',
                    role: 'TREASURY_NP',
                    label: 'Treasury NP (Tabungan IDR)',
                    startDate: url.searchParams.get('startDate'),
                    endDate: url.searchParams.get('endDate'),
                    type: 'ALL',
                  },
                  summary: { currency: 'IDR', rowCount: 0, anomalyRowCount: 0, anomalies: [] },
                  rows: [],
                },
              }),
            })
            return true
          },
        },
      })
      await seedAuthenticatedSession(page)
      await pullNpToday(page)

      await expect(page.getByTestId('bni-statement-recorded-through')).toHaveText('belum pernah direkam')
      await expect(page.getByTestId('bni-statement-history-notice')).toContainText('belum pernah direkam')
      await expect(page.getByText(/Tidak ada mutasi terekam/)).toHaveCount(0)
      await expect(page.locator('body')).not.toContainText('Invalid Date')
    })
  })
})
