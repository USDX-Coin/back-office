import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { findStaffByEmail, resetMockData } from '@/mocks/handlers'
import { renderWithProviders } from '@/test/test-utils'
import { createInitialPaymentMethods } from '@/mocks/data'
import {
  bniEnableNotice,
  isFeeChanged,
  isLastOffered,
  normalizeFeeValue,
  validateFeeValue,
  validateMaxAmount,
  validateReason,
} from '@/lib/paymentMethods'
import type { PaymentMethod } from '@/lib/types'
import PaymentMethodsPage from '../PaymentMethodsPage'

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  resetMockData()
})
afterAll(() => server.close())

const ADMIN = 'demo@usdx.io'
const DEVELOPER = 'marcus.a@usdx.io'
const REASON = 'Gangguan VA NOBU dari DurianPay sejak 09.10 WIB'

function renderPage(email = ADMIN) {
  return renderWithProviders(<PaymentMethodsPage />, { staffId: findStaffByEmail(email)!.id })
}

const row = (testId: string) => screen.findByTestId(testId)

describe('PaymentMethodsPage', () => {
  describe('positive', () => {
    test('lists every method with its fee, limit, and whether it is offered', async () => {
      renderPage()
      const nobu = await row('pm-VA_NOBU_DURIANPAY_SNAP')
      expect(within(nobu).getByText('Virtual Account NOBU')).toBeInTheDocument()
      expect(within(nobu).getByText('Ditawarkan')).toBeInTheDocument()
      const bni = await row('pm-BANK_TRANSFER_BNI_BNI')
      expect(within(bni).getByText(/Rp 10\.000\.000/)).toBeInTheDocument()
      expect(within(bni).getByText(/allowlist IP/i)).toBeInTheDocument()
    })

    test('turning a method on sends enabled + reason + expectedUpdatedAt and writes the change trail', async () => {
      const user = userEvent.setup()
      const bodies: unknown[] = []
      server.events.on('request:start', async ({ request }) => {
        if (request.method === 'PATCH') bodies.push(await request.clone().json())
      })
      renderPage()
      const bri = await row('pm-VA_BRI_DURIANPAY_SNAP')
      await user.click(within(bri).getByRole('switch'))
      const dialog = await screen.findByRole('dialog')
      await user.type(within(dialog).getByLabelText(/alasan/i), REASON)
      await user.click(within(dialog).getByRole('button', { name: 'Nyalakan' }))
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      expect(bodies[0]).toMatchObject({ enabled: true, reason: REASON, expectedUpdatedAt: expect.any(String) })
      expect(await within(await row('pm-VA_BRI_DURIANPAY_SNAP')).findByText('Ditawarkan')).toBeInTheDocument()
      expect(await screen.findByText(`“${REASON}”`)).toBeInTheDocument()
      server.events.removeAllListeners()
    })

    test('reorders with up/down and saves the whole order in one PUT', async () => {
      const user = userEvent.setup()
      let put: { orderedIds: string[] } | null = null
      server.events.on('request:start', async ({ request }) => {
        if (request.method === 'PUT') put = (await request.clone().json()) as { orderedIds: string[] }
      })
      renderPage()
      await row('pm-VA_NOBU_DURIANPAY_SNAP')
      await user.click(screen.getByRole('button', { name: 'Ubah urutan' }))
      await user.click(screen.getByRole('button', { name: 'Turunkan Virtual Account NOBU (DurianPay)' }))
      await user.click(screen.getByRole('button', { name: 'Simpan urutan' }))
      const dialog = await screen.findByRole('dialog')
      await user.type(within(dialog).getByLabelText(/alasan/i), 'Transfer BNI didahulukan karena lebih murah')
      await user.click(within(dialog).getByRole('button', { name: 'Simpan urutan' }))
      await waitFor(() => expect(put).not.toBeNull())
      expect(put!.orderedIds.length).toBe(16)
      expect(put!.orderedIds[1]).toBe('019e5c10-0000-7000-8000-000000000002')
      server.events.removeAllListeners()
    })
  })

  describe('negative', () => {
    test('BNI transfer guard: the server 409 is shown in plain words inside the dialog', async () => {
      const user = userEvent.setup()
      renderPage()
      const bni = await row('pm-BANK_TRANSFER_BNI_BNI')
      await user.click(within(bni).getByRole('switch'))
      const dialog = await screen.findByRole('dialog')
      // Sebelum dikirim: `unavailableReason = BNI_PREREQUISITE_UNVERIFIED` sudah
      // memberi tahu bahwa server production akan menolak.
      expect(within(dialog).getByRole('note')).toHaveTextContent(/server production akan menolak/i)
      await user.type(within(dialog).getByLabelText(/alasan/i), REASON)
      await user.click(within(dialog).getByRole('button', { name: 'Nyalakan' }))
      const alert = await within(dialog).findByRole('alert')
      expect(alert).toHaveTextContent(/transfer bni belum bisa dinyalakan/i)
      expect(alert).toHaveTextContent(/tidak ada yang berubah/i)
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    test('a reason shorter than 10 characters never reaches the server', async () => {
      const user = userEvent.setup()
      let patched = false
      server.use(
        http.patch('/api/v1/payment-methods/:id', () => {
          patched = true
          return new Response(null, { status: 500 })
        }),
      )
      renderPage()
      await user.click(within(await row('pm-VA_BRI_DURIANPAY_SNAP')).getByRole('switch'))
      const dialog = await screen.findByRole('dialog')
      await user.type(within(dialog).getByLabelText(/alasan/i), 'pendek')
      await user.click(within(dialog).getByRole('button', { name: 'Nyalakan' }))
      expect(within(dialog).getByRole('alert')).toHaveTextContent(/minimal 10 karakter/i)
      expect(patched).toBe(false)
    })

    test('DEVELOPER reads only: switches disabled, no edit/reorder, no change trail', async () => {
      renderPage(DEVELOPER)
      const nobu = await row('pm-VA_NOBU_DURIANPAY_SNAP')
      expect(within(nobu).getByRole('switch')).toBeDisabled()
      expect(screen.queryByRole('button', { name: 'Ubah biaya' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Ubah urutan' })).not.toBeInTheDocument()
      expect(screen.queryByText('Jejak perubahan')).not.toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    test('switching off the LAST offered method requires an explicit acknowledgement', async () => {
      const user = userEvent.setup()
      renderPage()
      const nobu = await row('pm-VA_NOBU_DURIANPAY_SNAP')
      await user.click(within(nobu).getByRole('switch'))
      const dialog = await screen.findByRole('dialog')
      expect(within(dialog).getByText(/metode terakhir yang ditawarkan/i)).toBeInTheDocument()
      await user.type(within(dialog).getByLabelText(/alasan/i), REASON)
      await user.click(within(dialog).getByRole('button', { name: 'Matikan' }))
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      await user.click(within(dialog).getByRole('checkbox'))
      await user.click(within(dialog).getByRole('button', { name: 'Matikan' }))
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    })

    test('editing the fee sends the contract form ("5000" → "5000.00"); retyping the same amount is no change', async () => {
      const user = userEvent.setup()
      const bodies: Record<string, unknown>[] = []
      server.events.on('request:start', async ({ request }) => {
        if (request.method === 'PATCH') bodies.push((await request.clone().json()) as Record<string, unknown>)
      })
      renderPage()
      await user.click(within(await row('pm-VA_NOBU_DURIANPAY_SNAP')).getByRole('button', { name: 'Ubah biaya' }))
      const dialog = await screen.findByRole('dialog')
      const fee = within(dialog).getByLabelText(/biaya \(rp\)/i)
      await user.clear(fee)
      await user.type(fee, '4000')
      await user.type(within(dialog).getByLabelText(/alasan/i), REASON)
      expect(within(dialog).getByRole('button', { name: 'Simpan' })).toBeDisabled()
      expect(bodies).toHaveLength(0)

      await user.clear(fee)
      await user.type(fee, '5000')
      await user.click(within(dialog).getByRole('button', { name: 'Simpan' }))
      await waitFor(() => expect(bodies).toHaveLength(1))
      expect(bodies[0]).toMatchObject({ feeType: 'FLAT_IDR', feeValue: '5000.00', reason: REASON })
      expect(bodies[0]).not.toHaveProperty('maxAmountIdr')
      server.events.removeAllListeners()
    })

    // USDX-749: Transfer BNI = transfer USD tanpa kurs BNI. Server tidak lagi menghasilkan
    // BNI_BUY_RATE_MISSING; kalau tetap datang, tidak ada "Kurs beli BNI belum diisi · Isi kurs BNI".
    test('BNI_BUY_RATE_MISSING from an old server: no "isi kurs BNI" hint or link, row or dialog', async () => {
      const rows = createInitialPaymentMethods().map((m) =>
        m.code === 'BANK_TRANSFER_BNI_BNI' ? { ...m, available: false, unavailableReason: 'BNI_BUY_RATE_MISSING' } : m,
      )
      server.use(http.get('/api/v1/payment-methods', () => HttpResponse.json({ status: 'success', metadata: null, data: rows })))
      const user = userEvent.setup()
      renderPage()
      const bni = await row('pm-BANK_TRANSFER_BNI_BNI')
      expect(within(bni).queryByText(/kurs beli BNI/i)).not.toBeInTheDocument()
      expect(within(bni).queryByRole('link', { name: /isi kurs BNI/i })).not.toBeInTheDocument()
      await user.click(within(bni).getByRole('switch'))
      const dialog = await screen.findByRole('dialog')
      expect(within(dialog).queryByText(/kurs BNI/i)).not.toBeInTheDocument()
      expect(within(dialog).queryByRole('link', { name: /kurs/i })).not.toBeInTheDocument()
    })

    test('after 409 PAYMENT_METHOD_CHANGED the retry carries the refreshed updatedAt', async () => {
      const user = userEvent.setup()
      const sent: string[] = []
      let first = true
      server.use(
        http.patch('/api/v1/payment-methods/:id', async ({ request }) => {
          const body = (await request.json()) as { expectedUpdatedAt: string }
          sent.push(body.expectedUpdatedAt)
          if (first) {
            first = false
            return HttpResponse.json(
              { status: 'error', metadata: null, data: null, error: { code: 'PAYMENT_METHOD_CHANGED', message: 'changed' } },
              { status: 409 },
            )
          }
          return HttpResponse.json({ status: 'success', metadata: null, data: createInitialPaymentMethods()[0] })
        }),
      )
      let fresh = false
      server.use(
        http.get('/api/v1/payment-methods', () => {
          const data = createInitialPaymentMethods().map((m) =>
            fresh && m.code === 'VA_BRI_DURIANPAY_SNAP' ? { ...m, updatedAt: '2026-10-13T06:00:00.000Z' } : m,
          )
          return HttpResponse.json({ status: 'success', metadata: null, data })
        }),
      )
      renderPage()
      await user.click(within(await row('pm-VA_BRI_DURIANPAY_SNAP')).getByRole('switch'))
      const dialog = await screen.findByRole('dialog')
      await user.type(within(dialog).getByLabelText(/alasan/i), REASON)
      fresh = true
      await user.click(within(dialog).getByRole('button', { name: 'Nyalakan' }))
      expect(await within(dialog).findByRole('alert')).toHaveTextContent(/baru saja diubah admin lain/i)
      await waitFor(() => expect(sent).toHaveLength(1))
      await user.click(within(dialog).getByRole('button', { name: 'Nyalakan' }))
      await waitFor(() => expect(sent).toHaveLength(2))
      expect(sent[0]).toBe('2026-10-09T03:00:00.000Z')
      expect(sent[1]).toBe('2026-10-13T06:00:00.000Z')
    })
  })
})

describe('lib/paymentMethods', () => {
  const m = (over: Partial<PaymentMethod>): PaymentMethod => ({
    id: 'a', code: 'X', channel: 'VA', bank: 'NOBU', provider: 'DURIANPAY_SNAP', enabled: true, sortOrder: 10,
    feeType: 'FLAT_IDR', feeValue: '4000.00', available: true, updatedAt: 't', ...over,
  })
  test('positive: valid fee, limit, reason', () => {
    expect(validateFeeValue('FLAT_IDR', '4000.50')).toBeNull()
    expect(validateFeeValue('PERCENT', '0.7')).toBeNull()
    expect(validateMaxAmount('VA_NOBU_DURIANPAY_SNAP', '').value).toBeNull()
    expect(validateMaxAmount('BANK_TRANSFER_BNI_BNI', '5000000').value).toBe('5000000.00')
    expect(validateReason('  sepuluh huruf  ').error).toBeNull()
  })
  test('negative: BNI limit required and capped at Rp 10 juta; percent ≤ 100', () => {
    expect(validateMaxAmount('BANK_TRANSFER_BNI_BNI', '').error).toMatch(/wajib/i)
    expect(validateMaxAmount('BANK_TRANSFER_BNI_BNI', '10000001').error).toMatch(/10\.000\.000/)
    expect(validateFeeValue('PERCENT', '101')).toMatch(/100/)
    expect(validateFeeValue('FLAT_IDR', '4.000')).not.toBeNull()
  })
  test('edge: last offered ignores enabled-but-unavailable methods', () => {
    const a = m({ id: 'a' })
    const b = m({ id: 'b', available: false })
    expect(isLastOffered(a, [a, b])).toBe(true)
    expect(isLastOffered(a, [a, m({ id: 'c' })])).toBe(false)
  })
})

describe('lib/paymentMethods — bentuk kanonik kontrak', () => {
  const m = (over: Partial<PaymentMethod>): PaymentMethod => ({
    id: 'a', code: 'BANK_TRANSFER_BNI_BNI', channel: 'BANK_TRANSFER', bank: 'BNI', provider: 'BNI', enabled: false,
    sortOrder: 20, feeType: 'FLAT_IDR', feeValue: '0.00', available: false, updatedAt: 't', ...over,
  })
  test('positive: FLAT_IDR is sent with 2 decimals and PERCENT with 4, like GET returns them', () => {
    expect(normalizeFeeValue('FLAT_IDR', '4000')).toBe('4000.00')
    expect(normalizeFeeValue('FLAT_IDR', '4000.5')).toBe('4000.50')
    expect(normalizeFeeValue('PERCENT', '0.7')).toBe('0.7000')
  })
  test('negative: the same amount spelled differently is not a change', () => {
    expect(isFeeChanged(m({ feeValue: '4000.00' }), 'FLAT_IDR', '4000')).toBe(false)
    expect(isFeeChanged(m({ feeValue: '4000.00' }), 'FLAT_IDR', '4500')).toBe(true)
    expect(isFeeChanged(m({ feeValue: '4000.00' }), 'PERCENT', '4000')).toBe(true)
  })
  test('edge: the reason counts characters OTHER than spaces, like the backend', () => {
    expect(validateReason('a a a a a').error).toMatch(/selain spasi/)
    expect(validateReason('          ').error).toMatch(/selain spasi/)
    expect(validateReason('a b c d e f g h i j').error).toBeNull()
    expect(validateReason('  sepuluhhh  ').value).toBe('sepuluhhh')
  })
  test('edge: the BNI notice follows the server reason only, and only for Transfer BNI', () => {
    expect(bniEnableNotice(m({ unavailableReason: 'BNI_PREREQUISITE_UNVERIFIED' }))).toBe('PREREQUISITE')
    // USDX-749: tidak ada lagi catatan "kurs BNI belum diisi".
    expect(bniEnableNotice(m({ unavailableReason: 'BNI_BUY_RATE_MISSING' }))).toBeNull()
    expect(bniEnableNotice(m({ available: true, unavailableReason: null }))).toBeNull()
    expect(bniEnableNotice(m({ code: 'VA_BNI_DURIANPAY_SNAP', unavailableReason: 'BNI_BUY_RATE_MISSING' }))).toBeNull()
    expect(bniEnableNotice(m({ unavailableReason: 'SOMETHING_NEW' }))).toBeNull()
  })
})
