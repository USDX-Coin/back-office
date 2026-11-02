import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router'
import { server } from '@/mocks/server'
import { resetMockData } from '@/mocks/handlers'
import MintSwapsPage from '@/features/mint-swaps/MintSwapsPage'
import { renderWithProviders } from '@/test/test-utils'

// D29 / USDX-792 — daftar "Swap IDR→USD" + detail riwayat (§ 21.9).

const RUDI = '019f5d01-0792-7c31-9b2d-000000000005'

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  server.events.removeAllListeners()
  resetMockData()
})
afterAll(() => server.close())

function setup(path = '/swap-idr-usd') {
  return renderWithProviders(
    <Routes>
      <Route path="/swap-idr-usd" element={<MintSwapsPage />} />
      <Route path="/swap-idr-usd/:id" element={<MintSwapsPage />} />
    </Routes>,
    { initialEntries: [path], staffId: 'stf_2' },
  )
}

function recordQueries() {
  const seen: string[] = []
  server.events.on('request:start', ({ request }) => {
    const url = new URL(request.url)
    if (url.pathname === '/api/v1/mint-swaps') seen.push(url.search)
  })
  return seen
}

describe('MintSwapsPage @ USDX-792', () => {
  describe('positive', () => {
    test('should list every status with a text label', async () => {
      setup()
      expect(await screen.findByText('Hendra Gunawan')).toBeInTheDocument()
      expect(screen.getAllByText('Berhasil ditukar').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Menunggu dikirim').length).toBeGreaterThan(0)
    })

    test('should send status + WIB dates from the URL', async () => {
      const seen = recordQueries()
      setup('/swap-idr-usd?status=SUCCEEDED&from=2026-10-01&to=2026-10-31')
      await waitFor(() => expect(seen.some((q) => q.includes('status=SUCCEEDED') && q.includes('from=2026-10-01') && q.includes('to=2026-10-31'))).toBe(true))
    })

    test('should show the final profit only after the PG batch matched', async () => {
      setup(`/swap-idr-usd/${RUDI}`)
      const m = await screen.findByTestId('mint-swap-modal')
      expect(await within(m).findByTestId('mint-swap-profit')).toHaveTextContent('Rp 41.860,00')
      expect(within(m).getByTestId('mint-swap-usd-difference')).toHaveTextContent('lebih $0,97')
      // Swap yang sudah berhasil tidak punya tombol aksi.
      expect(within(m).queryByRole('button', { name: 'Coba lagi' })).not.toBeInTheDocument()
    })

    test('should return focus to the row after the modal closes', async () => {
      const user = userEvent.setup()
      setup()
      const row = await screen.findByRole('button', { name: /Swap Rudi Hartono/ })
      row.focus()
      await user.keyboard('{Enter}')
      await screen.findByTestId('mint-swap-modal')
      await user.keyboard('{Escape}')
      await waitFor(() => expect(screen.queryByTestId('mint-swap-modal')).not.toBeInTheDocument())
      await waitFor(() => expect(document.activeElement?.getAttribute('data-row-id')).toBe(RUDI))
    })
  })

  describe('negative', () => {
    test('should not send an unknown status or an invalid range from a stale URL', async () => {
      const seen = recordQueries()
      setup('/swap-idr-usd?status=NOPE&from=2026-12-31&to=2026-01-01')
      await screen.findByText('Hendra Gunawan')
      expect(seen.every((q) => !q.includes('status=') && !q.includes('from='))).toBe(true)
      expect(screen.getByTestId('mint-swaps-rentang-bermasalah')).toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    test('should move between rows with the arrow keys without closing', async () => {
      const user = userEvent.setup()
      setup(`/swap-idr-usd/${RUDI}`)
      const m = await screen.findByTestId('mint-swap-modal')
      const before = (await within(m).findByTestId('record-modal-position')).textContent
      await user.keyboard('{ArrowUp}')
      await waitFor(() => expect(within(m).getByTestId('record-modal-position').textContent).not.toBe(before))
    })
  })
})
