import { test, expect, type Page } from '@playwright/test'
import { DASHBOARD_STATS, installMockApi, type MockRateInfo } from './support/mock-api'
import { seedAuthenticatedSession } from './support/auth'

// USDX-778 — Settings → Rate mode kurs BNI + batas pergeseran X (D28,
// `sot/bni-integration.md` §20, `sot/api/rate.yaml`, `sot/api/dashboard.yaml`).
// Mock-backed (support/mock-api.ts): kurs BNI sellRate 18.140 / buyRate 17.773.

const BNI_UNAVAILABLE: Partial<MockRateInfo> = {
  mode: 'BNI',
  baseRate: null,
  baseSellRate: null,
  effectiveBuyRate: null,
  effectiveSellRate: null,
  gatewayBuyRate: null,
  bniRateMaxDeviationPct: '3.0000',
}

function captureRatePosts(page: Page) {
  const posts: Record<string, unknown>[] = []
  page.on('request', (req) => {
    if (req.method() === 'POST' && new URL(req.url()).pathname === '/api/v1/rate') posts.push(req.postDataJSON())
  })
  return posts
}

async function openRateForm(page: Page) {
  await page.goto('/settings/rate')
  await page.getByRole('button', { name: 'Ubah kurs' }).click({ timeout: 15000 })
  await expect(page.getByRole('textbox', { name: /batas pergeseran kurs bni/i })).toBeVisible()
}

async function chooseBni(page: Page) {
  await page.getByRole('combobox', { name: /mode/i }).click()
  await page.getByRole('option', { name: /^kurs bni \(fx-get rate\)/i }).click()
}

async function setX(page: Page, value: string) {
  await page.getByRole('textbox', { name: /batas pergeseran kurs bni/i }).fill(value)
}

async function reviewAndConfirm(page: Page) {
  await page.getByRole('button', { name: /tinjau dan ubah/i }).click()
  const confirm = page.getByRole('dialog', { name: /ubah kurs yang berlaku\?/i })
  await confirm.getByRole('button', { name: /ya, ubah kurs/i }).click()
  return confirm
}

