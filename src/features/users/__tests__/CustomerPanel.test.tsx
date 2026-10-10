import { describe, test, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { resetMockData } from '@/mocks/handlers'
import CustomerPanel from '@/features/users/CustomerPanel'
import { labelNasabah } from '@/features/users/labelNasabah'
import { customerSummary } from '@/lib/customerSummary'
import { renderWithProviders } from '@/test/test-utils'
import type { PhaseOneUser } from '@/lib/types'

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  resetMockData()
})
afterAll(() => server.close())

function buatNasabah(over: Partial<PhaseOneUser> = {}): PhaseOneUser {
  return {
    id: '019e1aa8-9c7c-7fcd-6abc-deadbeef0001',
    name: 'Robert Deon',
    email: 'robert.deon@example.com',
    phone: null,
    entityType: 'INDIVIDUAL',
    kycStatus: 'VERIFIED',
    suspended: false,
    emailVerifiedAt: '2026-05-01T01:00:00.000Z',
    activationEmailFailedAt: null,
    notes: null,
    wallets: [],
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
    ...over,
  }
}

function render(user: PhaseOneUser, { canManage = true, onClose = vi.fn(), onEdit = vi.fn() } = {}) {
  renderWithProviders(
    <Routes>
      <Route path="/users" element={<CustomerPanel user={user} canManage={canManage} onClose={onClose} onEdit={onEdit} />} />
      <Route path="/transactions" element={<div>HALAMAN TRANSAKSI</div>} />
      <Route path="/verifikasi" element={<div>HALAMAN VERIFIKASI</div>} />
      <Route path="/users/:id" element={<div>PROFIL LENGKAP</div>} />
    </Routes>,
    { initialEntries: ['/users'], authenticated: true },
  )
  return { onClose, onEdit }
}

describe('customerSummary', () => {
  describe('positive', () => {
    test('should send a pending KYC to Verifikasi as the one action', () => {
      const s = customerSummary(buatNasabah({ kycStatus: 'PENDING' }))
      expect(s).toMatchObject({ primary: 'verification', status: { label: 'Menunggu verifikasi', tone: 'act' } })
      expect(s.todo.needsAction).toBe(true)
    })

    test('should say nothing needs doing for a verified customer', () => {
      expect(customerSummary(buatNasabah()).todo.text).toBe('Tidak perlu tindakan.')
    })
  })

  describe('negative', () => {
    test('should rank a frozen account above everything else', () => {
      const s = customerSummary(
        buatNasabah({ suspended: true, kycStatus: 'PENDING', activationEmailFailedAt: '2026-05-02T00:00:00Z' }),
      )
      expect(s.status).toEqual({ label: 'Dibekukan', tone: 'bad' })
    })

    test('should rank a failed activation email above a pending KYC', () => {
      const s = customerSummary(buatNasabah({ kycStatus: 'PENDING', activationEmailFailedAt: '2026-05-02T00:00:00Z' }))
      expect(s.status.label).toBe('Email aktivasi gagal')
      expect(s.primary).toBe('profile')
    })
  })

  describe('edge cases', () => {
    test('should not leak an unknown KYC enum into the label', () => {
      const s = customerSummary(buatNasabah({ kycStatus: 'ODD' as PhaseOneUser['kycStatus'] }))
      expect(s.status.label).toBe('Status belum dikenali')
    })
  })
})

describe('CustomerPanel', () => {
  describe('positive', () => {
    test('should summarise the customer with facts and a sentence history', () => {
      render(buatNasabah({ wallets: [{ id: 'w1', chain: 'polygon', address: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed' } as PhaseOneUser['wallets'][number]] }))
      const panel = screen.getByRole('region', { name: 'Detail nasabah' })
      expect(within(panel).getByRole('heading', { name: 'Robert Deon' })).toBeInTheDocument()
      expect(within(panel).getByText('robert.deon@example.com')).toBeInTheDocument()
      expect(within(panel).getByText('Nasabah mengaktifkan akun lewat email')).toBeInTheDocument()
      expect(within(panel).getByText('0x5aAe…eAed')).toBeInTheDocument()
      // Pengecualian ops-fokus: wallet nasabah ringkas + tombol salin.
      expect(within(panel).getByRole('button', { name: /salin alamat wallet/i })).toBeInTheDocument()
    })

    test('should open the customer transactions from the primary button', async () => {
      const user = userEvent.setup()
      render(buatNasabah())
      await user.click(screen.getByRole('button', { name: 'Lihat transaksinya' }))
      expect(screen.getByText('HALAMAN TRANSAKSI')).toBeInTheDocument()
    })

    test('should delete inline after "Hapus ...?" names the customer', async () => {
      const user = userEvent.setup()
      const deleted: string[] = []
      server.use(
        http.delete('/api/v1/users/:id', ({ params }) => {
          deleted.push(String(params.id))
          return new HttpResponse(null, { status: 204 })
        }),
      )
      const { onClose } = render(buatNasabah())
      await user.click(screen.getByRole('button', { name: /lainnya/i }))
      await user.click(await screen.findByRole('menuitem', { name: 'Hapus nasabah' }))
      expect(screen.getByText('Hapus Robert Deon?')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Ya, hapus nasabah' }))
      await waitFor(() => expect(deleted).toEqual(['019e1aa8-9c7c-7fcd-6abc-deadbeef0001']))
      await waitFor(() => expect(onClose).toHaveBeenCalled())
    })
  })

  describe('negative', () => {
    test('should not offer edit/delete to roles that cannot manage customers', async () => {
      const user = userEvent.setup()
      render(buatNasabah(), { canManage: false })
      await user.click(screen.getByRole('button', { name: /lainnya/i }))
      expect(await screen.findByRole('menuitem', { name: 'Buka profil lengkap' })).toBeInTheDocument()
      expect(screen.queryByRole('menuitem', { name: 'Hapus nasabah' })).not.toBeInTheDocument()
      expect(screen.queryByRole('menuitem', { name: 'Ubah data nasabah' })).not.toBeInTheDocument()
    })

    test('a null name falls back to the email in the delete sentence, never "null"', async () => {
      const user = userEvent.setup()
      render(buatNasabah({ name: null }))
      await user.click(screen.getByRole('button', { name: /lainnya/i }))
      await user.click(await screen.findByRole('menuitem', { name: 'Hapus nasabah' }))
      const kalimat = screen.getByText(/dihapus dari back-office/)
      expect(kalimat).toHaveTextContent('robert.deon@example.com')
      expect(kalimat).not.toHaveTextContent(/\bnull\b/)
    })
  })

  describe('edge cases', () => {
    test('nama DAN email kosong jatuh ke potongan id, bukan string kosong', () => {
      expect(labelNasabah(buatNasabah({ name: null, email: '' }))).toBe('nasabah 019e1aa8…0001')
    })

    test('nama dipangkas spasi di ujungnya', () => {
      expect(labelNasabah(buatNasabah({ name: '  Robert Deon  ' }))).toBe('Robert Deon')
    })

    test('should point a pending KYC to Verifikasi', async () => {
      const user = userEvent.setup()
      render(buatNasabah({ kycStatus: 'PENDING' }))
      await user.click(screen.getByRole('button', { name: 'Periksa verifikasinya' }))
      expect(screen.getByText('HALAMAN VERIFIKASI')).toBeInTheDocument()
    })
  })
})
