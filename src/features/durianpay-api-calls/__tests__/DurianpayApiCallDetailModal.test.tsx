import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { Route, Routes } from 'react-router'
import { server } from '@/mocks/server'
import { resetMockData } from '@/mocks/handlers'
import { DURIANPAY_CALL_MOCK_IDS as IDS } from '@/mocks/data'
import DurianpayApiCallsPage from '@/features/durianpay-api-calls/DurianpayApiCallsPage'
import { renderWithProviders } from '@/test/test-utils'

// Detail satu panggilan lewat rute `/durianpay-api-calls/:id`.
// Peran: stf_2 MANAGER · stf_3 DEVELOPER · stf_4 STAFF (ditolak 403 oleh server).

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  server.events.removeAllListeners()
  resetMockData()
  localStorage.clear()
})
afterAll(() => server.close())

function setup(path: string, staffId = 'stf_2') {
  return renderWithProviders(
    <Routes>
      <Route path="/durianpay-api-calls" element={<DurianpayApiCallsPage />} />
      <Route path="/durianpay-api-calls/:id" element={<DurianpayApiCallsPage />} />
    </Routes>,
    { initialEntries: [path], staffId },
  )
}

async function openDialog(id: string, staffId?: string) {
  setup(`/durianpay-api-calls/${id}`, staffId)
  const dialog = await screen.findByRole('dialog')
  await within(dialog).findByTestId('durianpay-verdict')
  return dialog
}

async function openTechnical(dialog: HTMLElement) {
  const user = userEvent.setup()
  await user.click(within(dialog).getByRole('button', { name: /Detail teknis/ }))
  return dialog
}

