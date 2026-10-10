import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { server } from '@/mocks/server'
import { getDefaultStaff, resetMockData } from '@/mocks/handlers'
import StaffPage from '@/features/staff/StaffPage'
import { renderWithProviders } from '@/test/test-utils'

// Sapu bersih 11 Okt 2026 — Staf & Peran ikut "klik baris = modal": ikon
// pensil/tong sampah per baris dihapus, Ubah / Nonaktifkan pindah ke footer
// `RecordModal` di `?staf=:id`.

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  resetMockData()
  localStorage.clear()
  document.cookie = 'usdx_session=; Path=/; Max-Age=0'
})
afterAll(() => server.close())

describe('StaffPage', () => {
  describe('positive', () => {
    test('should open the staff detail modal when a row is clicked', async () => {
      const user = userEvent.setup()
      renderWithProviders(<StaffPage />, { authenticated: true, initialEntries: ['/staff'] })
      const rows = await screen.findAllByRole('button', { name: /^buka staf /i })
      const second = rows[1]!
      const name = second.getAttribute('aria-label')!.replace(/^Buka staf /, '')
      await user.click(second)

      const modal = within(await screen.findByTestId('staff-modal'))
      expect(modal.getByRole('heading', { name })).toBeInTheDocument()
      expect(modal.getByTestId('record-modal-position')).toHaveTextContent(`2 dari ${rows.length}`)
      expect(modal.getByRole('button', { name: 'Ubah data staf' })).toBeInTheDocument()
    })

    test('should open the edit form from the modal footer', async () => {
      const user = userEvent.setup()
      renderWithProviders(<StaffPage />, { authenticated: true, initialEntries: ['/staff'] })
      await user.click((await screen.findAllByRole('button', { name: /^buka staf /i }))[1]!)
      await user.click(within(await screen.findByTestId('staff-modal')).getByRole('button', { name: 'Ubah data staf' }))
      expect(await screen.findByRole('dialog', { name: 'Ubah data staf' })).toBeInTheDocument()
    })

    test('should move to the next staff with the down arrow without closing', async () => {
      const user = userEvent.setup()
      renderWithProviders(<StaffPage />, { authenticated: true, initialEntries: ['/staff'] })
      await user.click((await screen.findAllByRole('button', { name: /^buka staf /i }))[0]!)
      const modal = within(await screen.findByTestId('staff-modal'))
      expect(modal.getByTestId('record-modal-position')).toHaveTextContent(/^1 dari/)
      await user.click(modal.getByRole('button', { name: 'Berikutnya' }))
      expect(within(await screen.findByTestId('staff-modal')).getByTestId('record-modal-position')).toHaveTextContent(/^2 dari/)
    })
  })

  describe('negative', () => {
    test('should not offer to deactivate your own account', async () => {
      const user = userEvent.setup()
      const self = getDefaultStaff()!
      renderWithProviders(<StaffPage />, { authenticated: true, initialEntries: [`/staff?staf=${self.id}`] })
      const modal = within(await screen.findByTestId('staff-modal'))
      await user.click(await modal.findByRole('button', { name: 'Lainnya' }))
      expect(await screen.findByRole('menuitem', { name: 'Akun sendiri tidak bisa dinonaktifkan' })).toHaveAttribute(
        'data-disabled',
      )
    })
  })

  describe('edge cases', () => {
    test('should say so when the linked staff is not in the list', async () => {
      renderWithProviders(<StaffPage />, { authenticated: true, initialEntries: ['/staff?staf=tidak-ada'] })
      expect(await screen.findByRole('heading', { name: 'Staf tidak ditemukan' })).toBeInTheDocument()
    })

    test('should no longer render per-row edit/delete icons', async () => {
      renderWithProviders(<StaffPage />, { authenticated: true, initialEntries: ['/staff'] })
      await screen.findAllByRole('button', { name: /^buka staf /i })
      expect(screen.queryByRole('button', { name: /^ubah /i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /^nonaktifkan /i })).not.toBeInTheDocument()
    })
  })
})
