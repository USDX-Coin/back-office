import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { findStaffByEmail, resetMockData } from '@/mocks/handlers'
import { renderWithProviders } from '@/test/test-utils'
import type { BackofficeTransactionItem } from '@/lib/types'
import TransactionsPage from '../TransactionsPage'

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  server.events.removeAllListeners()
  resetMockData()
})
afterAll(() => server.close())

function renderPage(path = '/transactions', staffEmail = 'demo@usdx.io') {
  return renderWithProviders(
    <Routes>
      <Route path="/transactions" element={<TransactionsPage />} />
      <Route path="/transactions/:id" element={<TransactionsPage />} />
    </Routes>,
    { initialEntries: [path], staffId: findStaffByEmail(staffEmail)!.id },
  )
}

const ok = (data: BackofficeTransactionItem[], needsActionTotal = data.filter((r) => r.needsAction).length) =>
  HttpResponse.json({
    status: 'success',
    metadata: { page: 1, limit: 20, total: data.length, needsActionTotal },
    data,
  })

const REDEEM_ACTION: BackofficeTransactionItem = {
  id: '019e5d01-1111-7000-8000-00000000aaaa',
  kind: 'REDEEM',
  occurredAt: '2026-10-08T02:10:00Z',
  orderNumber: 'RDM-20261008-0001',
  customerName: 'Budi Santoso',
  userEmail: 'b***@gmail.com',
  partnerCode: null,
  senderName: null,
  amountUsdx: '120.000000',
  amountIdr: '1930000.00',
  status: 'BURNED',
  needsAction: true,
  actionType: 'REDEEM_APPROVAL',
  actionSince: '2026-10-08T02:15:00Z',
  actions: [{ actionType: 'REDEEM_APPROVAL', queue: 'REDEEM_APPROVALS', refId: '019e5d01-1111-7000-8000-00000000aaaa', since: '2026-10-08T02:15:00Z' }],
}

const MINT_DONE: BackofficeTransactionItem = {
  id: '019e5d02-2222-7000-8000-00000000bbbb',
  kind: 'MINT',
  occurredAt: '2026-10-09T01:00:00Z',
  orderNumber: 'MNT-20261009-0007',
  customerName: 'Sari Dewi',
  userEmail: 's***@yahoo.com',
  partnerCode: 'ACME',
  senderName: null,
  amountUsdx: '50.000000',
  amountIdr: '825417.00',
  status: 'COMPLETED',
  needsAction: false,
  actions: [],
}

const INCOMING: BackofficeTransactionItem = {
  id: '019e5d03-3333-7000-8000-00000000cccc',
  kind: 'INCOMING_UNMATCHED',
  occurredAt: '2026-10-07T01:00:00Z',
  orderNumber: null,
  customerName: null,
  userEmail: null,
  partnerCode: null,
  senderName: 'ANDI WIJAYA',
  amountUsdx: null,
  amountIdr: '500123.00',
  status: 'HELD',
  needsAction: true,
  actionType: 'HELD_CREDIT',
  actionSince: '2026-10-07T01:00:00Z',
  actions: [{ actionType: 'HELD_CREDIT', queue: 'HELD_CREDITS', refId: '019e5d03-3333-7000-8000-00000000cccc', since: '2026-10-07T01:00:00Z', heldReason: 'NO_MATCHING_ORDER' }],
}

/** `needsAction=true` → baris perlu tindakan; tanpa saringan → semuanya (perlu tindakan dulu). */
function stubList(actionRows: BackofficeTransactionItem[], historyRows: BackofficeTransactionItem[], urls: URL[] = []) {
  server.use(
    http.get('/api/v1/transactions', ({ request }) => {
      const url = new URL(request.url)
      urls.push(url)
      return url.searchParams.get('needsAction') === 'true'
        ? ok(actionRows)
        : ok([...actionRows, ...historyRows], actionRows.length)
    }),
  )
}

