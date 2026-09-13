import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router'
import { server } from '@/mocks/server'
import { resetMockData } from '@/mocks/handlers'
import { PAYOUT_FAILURE_MOCK_IDS as IDS } from '@/mocks/data'
import PayoutFailuresPage from '@/features/payout-failures/PayoutFailuresPage'
import { renderWithProviders } from '@/test/test-utils'

// USDX-662 — detail satu order bermasalah lewat rute `/payout-failures/:id`.
// Peran: stf_2 MANAGER · stf_4 STAFF.

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  server.events.removeAllListeners()
  resetMockData()
})
afterAll(() => server.close())

function setup(path: string, staffId = 'stf_2') {
  return renderWithProviders(
    <Routes>
      <Route path="/payout-failures" element={<PayoutFailuresPage />} />
      <Route path="/payout-failures/:id" element={<PayoutFailuresPage />} />
    </Routes>,
    { initialEntries: [path], staffId },
  )
}

async function openDialog(path: string, staffId?: string) {
  setup(path, staffId)
  const dialog = await screen.findByRole('dialog')
  await within(dialog).findByTestId('payout-failure-net-idr')
  return dialog
}

describe('PayoutFailureDetailModal @ USDX-662', () => {
  describe('positive', () => {
    test('should show every submission with its rejection, the full account and the burn link', async () => {
      const dialog = await openDialog(`/payout-failures/${IDS.failedRejected}`)
      const subs = within(dialog).getByTestId('submissions')
      expect(within(subs).getByText('RDM260912A1B2C3')).toBeInTheDocument()
      expect(within(subs).getByText(/Ditolak .* Invalid beneficiary account/)).toBeInTheDocument()
      expect(within(dialog).getByText('Satu percobaan, terbukti ditolak provider.')).toBeInTheDocument()
      expect(within(dialog).getByText('8730012245')).toBeInTheDocument()
      const link = await within(dialog).findByRole('link', { name: /0xc1c1/ })
      expect(link).toHaveAttribute('href', `https://polygonscan.com/tx/0x${'c1'.repeat(32)}`)
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    })

    test('should keep the review of an earlier RESENT visible when the order failed again', async () => {
      const dialog = await openDialog(`/payout-failures/${IDS.failedAfterResend}`)
      const reviews = within(dialog).getByTestId('reviews')
      expect(within(reviews).getByText('Dikirim ulang')).toBeInTheDocument()
      expect(within(reviews).getByText('oleh Linda Chen')).toBeInTheDocument()
      expect(within(dialog).getByText('Semua 2 percobaan terbukti ditolak provider.')).toBeInTheDocument()
    })

    test('should open the detail from a row click in the queue', async () => {
      const user = userEvent.setup()
      setup('/payout-failures')
      await user.click(await screen.findByRole('button', { name: /Buka detail pencairan RINA SUSANTI/ }))
      const dialog = await screen.findByRole('dialog')
      expect(await within(dialog).findByText('RDM260912A1B2C3')).toBeInTheDocument()
    })
  })

  describe('negative', () => {
    test('should say plainly that no transfer was ever submitted', async () => {
      const dialog = await openDialog(`/payout-failures/${IDS.burnRejected}`)
      expect(within(dialog).getByTestId('submissions-empty')).toHaveTextContent(
        'Belum pernah ada transfer yang diserahkan ke provider',
      )
    })

    test('should explain PAYOUT_STUCK is read-only and flag the not-yet-final attempt', async () => {
      const dialog = await openDialog(`/payout-failures/${IDS.stuck}`)
      expect(within(dialog).getByTestId('stuck-readonly')).toHaveTextContent(/masih mungkin berangkat/)
      expect(within(dialog).getByText(/belum terbukti ditolak/)).toBeInTheDocument()
    })

    test('should tell STAFF that resolving is for Manager and Admin', async () => {
      const dialog = await openDialog(`/payout-failures/${IDS.failedRejected}`, 'stf_4')
      expect(within(dialog).getByTestId('role-readonly')).toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    test('should turn a 404 into a sentence, not a blank modal', async () => {
      setup('/payout-failures/019f0000-0000-7000-8000-000000000000')
      const dialog = await screen.findByRole('dialog')
      expect(await within(dialog).findByRole('alert')).toHaveTextContent(
        'Order ini tidak ada di antrean Pencairan Bermasalah',
      )
    })

    test('should close back to the queue with its filter kept', async () => {
      const user = userEvent.setup()
      setup(`/payout-failures/${IDS.burnRejected}?issueKind=BURN_REJECTED`)
      const dialog = await screen.findByRole('dialog')
      await user.click(within(dialog).getAllByRole('button', { name: 'Tutup' })[0]!)
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      expect(screen.queryByText('RINA SUSANTI')).not.toBeInTheDocument()
      expect(screen.getByText('DEWI KARTIKA')).toBeInTheDocument()
    })
  })
})