describe('DurianpayApiCallDetailModal', () => {
  describe('positive', () => {
    test('should lead with the reason a call failed, not with the raw body', async () => {
      const dialog = await openDialog(IDS.createVaUnavailable)
      expect(within(dialog).getByTestId('durianpay-error-summary')).toHaveTextContent(
        'HTTP 500 responseCode=5002701 Internal Server Error',
      )
      expect(within(dialog).getByText('Tidak jelas')).toBeInTheDocument()
      // Badan mentah ada, tapi TERLIPAT — bukan hal pertama yang terlihat.
      expect(within(dialog).queryByText('Yang kita kirim')).not.toBeInTheDocument()
      expect(
        within(dialog).getByRole('button', { name: /Detail teknis/ }),
      ).toBeInTheDocument()
    })

    test('should keep the DurianPay code verbatim beside its plain-language companion', async () => {
      const dialog = await openDialog(IDS.createVaUnavailable)
      // Kodenya yang dikutip saat melapor ke DurianPay — ia tidak boleh hilang.
      expect(within(dialog).getByText('5002701')).toBeInTheDocument()
      expect(
        within(dialog).getByText('DurianPay gagal memprosesnya — hasilnya tidak bisa dipastikan'),
      ).toBeInTheDocument()
    })

    test('should show the handles DurianPay asks for when we report a call', async () => {
      const dialog = await openDialog(IDS.createVaUnavailable)
      expect(within(dialog).getByText('20260918082500009')).toBeInTheDocument()
      expect(within(dialog).getByText('dp-trace-2b90cc')).toBeInTheDocument()
      expect(within(dialog).getByRole('button', { name: 'Salin Trace ID' })).toBeInTheDocument()
    })

    test('should reveal both raw bodies once Detail teknis is opened', async () => {
      const dialog = await openTechnical(await openDialog(IDS.createVaUnavailable))
      expect(within(dialog).getByText('Yang kita kirim')).toBeInTheDocument()
      expect(within(dialog).getByText('Yang DurianPay jawab')).toBeInTheDocument()
      expect(within(dialog).getByText(/"responseCode": "5002701"/)).toBeInTheDocument()
    })

    test('should say the destination and the plain-language call on the SNAP row', async () => {
      const dialog = await openDialog(IDS.createVaOk)
      expect(within(dialog).getAllByText('Buat nomor VA untuk nasabah').length).toBeGreaterThan(0)
      expect(within(dialog).getByText('https://api.durianpay.id')).toBeInTheDocument()
      expect(within(dialog).getByText('POST /v1.0/transfer-va/create-va')).toBeInTheDocument()
    })
  })

  describe('negative', () => {
    test('should state that a body was TRUNCATED instead of showing the head as the whole thing', async () => {
      const dialog = await openTechnical(await openDialog(IDS.legacyTruncated))
      const notice = within(dialog).getByTestId('durianpay-body-truncated')
      expect(notice).toHaveTextContent(/terpotong/)
      expect(notice).toHaveTextContent(/40,3 KiB/)
    })

    test('should show a non-JSON reply as raw text, marked as such', async () => {
      const dialog = await openTechnical(await openDialog(IDS.balanceRawHtml))
      expect(within(dialog).getByText('bukan JSON')).toBeInTheDocument()
      expect(within(dialog).getByText(/503 Service Temporarily Unavailable/)).toBeInTheDocument()
    })

    test('should say a missing response body is a reply that never came', async () => {
      const dialog = await openTechnical(await openDialog(IDS.statusTimeout))
      expect(
        within(dialog).getByText(/jawabannya tidak pernah datang/),
      ).toBeInTheDocument()
      expect(
        within(dialog).getByText(/Tidak ada — jawabannya tidak pernah sampai/),
      ).toBeInTheDocument()
    })

    test('should never promise HTTP headers, because none are stored', async () => {
      const dialog = await openTechnical(await openDialog(IDS.createVaOk))
      expect(
        within(dialog).getByText(/Header HTTP tidak disimpan sama sekali/),
      ).toBeInTheDocument()
    })

    test('should explain a 403 in words instead of leaving a blank modal', async () => {
      server.use(
        http.get('/api/v1/durianpay-api-calls/:id', () =>
          HttpResponse.json(
            {
              status: 'error',
              metadata: null,
              data: null,
              error: { code: 'FORBIDDEN', message: 'FORBIDDEN' },
            },
            { status: 403 },
          ),
        ),
      )
      setup(`/durianpay-api-calls/${IDS.createVaOk}`)
      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent(/Manager, Admin, dan Developer/)
    })

    test('should explain a 404 as a row that is gone', async () => {
      setup('/durianpay-api-calls/019f3a99-0678-7c31-9b2d-0000000000ff')
      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent(/penyapu retensi/)
    })
  })

  describe('edge cases', () => {
    test('should name the redaction marks so nobody hunts for the original values', async () => {
      const dialog = await openTechnical(await openDialog(IDS.tokenOk))
      expect(within(dialog).getByText(/"accessToken": "\[REDACTED:SECRET\]"/)).toBeInTheDocument()
      expect(
        within(dialog).getByText(/kredensial atau tanda tangan/),
      ).toBeInTheDocument()
    })

    test('should explain a call that carries no order reference rather than showing an em dash', async () => {
      const dialog = await openDialog(IDS.tokenOk)
      expect(
        within(dialog).getByText(/tidak membawa nomor order, dan itu wajar/),
      ).toBeInTheDocument()
    })

    test('should say the Legacy path has no X-EXTERNAL-ID at all', async () => {
      const dialog = await openDialog(IDS.legacyTruncated)
      expect(
        within(dialog).getByText(/jalur lama tidak memakai header ini/),
      ).toBeInTheDocument()
    })

    test('should keep the filters and the page when the modal is closed', async () => {
      const user = userEvent.setup()
      setup(`/durianpay-api-calls/${IDS.createVaOk}?outcome=SUCCESS`)
      const dialog = await screen.findByRole('dialog')
      await user.click(within(dialog).getByRole('button', { name: 'Tutup dialog' }))
      // Chip saringan masih terpasang setelah kembali ke daftarnya.
      expect(await screen.findByText('Hasil: Sampai & dijawab')).toBeInTheDocument()
    })
  })
})