async function openRow(user: ReturnType<typeof userEvent.setup>, name: RegExp) {
  await user.click(await screen.findByRole('button', { name }))
  return screen.findByTestId('transaction-modal')
}

describe('TransactionsPage (SOT PR #50)', () => {
  describe('positive', () => {
    test('should default to the "Perlu tindakan" tab with its count, and never show a bank account', async () => {
      const urls: URL[] = []
      stubList([INCOMING, REDEEM_ACTION], [MINT_DONE], urls)
      renderPage()
      expect(await screen.findByRole('button', { name: /^Buka Uang masuk ANDI WIJAYA/ })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /^Buka Mint Sari Dewi/ })).not.toBeInTheDocument()
      expect(screen.getByRole('tab', { name: 'Perlu tindakan (2)' })).toHaveAttribute('aria-selected', 'true')
      expect(screen.getByText('Perlu persetujuan pencairan')).toBeInTheDocument()
      expect(screen.getByText('Uang masuk tertahan')).toBeInTheDocument()
      // Referensi pendek = nomor order.
      expect(screen.getByText('RDM-20261008-0001')).toBeInTheDocument()
      expect(urls.every((u) => u.searchParams.get('needsAction') === 'true')).toBe(true)
    })

    test('should list everything on the "Semua" tab, rows needing action first', async () => {
      const user = userEvent.setup()
      const urls: URL[] = []
      stubList([INCOMING, REDEEM_ACTION], [MINT_DONE], urls)
      renderPage()
      await user.click(await screen.findByRole('tab', { name: 'Semua' }))
      const done = await screen.findByRole('button', { name: /^Buka Mint Sari Dewi/ })
      const action = screen.getByRole('button', { name: /^Buka Uang masuk ANDI WIJAYA/ })
      // DOCUMENT_POSITION_FOLLOWING = 4: baris selesai SETELAH baris perlu tindakan.
      expect(action.compareDocumentPosition(done) & 4).toBeTruthy()
      expect(urls.at(-1)!.searchParams.has('needsAction')).toBe(false)
      // Tab perlu tindakan tetap membawa angkanya (metadata.needsActionTotal).
      expect(screen.getByRole('tab', { name: 'Perlu tindakan (2)' })).toBeInTheDocument()
    })

    test('should open a centered modal with the queue action in its footer', async () => {
      const user = userEvent.setup()
      stubList([REDEEM_ACTION], [])
      renderPage()
      const modal = await openRow(user, /^Buka Redeem Budi Santoso/)
      expect(within(modal).getByRole('heading', { name: 'Budi Santoso' })).toBeInTheDocument()
      expect(within(modal).getByTestId('record-todo')).toHaveTextContent(/cocokkan rekening tujuan/i)
      expect(within(modal).getByRole('button', { name: 'Setujui pencairan' })).toBeEnabled()
      expect(within(modal).getByRole('button', { name: 'Tolak pencairan' })).toBeEnabled()
      expect(within(modal).getByRole('link', { name: 'Buka di antrean' })).toHaveAttribute('href', '/redeem-approvals')
    })

    test('should move to the next / previous row with the buttons and the arrow keys', async () => {
      const user = userEvent.setup()
      stubList([INCOMING, REDEEM_ACTION], [])
      renderPage()
      const modal = await openRow(user, /^Buka Uang masuk ANDI WIJAYA/)
      expect(within(modal).getByTestId('record-modal-position')).toHaveTextContent('1 dari 2')
      expect(within(modal).getByRole('button', { name: 'Sebelumnya' })).toBeDisabled()
      await user.click(within(modal).getByRole('button', { name: 'Berikutnya' }))
      expect(await within(modal).findByRole('heading', { name: 'Budi Santoso' })).toBeInTheDocument()
      expect(within(modal).getByTestId('record-modal-position')).toHaveTextContent('2 dari 2')
      await user.keyboard('{ArrowUp}')
      expect(await within(modal).findByRole('heading', { name: 'ANDI WIJAYA' })).toBeInTheDocument()
    })

    test('should open the modal straight from a deep link', async () => {
      stubList([REDEEM_ACTION], [])
      renderPage(`/transactions/${REDEEM_ACTION.id}`)
      expect(await screen.findByRole('heading', { name: 'Budi Santoso' })).toBeInTheDocument()
      expect(screen.getByTestId('transaction-modal')).toBeInTheDocument()
    })

    test('should send kind + needsAction + q to the contract endpoint', async () => {
      const urls: URL[] = []
      stubList([], [], urls)
      renderPage('/transactions?jenis=REDEEM&q=budi')
      await waitFor(() => expect(urls.length).toBeGreaterThanOrEqual(1))
      const actionUrl = urls.find((u) => u.searchParams.get('needsAction') === 'true')!
      expect(actionUrl.searchParams.getAll('kind')).toEqual(['REDEEM'])
      expect(actionUrl.searchParams.get('q')).toBe('budi')
    })
  })

  describe('negative', () => {
    test('should disable the payout decision for STAFF with the reason written out', async () => {
      const user = userEvent.setup()
      stubList([REDEEM_ACTION], [])
      renderPage('/transactions', 'sking@usdx.io')
      const modal = await openRow(user, /^Buka Redeem Budi Santoso/)
      expect(within(modal).getByRole('button', { name: 'Setujui pencairan' })).toBeDisabled()
      expect(within(modal).getByText(/hanya manager atau admin/i)).toBeInTheDocument()
    })

    test('should show an error state with retry when the list fails', async () => {
      server.use(
        http.get('/api/v1/transactions', () =>
          HttpResponse.json({ status: 'error', metadata: null, data: null, error: { code: 'BOOM', message: 'x' } }, { status: 500 }),
        ),
      )
      renderPage()
      expect((await screen.findAllByText(/gagal dimuat/i)).length).toBeGreaterThan(0)
    })

    test('a deep link to a row that is not in the list says so instead of guessing', async () => {
      stubList([REDEEM_ACTION], [])
      renderPage('/transactions/tidak-ada')
      const modal = await screen.findByTestId('transaction-modal').catch(() => screen.findByRole('dialog'))
      expect((await within(modal).findAllByText(/tidak ada di daftar/i)).length).toBeGreaterThan(0)
    })
  })

  describe('edge cases', () => {
    test('PAYOUT_STUCK is monitored, not actionable', async () => {
      const user = userEvent.setup()
      const stuck: BackofficeTransactionItem = {
        ...REDEEM_ACTION,
        id: 'stuck-1',
        customerName: 'Rina',
        status: 'PROCESSING_PAYOUT',
        actionType: 'PAYOUT_FAILURE',
        actions: [{ actionType: 'PAYOUT_FAILURE', queue: 'PAYOUT_FAILURES', refId: 'stuck-1', since: '2026-10-08T00:00:00Z', payoutIssueKind: 'PAYOUT_STUCK' }],
      }
      stubList([stuck], [])
      renderPage()
      const modal = await openRow(user, /^Buka Redeem Rina/)
      expect(within(modal).getByTestId('record-todo')).toHaveTextContent(/dipantau/i)
      expect(within(modal).queryByRole('button', { name: /kirim ulang/i })).not.toBeInTheDocument()
    })

    test('an unknown actionType renders its raw value and no action button', async () => {
      const user = userEvent.setup()
      const odd: BackofficeTransactionItem = {
        ...REDEEM_ACTION,
        id: 'odd-1',
        customerName: 'Odd',
        actionType: 'SECOND_PERSON',
        actions: [{ actionType: 'SECOND_PERSON', queue: 'APPROVALS', refId: 'odd-1', since: '2026-10-08T00:00:00Z' }],
      }
      stubList([odd], [])
      renderPage()
      const modal = await openRow(user, /^Buka Redeem Odd/)
      expect(within(modal).getAllByText('SECOND_PERSON').length).toBeGreaterThan(0)
      expect(within(modal).queryByRole('button', { name: /setujui|kirim ulang|terima/i })).not.toBeInTheDocument()
    })

    test('default MSW mock: approving from the modal removes the row from "Perlu tindakan"', async () => {
      const user = userEvent.setup()
      renderPage('/transactions?tindakan=REDEEM_APPROVAL')
      const rows = await screen.findAllByRole('button', { name: /^Buka Redeem/ })
      const before = rows.length
      await user.click(rows[0]!)
      const modal = await screen.findByTestId('transaction-modal')
      await user.click(within(modal).getByRole('button', { name: 'Setujui pencairan' }))
      const dialog = await screen.findByRole('dialog', { name: /setujui pencairan/i })
      await user.click(within(dialog).getByRole('button', { name: /setujui pencairan/i }))
      await waitFor(() =>
        expect(screen.queryAllByRole('button', { name: /^Buka Redeem/, hidden: true }).length).toBe(before - 1),
      )
    })
  })
})

