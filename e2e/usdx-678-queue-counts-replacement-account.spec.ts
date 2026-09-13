import { test, expect } from '@playwright/test'
import { installMockApi, RINA_REPLACEMENT_ACCOUNTS } from './support/mock-api'
import { seedAuthenticatedSession } from './support/auth'

// USDX-678 — badge antrean dari `GET /api/v1/queue-counts` (sot/api/queue-counts.yaml) dan
// pemilih rekening pengganti di dialog Kirim ulang (sot/bni-integration.md § 17.5).
// Mock-backed via page.route (support/mock-api.ts).

const REASON = 'Rekening lama ditutup, kirim ke rekening lain'
const RINA_ORDER = '019f2a01-0662-7c31-9b2d-00000000e2e1'

test.describe('USDX-678 badge queue-counts + rekening pengganti @e2e', () => {
  test.describe('positive', () => {
    test('badges read queue-counts and no page pulls the PII lists with take=1', async ({ page }) => {
      const apiCalls: string[] = []
      page.on('request', (r) => {
        const url = new URL(r.url())
        if (url.pathname.startsWith('/api/v1/')) apiCalls.push(url.pathname + url.search)
      })
      await installMockApi(page)
      await seedAuthenticatedSession(page)
      await page.goto('/dashboard')

      await expect(page.getByTestId('nav-badge-payout-failures')).toHaveText('2', { timeout: 15000 })
      await page.getByRole('link', { name: /persetujuan pencairan/i }).click()
      await expect(page).toHaveURL(/\/redeem-approvals$/)

      expect(apiCalls).toContain('/api/v1/queue-counts')
      expect(apiCalls.filter((c) => /^\/api\/v1\/(payout-failures|redeem-approvals)\?(.*&)?take=1(&|$)/.test(c))).toEqual([])
    })

    test('detail → Kirim ulang to another saved account sends bankAccountId and the badge drops', async ({ page }) => {
      await installMockApi(page)
      await seedAuthenticatedSession(page)
      await page.goto(`/payout-failures/${RINA_ORDER}`)
      await expect(page.getByTestId('nav-badge-payout-failures')).toHaveText('2', { timeout: 15000 })

      const detail = page.getByRole('dialog', { name: /Pencairan bermasalah/ })
      await detail.getByRole('button', { name: 'Kirim ulang' }).click({ timeout: 15000 })
      const resolve = page.getByRole('dialog', { name: 'Kirim ulang payout' })

      await expect(resolve.getByRole('radio')).toHaveCount(3)
      await expect(resolve.getByRole('radio', { name: /8730012245/ })).toBeChecked()
      await resolve.getByRole('radio', { name: /1370012245001/ }).check()
      await expect(resolve.getByTestId('resolve-consequence')).toContainText('Mandiri · 1370012245001 · RINA SUSANTI')
      await resolve.getByLabel(/^Alasan/).fill(REASON)

      const resolveRequest = page.waitForRequest((r) => r.url().endsWith('/resolve') && r.method() === 'POST')
      await resolve.getByRole('button', { name: 'Kirim ulang' }).click()
      expect((await resolveRequest).postDataJSON()).toEqual({
        action: 'RESENT',
        reason: REASON,
        bankAccountId: RINA_REPLACEMENT_ACCOUNTS.mandiri,
      })

      await expect(resolve).toHaveCount(0)
      await expect(page.getByTestId('resolved-note')).toContainText('Dikirim ulang')
      await expect(detail.getByText('1370012245001')).toBeVisible()
      await expect(page.getByTestId('nav-badge-payout-failures')).toHaveText('1')
    })
  })

  test.describe('negative', () => {
    test('409 BANK_ACCOUNT_NOT_OWNED is explained inside the dialog', async ({ page }) => {
      await installMockApi(page, {
        routes: {
          [`POST /api/v1/payout-failures/${RINA_ORDER}/resolve`]: async (route) => {
            await route.fulfill({
              status: 409,
              contentType: 'application/json',
              body: JSON.stringify({
                status: 'error',
                metadata: null,
                data: null,
                error: { code: 'CONFLICT', message: 'BANK_ACCOUNT_NOT_OWNED' },
              }),
            })
            return true
          },
        },
      })
      await seedAuthenticatedSession(page)
      await page.goto(`/payout-failures/${RINA_ORDER}`)

      const detail = page.getByRole('dialog', { name: /Pencairan bermasalah/ })
      await detail.getByRole('button', { name: 'Kirim ulang' }).click({ timeout: 15000 })
      const resolve = page.getByRole('dialog', { name: 'Kirim ulang payout' })
      await resolve.getByRole('radio', { name: /0291884501/ }).check()
      await resolve.getByLabel(/^Alasan/).fill(REASON)
      await resolve.getByRole('button', { name: 'Kirim ulang' }).click()

      await expect(resolve.getByRole('alert')).toContainText('bukan milik nasabah pemilik order')
      await expect(resolve.getByRole('radio', { name: /0291884501/ })).toBeChecked()
    })
  })

  test.describe('edge cases', () => {
    test('zero counts render no badge', async ({ page }) => {
      let served = false
      await installMockApi(page, {
        routes: {
          'GET /api/v1/queue-counts': async (route) => {
            served = true
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({
                status: 'success',
                metadata: null,
                data: { payoutFailuresOpen: 0, redeemApprovalsOpen: 0 },
              }),
            })
            return true
          },
        },
      })
      await seedAuthenticatedSession(page)
      await page.goto('/dashboard')

      await expect(page.getByRole('link', { name: /pencairan bermasalah/i })).toBeVisible({ timeout: 15000 })
      await expect.poll(() => served).toBe(true)
      await expect(page.getByTestId('nav-badge-payout-failures')).toHaveCount(0)
      await expect(page.getByTestId('nav-badge-redeem-approvals')).toHaveCount(0)
    })
  })
})
