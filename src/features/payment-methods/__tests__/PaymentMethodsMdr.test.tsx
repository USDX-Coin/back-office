import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { server } from '@/mocks/server'
import { findStaffByEmail, resetMockData } from '@/mocks/handlers'
import { renderWithProviders } from '@/test/test-utils'
import PaymentMethodsPage from '../PaymentMethodsPage'

// D29 / USDX-792 — tarif kontrak PG (`pgMdrType`/`pgMdrValue`) + `requiresFxSwap`
// di Metode Pembayaran (`payment-methods.yaml`). Seed: VA NOBU FLAT 4000, VA lain kosong.

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  server.events.removeAllListeners()
  resetMockData()
})
afterAll(() => server.close())

const REASON = 'Tarif kontrak Durianpay per November'
const renderPage = () => renderWithProviders(<PaymentMethodsPage />, { staffId: findStaffByEmail('demo@usdx.io')!.id })

describe('Metode Pembayaran — tarif kontrak PG (D29)', () => {
  describe('positive', () => {
    test('should show the contract rate and whether the method needs a swap', async () => {
      renderPage()
      expect(await screen.findByTestId('pm-mdr-VA_NOBU_DURIANPAY_SNAP')).toHaveTextContent('Rp 4.000,00')
      expect(screen.getByTestId('pm-swap-VA_NOBU_DURIANPAY_SNAP')).toHaveTextContent('Butuh swap IDR→USD')
      expect(screen.getByTestId('pm-swap-BANK_TRANSFER_BNI_BNI')).toHaveTextContent('Tanpa swap')
      expect(screen.getByTestId('pm-mdr-VA_BNI_DURIANPAY_SNAP')).toHaveTextContent('Belum diisi — wajib')
    })

    test('should send pgMdrType + pgMdrValue together with the reason', async () => {
      const user = userEvent.setup()
      const bodies: Record<string, unknown>[] = []
      server.events.on('request:start', async ({ request }) => {
        if (request.method === 'PATCH') bodies.push((await request.clone().json()) as Record<string, unknown>)
      })
      renderPage()
      await user.click(within(await screen.findByTestId('pm-VA_NOBU_DURIANPAY_SNAP')).getByRole('button', { name: 'Ubah biaya' }))
      const dialog = await screen.findByRole('dialog')
      const mdr = within(dialog).getByLabelText(/tarif kontrak \(rp\)/i)
      await user.clear(mdr)
      await user.type(mdr, '3500')
      await user.type(within(dialog).getByLabelText(/alasan/i), REASON)
      await user.click(within(dialog).getByRole('button', { name: 'Simpan' }))
      await waitFor(() => expect(bodies).toHaveLength(1))
      expect(bodies[0]).toMatchObject({ pgMdrType: 'FLAT_IDR', pgMdrValue: '3500.00', reason: REASON })
      expect(bodies[0]).not.toHaveProperty('feeType')
      expect(await screen.findByTestId('pm-mdr-VA_NOBU_DURIANPAY_SNAP')).toHaveTextContent('Rp 3.500,00')
    })
  })

  describe('negative', () => {
    test('should warn — not block — when a swap method has no contract rate yet', async () => {
      const user = userEvent.setup()
      const bodies: Record<string, unknown>[] = []
      server.events.on('request:start', async ({ request }) => {
        if (request.method === 'PATCH') bodies.push((await request.clone().json()) as Record<string, unknown>)
      })
      renderPage()
      await user.click(within(await screen.findByTestId('pm-VA_BNI_DURIANPAY_SNAP')).getByRole('button', { name: 'Ubah biaya' }))
      const dialog = await screen.findByRole('dialog')
      expect(within(dialog).getByTestId('pm-mdr-missing')).toBeInTheDocument()
      const fee = within(dialog).getByLabelText(/biaya \(rp\)/i)
      await user.clear(fee)
      await user.type(fee, '4500')
      await user.type(within(dialog).getByLabelText(/alasan/i), REASON)
      await user.click(within(dialog).getByRole('button', { name: 'Simpan' }))
      await waitFor(() => expect(bodies).toHaveLength(1))
      expect(bodies[0]).not.toHaveProperty('pgMdrType')
    })

    test('should reject an invalid contract value before sending', async () => {
      const user = userEvent.setup()
      renderPage()
      await user.click(within(await screen.findByTestId('pm-VA_NOBU_DURIANPAY_SNAP')).getByRole('button', { name: 'Ubah biaya' }))
      const dialog = await screen.findByRole('dialog')
      const mdr = within(dialog).getByLabelText(/tarif kontrak \(rp\)/i)
      await user.clear(mdr)
      await user.type(mdr, '4.000')
      await user.type(within(dialog).getByLabelText(/alasan/i), REASON)
      await user.click(within(dialog).getByRole('button', { name: 'Simpan' }))
      expect(await within(dialog).findByText(/tanpa titik ribuan/)).toBeInTheDocument()
    })
  })
})
