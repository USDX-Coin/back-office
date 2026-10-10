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
      const modal = await screen.findByTestId('transaction-modal')
      expect(within(modal).getByRole('heading', { name: 'Budi Santoso' })).toBeInTheDocument()
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
