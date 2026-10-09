import { describe, test, expect, vi, beforeAll, afterAll, afterEach } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import MobileNavDrawer from '@/components/layout/MobileNavDrawer'
import { renderWithProviders } from '@/test/test-utils'
import { server } from '@/mocks/server'

// USDX-27: laci menu ponsel. Redesain fase 1: isinya `NavTree` yang SAMA dengan
// Sidebar — lima menu, tiga grup yang bisa dilipat, angka antrean yang sama.

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function renderOpen(path = '/transactions', staffId = 'stf_1', onOpenChange = vi.fn()) {
  return {
    onOpenChange,
    ...renderWithProviders(<MobileNavDrawer open onOpenChange={onOpenChange} />, {
      initialEntries: [path],
      staffId,
    }),
  }
}

describe('MobileNavDrawer', () => {
  describe('positive', () => {
    test('should render the same five menus as the sidebar, with the original lockup', () => {
      renderOpen()
      const dialog = screen.getByRole('dialog')
      expect(dialog.querySelector('img[src="/image/logo-lockup.png"]')).not.toBeNull()
      expect(screen.getByRole('link', { name: /^Transaksi/ })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /^OTC/ })).toBeInTheDocument()
      for (const g of ['Nasabah', 'Keuangan', 'Pengaturan']) {
        expect(screen.getByRole('button', { name: new RegExp(`^${g}`) })).toBeInTheDocument()
      }
      expect(screen.getByRole('button', { name: /keluar/i })).toBeInTheDocument()
    })

    test('should close the drawer after a link is followed', async () => {
      const user = userEvent.setup()
      const { onOpenChange } = renderOpen()
      await user.click(screen.getByRole('button', { name: /^Pengaturan/ }))
      fireEvent.click(screen.getByRole('link', { name: 'Mode Mint' }))
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })

    test('should show the queue count from the shared queue-counts request', async () => {
      server.use(
        http.get('/api/v1/queue-counts', () =>
          HttpResponse.json({
            status: 'success',
            metadata: null,
            data: { redeemApprovalsOpen: 2, payoutFailuresOpen: 1, heldCreditsOpen: 0, approvalsOpen: 0 },
          }),
        ),
      )
      renderOpen()
      expect(await screen.findByTestId('nav-badge-transactions')).toHaveTextContent('3')
    })
  })

  describe('negative', () => {
    test('should not render OTC for STAFF', () => {
      renderOpen('/transactions', 'stf_4')
      expect(screen.queryByRole('link', { name: /^OTC/ })).not.toBeInTheDocument()
    })

    test('should not render the removed menus', () => {
      renderOpen()
      for (const old of [/^Beranda/, /^Mint OTC/, /^Burn OTC/, /^Antrean Tanda Tangan/]) {
        expect(screen.queryByRole('link', { name: old })).not.toBeInTheDocument()
      }
    })
  })

  describe('edge cases', () => {
    test('should open the group of the current page on arrival', () => {
      renderOpen('/staff')
      expect(screen.getByRole('button', { name: /^Pengaturan/ })).toHaveAttribute('aria-expanded', 'true')
      expect(screen.getByRole('link', { name: 'Staf & Peran' })).toHaveAttribute('aria-current', 'page')
    })
  })
})
