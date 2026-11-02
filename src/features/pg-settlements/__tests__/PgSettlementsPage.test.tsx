import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { resetMockData } from '@/mocks/handlers'
import { MOCK_PG_BATCH_MISMATCH_ID } from '@/mocks/data'
import PgSettlementsPage from '@/features/pg-settlements/PgSettlementsPage'
import { renderWithProviders } from '@/test/test-utils'

// D29 / USDX-792 — "Pencairan PG" (sot/api/pg-settlements.yaml, § 21.8).

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  server.events.removeAllListeners()
  resetMockData()
})
afterAll(() => server.close())

function setup(path = '/pencairan-pg', staffId = 'stf_2') {
  return renderWithProviders(
    <Routes>
      <Route path="/pencairan-pg" element={<PgSettlementsPage />} />
      <Route path="/pencairan-pg/:id" element={<PgSettlementsPage />} />
    </Routes>,
    { initialEntries: [path], staffId },
  )
}

describe('PgSettlementsPage @ USDX-792', () => {
  describe('positive', () => {
    test('should list batches with status text and the signed difference', async () => {
      setup()
      expect(await screen.findByText('Tidak cocok')).toBeInTheDocument()
      expect(screen.getByText('kurang Rp 150.000,00')).toBeInTheDocument()
      expect(screen.getByText('Cocok')).toBeInTheDocument()
      expect(screen.getByText('Menunggu dana')).toBeInTheDocument()
    })

    test('should not pull the BNI balance until "Cek saldo" is pressed', async () => {
      const user = userEvent.setup()
      const balanceCalls: string[] = []
      server.events.on('request:start', ({ request }) => {
        if (new URL(request.url).pathname === '/api/v1/bni-accounts/balances') balanceCalls.push(request.url)
      })
      setup()
      const card = await screen.findByTestId('prefunding-card')
      expect(await within(card).findByTestId('prefunding-low')).toHaveTextContent('Rp 200.000.000,00')
      expect(within(card).getByTestId('prefunding-balance')).toHaveTextContent('Belum dicek')
      expect(balanceCalls).toHaveLength(0)
      await user.click(within(card).getByRole('button', { name: 'Cek saldo' }))
      await waitFor(() => expect(balanceCalls).toHaveLength(1))
    })

    test('MISMATCH: difference + candidates, manual link requires a credit and a ≥10-char reason', async () => {
      const user = userEvent.setup()
      let sent: unknown = null
      server.events.on('request:start', async ({ request }) => {
        if (request.url.endsWith('/match-manual')) sent = await request.clone().json()
      })
      setup(`/pencairan-pg/${MOCK_PG_BATCH_MISMATCH_ID}`)
      const m = await screen.findByTestId('pg-settlement-modal')
      expect(await within(m).findByTestId('pg-difference')).toHaveTextContent('kurang Rp 150.000,00')
      expect(within(m).getByTestId('pg-candidates')).toHaveTextContent('TRF DURIANPAY SETTLEMENT 20261101')
      await user.click(within(m).getByRole('button', { name: 'Tautkan manual' }))
      const dialog = await screen.findByRole('dialog', { name: 'Tautkan batch secara manual?' })
      const submit = within(dialog).getByRole('button', { name: 'Tautkan manual' })
      expect(submit).toBeDisabled()
      await user.click(within(dialog).getByRole('radio', { name: /^Rp 54.450.000,00/ }))
      await user.type(within(dialog).getByLabelText(/^Alasan/), 'pendek')
      expect(submit).toBeDisabled()
      await user.type(within(dialog).getByLabelText(/^Alasan/), ' sudah dicek dashboard')
      await user.click(submit)
      await waitFor(() => expect(sent).toEqual({ creditEntryId: 'stmt-np-1101-a', reason: 'pendek sudah dicek dashboard' }))
      await waitFor(() => expect(within(m).getByTestId('pg-settlement-status')).toHaveTextContent('Ditautkan manual'))
    })
  })

  describe('negative', () => {
    test('should not offer manual linking to STAFF', async () => {
      setup(`/pencairan-pg/${MOCK_PG_BATCH_MISMATCH_ID}`, 'stf_4')
      const m = await screen.findByTestId('pg-settlement-modal')
      expect(await within(m).findByText(/hanya untuk Manager dan Admin/)).toBeInTheDocument()
      expect(within(m).queryByRole('button', { name: 'Tautkan manual' })).not.toBeInTheDocument()
    })

    test('409 CREDIT_ALREADY_LINKED is explained in the dialog', async () => {
      const user = userEvent.setup()
      server.use(
        http.post('/api/v1/pg-settlements/:id/match-manual', () =>
          HttpResponse.json(
            { status: 'error', metadata: null, data: null, error: { code: 'CONFLICT', message: 'CREDIT_ALREADY_LINKED' } },
            { status: 409 },
          ),
        ),
      )
      setup(`/pencairan-pg/${MOCK_PG_BATCH_MISMATCH_ID}`)
      const m = await screen.findByTestId('pg-settlement-modal')
      await user.click(await within(m).findByRole('button', { name: 'Tautkan manual' }))
      const dialog = await screen.findByRole('dialog', { name: 'Tautkan batch secara manual?' })
      await user.click(within(dialog).getByRole('radio', { name: /^Rp 54.450.000,00/ }))
      await user.type(within(dialog).getByLabelText(/^Alasan/), 'sudah dicek di dashboard Durianpay')
      await user.click(within(dialog).getByRole('button', { name: 'Tautkan manual' }))
      expect(await within(dialog).findByRole('alert')).toHaveTextContent('sudah tertaut ke batch lain')
    })
  })
})