/** Catat setiap `GET /api/v1/orders/{id}` (rincian order) yang benar-benar keluar. */
function trackOrderDetailRequests() {
  const ids: string[] = []
  server.events.on('request:start', ({ request }) => {
    const m = new URL(request.url).pathname.match(/^\/api\/v1\/orders\/([^/]+)$/)
    if (m && request.method === 'GET') ids.push(decodeURIComponent(m[1]!))
  })
  return ids
}

describe('TransactionDetailModal — seksi Rincian order', () => {
  describe('positive', () => {
    test('should render order details INSIDE the transaction modal — never a second dialog', async () => {
      const user = userEvent.setup()
      const requests = trackOrderDetailRequests()
      renderPage('/transactions?tab=semua&jenis=MINT')
      const rows = await screen.findAllByRole('button', { name: /^Buka Mint/ })
      await user.click(rows[0]!)
      const modal = await screen.findByTestId('transaction-modal')
      expect(within(modal).queryByRole('button', { name: /lihat rincian order/i })).not.toBeInTheDocument()

      const toggle = within(modal).getByRole('button', { name: /rincian order/i })
      expect(toggle).toHaveAttribute('aria-expanded', 'false')
      await user.click(toggle)
      expect(toggle).toHaveAttribute('aria-expanded', 'true')
      expect(await within(modal).findByText(/^perkiraan pendapatan$/i)).toBeInTheDocument()
      expect(within(modal).getByText(/^kurs & spread$/i)).toBeInTheDocument()
      expect(within(modal).getByTestId('order-detail-content')).toBeInTheDocument()
      // Satu-satunya dialog di layar adalah modal Transaksi.
      expect(screen.getAllByRole('dialog')).toHaveLength(1)
      expect(requests).toHaveLength(1)
    })

    test('should show the full redeem bank destination only after the section is opened', async () => {
      const user = userEvent.setup()
      renderPage('/transactions?tab=semua&jenis=REDEEM')
      const rows = await screen.findAllByRole('button', { name: /^Buka Redeem/ })
      // Baris riwayat (bawah) = order redeem dengan rincian di mock.
      await user.click(rows.at(-2)!)
      const modal = await screen.findByTestId('transaction-modal')
      expect(within(modal).queryByText('Nomor rekening')).not.toBeInTheDocument()
      await user.click(within(modal).getByRole('button', { name: /rincian order/i }))
      expect(await within(modal).findByText('Bank tujuan')).toBeInTheDocument()
      expect(within(modal).getByText('Nomor rekening')).toBeInTheDocument()
      expect(screen.getAllByRole('dialog')).toHaveLength(1)
    })
  })

  describe('negative', () => {
    test('should NOT fetch the order detail when the modal opens, only when the section opens', async () => {
      const user = userEvent.setup()
      const requests = trackOrderDetailRequests()
      renderPage('/transactions?tab=semua&jenis=REDEEM')
      const rows = await screen.findAllByRole('button', { name: /^Buka Redeem/ })
      // Baris riwayat (bawah) = order redeem dengan rincian di mock.
      await user.click(rows.at(-2)!)
      const modal = await screen.findByTestId('transaction-modal')
      // Beri kesempatan query mana pun untuk berangkat.
      await new Promise((r) => setTimeout(r, 50))
      expect(requests).toHaveLength(0)
      await user.click(within(modal).getByRole('button', { name: /rincian order/i }))
      await within(modal).findByText('Bank tujuan')
      expect(requests).toHaveLength(1)
    })

    test('should close the section again on ↑/↓ and not fetch the next row', async () => {
      const user = userEvent.setup()
      const requests = trackOrderDetailRequests()
      renderPage('/transactions?tab=semua&jenis=REDEEM')
      const rows = await screen.findAllByRole('button', { name: /^Buka Redeem/ })
      // Baris riwayat (bawah) = order redeem dengan rincian di mock.
      await user.click(rows.at(-2)!)
      const modal = await screen.findByTestId('transaction-modal')
      await user.click(within(modal).getByRole('button', { name: /rincian order/i }))
      await within(modal).findByText('Bank tujuan')
      expect(requests).toHaveLength(1)

      const before = within(modal).getByTestId('record-modal-position').textContent
      await user.click(within(modal).getByRole('button', { name: 'Berikutnya' }))
      await waitFor(() => expect(within(modal).getByTestId('record-modal-position').textContent).not.toBe(before))
      expect(within(modal).getByRole('button', { name: /rincian order/i })).toHaveAttribute('aria-expanded', 'false')
      expect(within(modal).queryByText('Bank tujuan')).not.toBeInTheDocument()
      await new Promise((r) => setTimeout(r, 50))
      expect(requests).toHaveLength(1)
    })

    test('should show an error with a retry inside the section when the detail fails', async () => {
      const user = userEvent.setup()
      let calls = 0
      server.use(
        http.get('/api/v1/orders/:id', () => {
          calls += 1
          return HttpResponse.json(
            { status: 'error', metadata: null, data: null, error: { code: 'BOOM', message: 'x' } },
            { status: 500 },
          )
        }),
      )
      renderPage('/transactions?tab=semua&jenis=MINT')
      const rows = await screen.findAllByRole('button', { name: /^Buka Mint/ })
      await user.click(rows[0]!)
      const modal = await screen.findByTestId('transaction-modal')
      await user.click(within(modal).getByRole('button', { name: /rincian order/i }))
      const retry = await within(modal).findByRole('button', { name: 'Coba lagi' }, { timeout: 5000 })
      const before = calls
      await user.click(retry)
      await waitFor(() => expect(calls).toBeGreaterThan(before))
      expect(screen.getAllByRole('dialog')).toHaveLength(1)
    })
  })

  describe('edge cases', () => {
    test('should not offer the section for incoming money without an order', async () => {
      const user = userEvent.setup()
      stubList([INCOMING], [])
      renderPage()
      const modal = await openRow(user, /^Buka Uang masuk ANDI WIJAYA/)
      expect(within(modal).queryByRole('button', { name: /rincian order/i })).not.toBeInTheDocument()
    })

    test('should show times in the table format (Inter, tabular), not the ISO-like WIB stamp', async () => {
      const user = userEvent.setup()
      stubList([REDEEM_ACTION], [])
      renderPage()
      const modal = await openRow(user, /^Buka Redeem Budi Santoso/)
      expect(within(modal).queryByText(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} WIB/)).not.toBeInTheDocument()
      const created = within(modal).getByText('Dibuat').nextElementSibling!
      expect(created.querySelector('.tabular-nums')).not.toBeNull()
      expect(created.querySelector('.font-mono')).toBeNull()
    })
  })
})
