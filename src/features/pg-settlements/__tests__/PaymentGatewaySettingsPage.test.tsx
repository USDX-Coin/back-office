import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { server } from '@/mocks/server'
import { resetMockData } from '@/mocks/handlers'
import PaymentGatewaySettingsPage from '@/features/pg-settlements/PaymentGatewaySettingsPage'
import { renderWithProviders } from '@/test/test-utils'

// D29 / USDX-792 — Pengaturan → Payment Gateway (`/api/v1/pg-settlement-settings`).

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  server.events.removeAllListeners()
  resetMockData()
})
afterAll(() => server.close())

const setup = (staffId = 'stf_2') =>
  renderWithProviders(<PaymentGatewaySettingsPage />, { initialEntries: ['/settings/payment-gateway'], staffId })

describe('PaymentGatewaySettingsPage @ USDX-792', () => {
  describe('positive', () => {
    test('should show the current mode, sender pattern and prefunding limit', async () => {
      setup()
      const card = await screen.findByTestId('pg-settings-card')
      expect(await within(card).findByText(/NET — dikirim sudah dipotong biaya/)).toBeInTheDocument()
      expect(within(card).getByText('“DURIANPAY”')).toBeInTheDocument()
      expect(within(card).getByText('Rp 200.000.000,00')).toBeInTheDocument()
    })

    test('should save with a reason and send the contract body', async () => {
      const user = userEvent.setup()
      const bodies: unknown[] = []
      server.events.on('request:start', async ({ request }) => {
        if (request.method === 'PUT') bodies.push(await request.clone().json())
      })
      setup()
      await user.click(await screen.findByRole('button', { name: 'Ubah pengaturan' }))
      const dialog = await screen.findByRole('dialog', { name: 'Ubah pengaturan payment gateway' })
      await user.click(within(dialog).getByRole('radio', { name: /GROSS/ }))
      await user.clear(within(dialog).getByLabelText(/Batas saldo prefunding/))
      await user.click(within(dialog).getByRole('button', { name: 'Simpan' }))
      // Tanpa alasan → ditolak sebelum dikirim.
      expect(await within(dialog).findByText('Alasan minimal 10 karakter.')).toBeInTheDocument()
      expect(bodies).toHaveLength(0)
      await user.type(within(dialog).getByLabelText(/^Alasan/), 'Kontrak Durianpay ternyata GROSS')
      await user.click(within(dialog).getByRole('button', { name: 'Simpan' }))
      await waitFor(() =>
        expect(bodies).toEqual([{ mode: 'GROSS', senderPattern: 'DURIANPAY', prefundingLowIdr: null, reason: 'Kontrak Durianpay ternyata GROSS' }]),
      )
      expect(await screen.findByText('Tidak ada peringatan')).toBeInTheDocument()
    })
  })

  describe('negative', () => {
    test('should reject an invalid amount and empty pattern before sending', async () => {
      const user = userEvent.setup()
      const bodies: unknown[] = []
      server.events.on('request:start', ({ request }) => {
        if (request.method === 'PUT') bodies.push(request.url)
      })
      setup()
      await user.click(await screen.findByRole('button', { name: 'Ubah pengaturan' }))
      const dialog = await screen.findByRole('dialog', { name: 'Ubah pengaturan payment gateway' })
      await user.clear(within(dialog).getByLabelText(/Pola pengirim/))
      await user.clear(within(dialog).getByLabelText(/Batas saldo prefunding/))
      await user.type(within(dialog).getByLabelText(/Batas saldo prefunding/), '1.000.000')
      await user.type(within(dialog).getByLabelText(/^Alasan/), 'alasan yang cukup panjang')
      await user.click(within(dialog).getByRole('button', { name: 'Simpan' }))
      expect(await within(dialog).findByText(/Pola pengirim wajib diisi/)).toBeInTheDocument()
      expect(within(dialog).getByText(/tanpa titik ribuan/)).toBeInTheDocument()
      expect(bodies).toHaveLength(0)
    })

    test('should be read-only for DEVELOPER', async () => {
      setup('stf_3')
      await screen.findByTestId('pg-settings-card')
      expect(screen.queryByRole('button', { name: 'Ubah pengaturan' })).not.toBeInTheDocument()
      expect(screen.getByText('Hanya Manager dan Admin yang bisa mengubah.')).toBeInTheDocument()
    })
  })
})