test.describe('USDX-778 mode kurs BNI @e2e', () => {
  test.describe('positive', () => {
    test('AC — admin picks BNI + X 3, confirms (calibration reminder), card shows BNI bases + raw numbers', async ({ page }) => {
      const posts = captureRatePosts(page)
      await installMockApi(page)
      await seedAuthenticatedSession(page)
      await openRateForm(page)

      await chooseBni(page)
      await expect(page.getByLabel(/kurs manual/i)).toHaveCount(0)
      await setX(page, '3')
      await page.getByRole('button', { name: /tinjau dan ubah/i }).click()
      const confirm = page.getByRole('dialog', { name: /ubah kurs yang berlaku\?/i })
      await expect(confirm.getByTestId('rate-bni-calibration-reminder')).toContainText(/spread beli, dan spread\s+jual/)
      await confirm.getByRole('button', { name: /ya, ubah kurs/i }).click()
      await expect(page.getByRole('dialog')).toHaveCount(0)

      expect(posts).toHaveLength(1)
      expect(posts[0]).toMatchObject({ mode: 'BNI', bniRateMaxDeviationPct: '3' })
      expect(posts[0]).not.toHaveProperty('manualRate')

      // Sumber kurs = mode aktif (baris "Mode" kartu).
      await expect(page.locator('dd', { hasText: /^Kurs BNI \(FX-Get Rate\)$/ })).toBeVisible()
      await expect(page.getByLabel('kurs dasar beli')).toHaveText('18.140,00 IDR/USD')
      await expect(page.getByLabel('kurs dasar jual')).toHaveText('17.773,00 IDR/USD')
      await expect(page.getByLabel('kurs jual BNI')).toHaveText('18.140,00 IDR/USD')
      await expect(page.getByLabel('kurs beli BNI')).toHaveText('17.773,00 IDR/USD')
      await expect(page.getByLabel('jam ambil kurs BNI')).toHaveText('29 Okt 2026, 10:00:00')
      await expect(page.getByLabel('batas pergeseran kurs BNI')).toHaveText('3%')
    })

    test('AC — mode already BNI + BNI_DEVIATION: banner with recovery steps; raising X saves (201) and shows', async ({ page }) => {
      await installMockApi(page, {
        rate: { ...BNI_UNAVAILABLE, rateUnavailableReason: 'BNI_DEVIATION' },
        bniFxUnavailable: 'BNI_DEVIATION',
      })
      await seedAuthenticatedSession(page)
      await page.goto('/settings/rate')

      const banner = page.getByTestId('rate-unavailable-banner')
      await expect(banner).toContainText('Kurs BNI ditolak pengaman pergeseran', { timeout: 15000 })
      await expect(banner.getByRole('listitem')).toHaveCount(4)

      await page.getByRole('button', { name: 'Ubah kurs' }).click()
      await setX(page, '6')
      const statuses: number[] = []
      page.on('response', (res) => {
        if (res.request().method() === 'POST' && new URL(res.url()).pathname === '/api/v1/rate') statuses.push(res.status())
      })
      await reviewAndConfirm(page)
      await expect(page.getByRole('dialog')).toHaveCount(0)
      expect(statuses).toEqual([201])
      await expect(page.getByLabel('batas pergeseran kurs BNI')).toHaveText('6%')
    })
  })

  test.describe('negative', () => {
    test('AC — switching to BNI answered 422 BNI_DEVIATION: inline advice, form kept, mode stays old', async ({ page }) => {
      await installMockApi(page, { bniFxUnavailable: 'BNI_DEVIATION' })
      await seedAuthenticatedSession(page)
      await openRateForm(page)
      await chooseBni(page)
      await setX(page, '3')
      await reviewAndConfirm(page)

      await expect(
        page.getByText('Kurs BNI ditolak pengaman pergeseran — naikkan batas pergeseran (X) lalu coba lagi dalam ±2 menit.'),
      ).toBeVisible()
      const form = page.getByRole('dialog', { name: /^ubah kurs$/i })
      await expect(form.getByRole('combobox', { name: /mode/i })).toContainText(/kurs bni/i)
      await expect(form.getByRole('textbox', { name: /batas pergeseran kurs bni/i })).toHaveValue('3')

      await form.getByRole('button', { name: /batal/i }).click()
      await expect(page.getByText('Manual', { exact: true })).toBeVisible()
    })

    test('AC — 422 with another reason: "cannot be fetched" message', async ({ page }) => {
      await installMockApi(page, { bniFxUnavailable: 'BNI_UNREACHABLE' })
      await seedAuthenticatedSession(page)
      await openRateForm(page)
      await chooseBni(page)
      await reviewAndConfirm(page)
      await expect(page.getByText('Kurs BNI sedang tidak bisa diambil, mode BNI belum bisa dipilih.')).toBeVisible()
    })

    test('AC — X of 0, negative or non-number is refused before sending', async ({ page }) => {
      const posts = captureRatePosts(page)
      await installMockApi(page)
      await seedAuthenticatedSession(page)
      await openRateForm(page)
      await chooseBni(page)
      for (const [value, message] of [
        ['0', /lebih besar dari 0/],
        ['-2', /tidak boleh negatif/],
        ['tiga', /titik desimal/],
      ] as const) {
        await setX(page, value)
        await page.getByRole('button', { name: /tinjau dan ubah/i }).click()
        await expect(page.getByText(message)).toBeVisible()
        await expect(page.getByRole('dialog', { name: /ubah kurs yang berlaku\?/i })).toHaveCount(0)
      }
      expect(posts).toHaveLength(0)
    })
  })

  test.describe('edge cases', () => {
    test('AC — BNI_UNREACHABLE: banner shown, rate fields "—", page does not error', async ({ page }) => {
      await installMockApi(page, { rate: { ...BNI_UNAVAILABLE, rateUnavailableReason: 'BNI_UNREACHABLE' } })
      await seedAuthenticatedSession(page)
      await page.goto('/settings/rate')
      await expect(page.getByTestId('rate-unavailable-banner')).toContainText(
        'Kurs BNI tidak bisa diambil — mint/redeem sedang ditolak',
        { timeout: 15000 },
      )
      for (const label of ['kurs dasar beli', 'kurs dasar jual', 'kurs beli berlaku', 'kurs jual berlaku', 'kurs jual BNI']) {
        await expect(page.getByLabel(label, { exact: true })).toHaveText('—')
      }
      await expect(page.getByText(/NaN/)).toHaveCount(0)
      await expect(page.getByRole('button', { name: 'Ubah kurs' })).toBeEnabled()
    })

    test('AC — MANUAL looks as before: no banner, no BNI block, only the X field is BNI-specific', async ({ page }) => {
      await installMockApi(page)
      await seedAuthenticatedSession(page)
      await page.goto('/settings/rate')
      await expect(page.getByLabel('kurs dasar beli')).toHaveText('16.250,00 IDR/USD', { timeout: 15000 })
      await expect(page.getByLabel('kurs dasar jual')).toHaveText('16.250,00 IDR/USD')
      await expect(page.getByTestId('rate-unavailable-banner')).toHaveCount(0)
      await expect(page.getByLabel('kurs jual BNI')).toHaveCount(0)
      await page.getByRole('button', { name: 'Ubah kurs' }).click()
      await expect(page.getByLabel(/kurs manual/i)).toBeVisible()
      await expect(page.getByRole('textbox', { name: /batas pergeseran kurs bni/i })).toHaveValue('3')
    })

    test('AC — dashboard with currentRate null: rate "—" + "Kurs tidak tersedia", other figures shown', async ({ page }) => {
      await installMockApi(page, {
        routes: {
          'GET /api/v1/dashboard/stats': (route) =>
            route
              .fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ status: 'success', metadata: null, data: { ...DASHBOARD_STATS, currentRate: null } }),
              })
              .then(() => true),
        },
      })
      await seedAuthenticatedSession(page)
      await page.goto('/ringkasan')
      const row = page.getByTestId('ringkasan-kurs')
      await expect(row).toContainText('Kurs tidak tersedia', { timeout: 15000 })
      await expect(row).toContainText('—')
      await expect(page.getByTestId('ringkasan-pasokan')).toHaveText('1.000.000,00USDX')
      await expect(page.getByTestId('ringkasan-token')).toContainText('750.000,00 USDX')
      await expect(page.getByTestId('ringkasan-otc')).toContainText('1.200.000,00 USDX')
    })
  })
})
