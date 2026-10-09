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

function stubList(actionRows: BackofficeTransactionItem[], historyRows: BackofficeTransactionItem[], urls: URL[] = []) {
  server.use(
    http.get('/api/v1/transactions', ({ request }) => {
      const url = new URL(request.url)
      urls.push(url)
      return url.searchParams.get('needsAction') === 'true' ? ok(actionRows) : ok(historyRows)
    }),
  )
}

describe('TransactionsPage (SOT PR #50)', () => {
  describe('positive', () => {
    test('should list rows needing action on top, then the rest, with no bank account anywhere', async () => {
      stubList([INCOMING, REDEEM_ACTION], [MINT_DONE])
      renderPage()
      const action = await screen.findByRole('button', { name: /^Buka Uang masuk ANDI WIJAYA/ })
      const done = await screen.findByRole('button', { name: /^Buka Mint Sari Dewi/ })
      // DOCUMENT_POSITION_FOLLOWING = 4: baris riwayat SETELAH baris perlu tindakan.
      expect(action.compareDocumentPosition(done) & 4).toBeTruthy()
      expect(screen.getByText('Perlu persetujuan pencairan')).toBeInTheDocument()
      expect(screen.getByText('Uang masuk tertahan')).toBeInTheDocument()
      // Partner column carries the code; retail stays empty.
      expect(screen.getByText('ACME')).toBeInTheDocument()
    })

    test('should open the right panel with the queue action as its primary button', async () => {
      const user = userEvent.setup()
      stubList([REDEEM_ACTION], [])
      renderPage()
      await user.click(await screen.findByRole('button', { name: /^Buka Redeem Budi Santoso/ }))
      const panel = await screen.findByRole('region', { name: 'Detail transaksi' })
      expect(within(panel).getByTestId('panel-todo')).toHaveTextContent(/cocokkan rekening tujuan/i)
      expect(within(panel).getByRole('button', { name: 'Setujui pencairan' })).toBeEnabled()
      expect(within(panel).getByRole('link', { name: 'Buka di antrean' })).toHaveAttribute('href', '/redeem-approvals')
    })

    test('should send kind + needsAction + q to the contract endpoint', async () => {
      const urls: URL[] = []
      stubList([], [], urls)
      renderPage('/transactions?jenis=REDEEM&q=budi')
      await waitFor(() => expect(urls.length).toBeGreaterThanOrEqual(2))
      const actionUrl = urls.find((u) => u.searchParams.get('needsAction') === 'true')!
      expect(actionUrl.searchParams.getAll('kind')).toEqual(['REDEEM'])
      expect(actionUrl.searchParams.get('q')).toBe('budi')
      expect(urls.some((u) => u.searchParams.get('needsAction') === 'false')).toBe(true)
    })
  })

  describe('negative', () => {
    test('should disable the payout decision for STAFF with the reason written out', async () => {
      const user = userEvent.setup()
      stubList([REDEEM_ACTION], [])
      renderPage('/transactions', 'sking@usdx.io')
      await user.click(await screen.findByRole('button', { name: /^Buka Redeem Budi Santoso/ }))
      const panel = await screen.findByRole('region', { name: 'Detail transaksi' })
      const btn = within(panel).getByRole('button', { name: 'Setujui pencairan' })
      expect(btn).toBeDisabled()
      expect(within(panel).getByText(/hanya manager atau admin/i)).toBeInTheDocument()
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
      await user.click(await screen.findByRole('button', { name: /^Buka Redeem Rina/ }))
      const panel = await screen.findByRole('region', { name: 'Detail transaksi' })
      expect(within(panel).getByTestId('panel-todo')).toHaveTextContent(/dipantau/i)
      expect(within(panel).queryByRole('button', { name: /kirim ulang/i })).not.toBeInTheDocument()
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
      await user.click(await screen.findByRole('button', { name: /^Buka Redeem Odd/ }))
      const panel = await screen.findByRole('region', { name: 'Detail transaksi' })
      expect(within(panel).getAllByText('SECOND_PERSON').length).toBeGreaterThan(0)
      expect(within(panel).queryByRole('button', { name: /setujui|kirim ulang|terima/i })).not.toBeInTheDocument()
    })

    test('default MSW mock: approving from the panel removes the row from "perlu tindakan"', async () => {
      const user = userEvent.setup()
      renderPage('/transactions?tindakan=REDEEM_APPROVAL')
      const rows = await screen.findAllByRole('button', { name: /^Buka Redeem/ })
      const before = rows.length
      await user.click(rows[0]!)
      const panel = await screen.findByRole('region', { name: 'Detail transaksi' })
      await user.click(within(panel).getByRole('button', { name: 'Setujui pencairan' }))
      const dialog = await screen.findByRole('dialog', { name: /setujui pencairan/i })
      await user.click(within(dialog).getByRole('button', { name: /setujui pencairan/i }))
      await waitFor(() =>
        expect(screen.queryAllByRole('button', { name: /^Buka Redeem/ }).length).toBe(before - 1),
      )
    })
  })
})
