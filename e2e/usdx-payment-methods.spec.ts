import { test, expect, type Page } from '@playwright/test'
import { ADMIN_STAFF, installMockApi, type MockApiOptions } from './support/mock-api'
import { seedAuthenticatedSession } from './support/auth'

// Pengaturan ▸ Metode Pembayaran (⚠️ DRAF SOT PR #50, payment-methods.yaml).
// Seed = seed MSW `createInitialPaymentMethods` (16 metode): hanya Virtual
// Account NOBU (DurianPay) yang ditawarkan; Transfer BNI mati dan dijaga D23
// (server menjawab 409 PAYMENT_METHOD_PREREQUISITE_UNMET saat dinyalakan).

const NOBU = 'pm-VA_NOBU_DURIANPAY_SNAP'
const NOBU_ID = '019e5c10-0000-7000-8000-000000000002'
const BRI = 'pm-VA_BRI_DURIANPAY_SNAP'
const BNI_TRANSFER = 'pm-BANK_TRANSFER_BNI_BNI'
const QRIS = 'pm-QRIS_MOCK'
const REASON = 'Permintaan tim bisnis untuk uji pasar'

function asRole(role: 'DEVELOPER'): MockApiOptions {
  return {
    routes: {
      'GET /api/v1/auth/me': (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'success', metadata: null, data: { ...ADMIN_STAFF, role } }),
        })
        return true
      },
    },
  }
}

async function openPage(page: Page, opts: MockApiOptions = {}, role?: 'DEVELOPER') {
  const state = await installMockApi(page, opts)
  await seedAuthenticatedSession(page, role ? { ...ADMIN_STAFF, role } : ADMIN_STAFF)
  await page.goto('/settings/payment-methods')
  await expect(page.getByRole('heading', { name: 'Metode Pembayaran' })).toBeVisible({ timeout: 15000 })
  await expect(page.getByTestId(NOBU)).toBeVisible({ timeout: 15000 })
  return state
}

const list = (page: Page) => page.getByRole('list', { name: 'Daftar metode pembayaran' })

test.describe('Metode Pembayaran @e2e', () => {
  test.describe('positive', () => {
    test('should list every method with its status, fee, and limit', async ({ page }) => {
      await openPage(page)

      await expect(page.getByText('1 dari 16 metode sedang ditawarkan ke nasabah')).toBeVisible()
      await expect(list(page).getByRole('listitem')).toHaveCount(16)
      // Urutan server: NOBU paling atas.
      await expect(list(page).getByRole('listitem').first()).toHaveAttribute('data-testid', NOBU)

      const nobu = page.getByTestId(NOBU)
      await expect(nobu).toContainText('Ditawarkan')
      await expect(nobu).toContainText('Rp 4.000,00')
      await expect(nobu).toContainText('Tanpa batas')

      const bni = page.getByTestId(BNI_TRANSFER)
      await expect(bni).toContainText('Mati')
      await expect(bni).toContainText('Rp 10.000.000,00')
      await expect(bni).toContainText(/prasyarat keamanan BNI/i)

      const qris = page.getByTestId(QRIS)
      await expect(qris).toContainText('Menyala, belum ditawarkan')
      await expect(qris).toContainText('0,7% dari subtotal')
      await expect(qris).toContainText(/penyedianya tidak terpasang/i)
    })

    test('should turn a method on with a reason and record it in the change trail', async ({ page }) => {
      const state = await openPage(page)
      await expect(page.getByText('Belum ada perubahan sejak metode ini dibuat.')).toBeVisible()

      await page.getByTestId(BRI).getByRole('switch', { name: /nyalakan virtual account bri/i }).click()
      const dialog = page.getByRole('dialog', { name: 'Nyalakan Virtual Account BRI?' })
      await dialog.getByLabel('Alasan').fill(REASON)
      await dialog.getByRole('button', { name: 'Nyalakan' }).click()
      await expect(dialog).toBeHidden()

      expect(state.paymentMethodWrites).toHaveLength(1)
      expect(state.paymentMethodWrites[0]!.body).toEqual({
        enabled: true,
        reason: REASON,
        expectedUpdatedAt: '2026-10-09T03:00:00.000Z',
      })
      await expect(page.getByTestId(BRI)).toContainText('Ditawarkan')
      await expect(page.getByTestId(BRI)).toContainText('Diubah System Admin')
      await expect(page.getByText('2 dari 16 metode sedang ditawarkan ke nasabah')).toBeVisible()

      const trail = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Jejak perubahan' }) })
      await expect(trail).toContainText('Metode diubah — Virtual Account BRI')
      await expect(trail).toContainText(`“${REASON}”`)
    })

    test('should reorder methods and save the whole order in one request', async ({ page }) => {
      const state = await openPage(page)

      await page.getByRole('button', { name: 'Ubah urutan' }).click()
      await page.getByRole('button', { name: 'Turunkan Virtual Account NOBU (DurianPay)' }).click()
      await expect(list(page).getByRole('listitem').nth(1)).toHaveAttribute('data-testid', NOBU)

      await page.getByRole('button', { name: 'Simpan urutan' }).click()
      const dialog = page.getByRole('dialog', { name: 'Simpan urutan baru?' })
      await dialog.getByLabel('Alasan').fill(REASON)
      await dialog.getByRole('button', { name: 'Simpan urutan' }).click()
      await expect(dialog).toBeHidden()

      expect(state.paymentMethodWrites).toHaveLength(1)
      const put = state.paymentMethodWrites[0]!
      expect(put.method).toBe('PUT')
      const orderedIds = put.body.orderedIds as string[]
      expect(orderedIds).toHaveLength(16)
      expect(orderedIds[1]).toBe(NOBU_ID)
      expect(put.body.reason).toBe(REASON)

      // Mode urutan selesai; urutan dari server bertahan.
      await expect(page.getByRole('button', { name: 'Ubah urutan' })).toBeVisible()
      await expect(list(page).getByRole('listitem').nth(1)).toHaveAttribute('data-testid', NOBU)
      await expect(page.getByText(/Urutan diubah/)).toBeVisible()
    })

    test('should change fee and per-transaction limit', async ({ page }) => {
      const state = await openPage(page)

      await page.getByTestId(BRI).getByRole('button', { name: 'Ubah biaya' }).click()
      const dialog = page.getByRole('dialog', { name: 'Ubah biaya Virtual Account BRI' })
      await dialog.getByLabel('Biaya (Rp)').fill('5000')
      await dialog.getByLabel('Batas per transaksi (Rp)').fill('50000000')
      await dialog.getByLabel('Alasan').fill(REASON)
      await dialog.getByRole('button', { name: 'Simpan' }).click()
      await expect(dialog).toBeHidden()

      expect(state.paymentMethodWrites.map((w) => w.body)).toEqual([
        {
          reason: REASON,
          expectedUpdatedAt: '2026-10-09T03:00:00.000Z',
          feeType: 'FLAT_IDR',
          feeValue: '5000',
          maxAmountIdr: '50000000.00',
        },
      ])
      await expect(page.getByTestId(BRI)).toContainText('Rp 5.000,00')
      await expect(page.getByTestId(BRI)).toContainText('Rp 50.000.000,00')
    })
  })

  test.describe('negative', () => {
    test('should not send a toggle whose reason is shorter than 10 characters', async ({ page }) => {
      const state = await openPage(page)

      await page.getByTestId(BRI).getByRole('switch').click()
      const dialog = page.getByRole('dialog', { name: 'Nyalakan Virtual Account BRI?' })
      await dialog.getByLabel('Alasan').fill('pendek')
      await dialog.getByRole('button', { name: 'Nyalakan' }).click()

      await expect(dialog.getByText('Alasan minimal 10 karakter.')).toBeVisible()
      await expect(dialog).toBeVisible()
      expect(state.paymentMethodWrites).toHaveLength(0)
      await expect(page.getByTestId(BRI)).toContainText('Mati')
    })

    test('should show the BNI transfer 409 guard as a plain sentence inside the dialog', async ({ page }) => {
      const state = await openPage(page)

      await page.getByTestId(BNI_TRANSFER).getByRole('switch').click()
      const dialog = page.getByRole('dialog', { name: 'Nyalakan Transfer bank BNI?' })
      await expect(dialog).toContainText(/belum akan ditawarkan ke nasabah sampai syaratnya terpenuhi/i)
      await dialog.getByLabel('Alasan').fill(REASON)
      await dialog.getByRole('button', { name: 'Nyalakan' }).click()

      const alert = dialog.getByRole('alert')
      await expect(alert).toContainText(
        'Transfer BNI belum bisa dinyalakan: prasyarat keamanan BNI (allowlist IP, D23) belum dinyatakan terpenuhi oleh devops.',
      )
      // Kode server hanya di "Detail teknis" yang tertutup — bukan kalimat utamanya.
      await expect(alert.getByText('PAYMENT_METHOD_PREREQUISITE_UNMET', { exact: false })).toBeHidden()
      await expect(dialog).toBeVisible()
      expect(state.paymentMethodWrites).toHaveLength(1)

      await dialog.getByRole('button', { name: 'Batal' }).click()
      await expect(page.getByTestId(BNI_TRANSFER)).toContainText('Mati')
    })

    test('should reject an empty or over-policy BNI transfer limit before reaching the server', async ({ page }) => {
      const state = await openPage(page)

      await page.getByTestId(BNI_TRANSFER).getByRole('button', { name: 'Ubah biaya' }).click()
      const dialog = page.getByRole('dialog', { name: 'Ubah biaya Transfer bank BNI' })
      await dialog.getByLabel('Alasan').fill(REASON)

      await dialog.getByLabel('Batas per transaksi (Rp)').fill('')
      await dialog.getByRole('button', { name: 'Simpan' }).click()
      await expect(dialog.getByText('Transfer BNI wajib punya batas per transaksi.')).toBeVisible()

      await dialog.getByLabel('Batas per transaksi (Rp)').fill('10000001')
      await expect(dialog.getByText(/tidak boleh melebihi Rp 10\.000\.000 per transaksi/)).toBeVisible()
      await dialog.getByRole('button', { name: 'Simpan' }).click()

      await expect(dialog).toBeVisible()
      expect(state.paymentMethodWrites).toHaveLength(0)
    })

    test('should let DEVELOPER read only, without the change trail', async ({ page }) => {
      const state = await openPage(page, asRole('DEVELOPER'), 'DEVELOPER')

      await expect(page.getByText('Hanya Admin yang bisa mengubah.')).toBeVisible()
      await expect(page.getByTestId(NOBU).getByRole('switch')).toBeDisabled()
      await expect(page.getByRole('button', { name: 'Ubah biaya' })).toHaveCount(0)
      await expect(page.getByRole('button', { name: 'Ubah urutan' })).toHaveCount(0)
      await expect(page.getByRole('heading', { name: 'Jejak perubahan' })).toHaveCount(0)
      expect(state.activityLogRequests).toBe(0)
    })
  })

  test.describe('edge cases', () => {
    test('should require an extra acknowledgement to switch off the last offered method', async ({ page }) => {
      const state = await openPage(page)

      await page.getByTestId(NOBU).getByRole('switch').click()
      const dialog = page.getByRole('dialog', { name: 'Matikan Virtual Account NOBU?' })
      const ack = dialog.getByRole('checkbox')
      await expect(dialog).toContainText('Ini metode terakhir yang ditawarkan.')
      await dialog.getByLabel('Alasan').fill(REASON)
      await dialog.getByRole('button', { name: 'Matikan' }).click()
      await expect(dialog).toBeVisible()
      expect(state.paymentMethodWrites).toHaveLength(0)

      await ack.check()
      await dialog.getByRole('button', { name: 'Matikan' }).click()
      await expect(dialog).toBeHidden()
      expect(state.paymentMethodWrites[0]!.body).toMatchObject({ enabled: false, reason: REASON })
      await expect(page.getByText('0 dari 16 metode sedang ditawarkan ke nasabah')).toBeVisible()
    })

    test('should not ask for an acknowledgement when another method is still offered', async ({ page }) => {
      const state = await openPage(page)
      state.paymentMethods.find((m) => m.code === 'VA_BRI_DURIANPAY_SNAP')!.enabled = true
      await page.reload()
      await expect(page.getByText('2 dari 16 metode sedang ditawarkan ke nasabah')).toBeVisible({ timeout: 15000 })

      await page.getByTestId(NOBU).getByRole('switch').click()
      const dialog = page.getByRole('dialog', { name: 'Matikan Virtual Account NOBU?' })
      await expect(dialog.getByRole('checkbox')).toHaveCount(0)
    })

    test('should keep reorder bounds and discard a cancelled draft order', async ({ page }) => {
      const state = await openPage(page)

      await page.getByRole('button', { name: 'Ubah urutan' }).click()
      await expect(page.getByRole('button', { name: 'Simpan urutan' })).toBeDisabled()
      await expect(page.getByRole('button', { name: 'Naikkan Virtual Account NOBU (DurianPay)' })).toBeDisabled()
      await expect(page.getByRole('button', { name: /^Turunkan QRIS/ })).toBeDisabled()

      await page.getByRole('button', { name: 'Turunkan Virtual Account NOBU (DurianPay)' }).click()
      await expect(page.getByRole('button', { name: 'Simpan urutan' })).toBeEnabled()
      await page.getByRole('button', { name: 'Batal' }).click()

      await expect(list(page).getByRole('listitem').first()).toHaveAttribute('data-testid', NOBU)
      await expect(page.getByRole('button', { name: 'Ubah urutan' })).toBeVisible()
      expect(state.paymentMethodWrites).toHaveLength(0)
    })

    test('should keep Simpan disabled while nothing in the fee form has changed', async ({ page }) => {
      await openPage(page)

      await page.getByTestId(NOBU).getByRole('button', { name: 'Ubah biaya' }).click()
      const dialog = page.getByRole('dialog', { name: 'Ubah biaya Virtual Account NOBU' })
      await dialog.getByLabel('Alasan').fill(REASON)
      await expect(dialog.getByRole('button', { name: 'Simpan' })).toBeDisabled()
      await dialog.getByLabel('Biaya (Rp)').fill('4500')
      await expect(dialog.getByRole('button', { name: 'Simpan' })).toBeEnabled()
    })
  })
})
