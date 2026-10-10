import { describe, test, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes, useLocation } from 'react-router'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { resetMockData } from '@/mocks/handlers'
import CustomerModal from '@/features/users/CustomerModal'
import UsersPage from '@/features/users/UsersPage'
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
      <Route
        path="/users"
        element={
          <CustomerModal
            user={user}
            missingId={user.id}
            loading={false}
            canManage={canManage}
            onClose={onClose}
            onEdit={onEdit}
            nav={{ index: 0, total: 1 }}
          />
        }
      />
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

describe('CustomerModal', () => {
  describe('positive', () => {
    test('should summarise the customer in a centred modal: name, email, KYC, activation, wallet + copy', () => {
      render(buatNasabah({ wallets: [{ id: 'w1', chain: 'polygon', address: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed' } as PhaseOneUser['wallets'][number]] }))
      const modal = screen.getByTestId('customer-modal')
      expect(within(modal).getByRole('heading', { name: 'Robert Deon' })).toBeInTheDocument()
      expect(within(modal).getByText('robert.deon@example.com')).toBeInTheDocument()
      expect(within(modal).getByText('Nasabah mengaktifkan akun lewat email')).toBeInTheDocument()
      expect(within(modal).getAllByText('Terverifikasi').length).toBeGreaterThan(0)
      expect(within(modal).getByText('Aktif')).toBeInTheDocument()
      expect(within(modal).getByText('0x5aAe…eAed')).toBeInTheDocument()
      // Pengecualian ops-fokus: wallet nasabah ringkas + tombol salin.
      expect(within(modal).getByRole('button', { name: /salin alamat wallet/i })).toBeInTheDocument()
      // Footer: posisi ↑/↓ + profil lengkap selalu ada.
      expect(within(modal).getByTestId('record-modal-position')).toHaveTextContent('1 dari 1')
      expect(within(modal).getByRole('button', { name: 'Buka profil lengkap' })).toBeInTheDocument()
      expect(screen.queryByRole('region', { name: 'Detail nasabah' })).not.toBeInTheDocument()
    })

    test('should open the full profile page from "Buka profil lengkap"', async () => {
      const user = userEvent.setup()
      render(buatNasabah())
      await user.click(screen.getByRole('button', { name: 'Buka profil lengkap' }))
      expect(screen.getByText('PROFIL LENGKAP')).toBeInTheDocument()
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
      render(buatNasabah({ kycStatus: 'PENDING' }), { canManage: false })
      await user.click(screen.getByRole('button', { name: /lainnya/i }))
      expect(await screen.findByRole('menuitem', { name: 'Lihat transaksinya' })).toBeInTheDocument()
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

describe('UsersPage — klik baris = modal tengah', () => {
  function LocationProbe() {
    const loc = useLocation()
    return <div data-testid="lokasi">{loc.pathname + loc.search}</div>
  }

  const LIST = [
    buatNasabah({ id: 'usr_a', name: 'Ani Lestari', email: 'ani@example.com' }),
    buatNasabah({ id: 'usr_b', name: 'Budi Santoso', email: 'budi@example.com', kycStatus: 'PENDING' }),
    buatNasabah({ id: 'usr_c', name: 'Citra Dewi', email: 'citra@example.com' }),
  ]

  function renderPage(path = '/users') {
    const detailCalls: string[] = []
    server.use(
      http.get('/api/v1/users', () =>
        HttpResponse.json({ status: 'success', metadata: { page: 1, limit: 10, total: LIST.length }, data: LIST }),
      ),
      http.get('/api/v1/users/:id', ({ params }) => {
        detailCalls.push(String(params.id))
        return HttpResponse.json({ status: 'error', error: { code: 'NOT_FOUND', message: 'x' } }, { status: 404 })
      }),
    )
    renderWithProviders(
      <>
        <Routes>
          <Route path="/users" element={<UsersPage />} />
        </Routes>
        <LocationProbe />
      </>,
      { initialEntries: [path], authenticated: true },
    )
    return { detailCalls }
  }

  test('should open the summary modal at ?nasabah=:id without reading GET /users/:id, then move with ↓', async () => {
    const user = userEvent.setup()
    const { detailCalls } = renderPage()
    const rows = await screen.findAllByRole('button', { name: /^buka nasabah/i })
    await user.click(rows[0]!)
    const modal = await screen.findByTestId('customer-modal')
    expect(screen.getByTestId('lokasi').textContent).toMatch(/[?&]nasabah=/)
    expect(within(modal).getByTestId('record-modal-position')).toHaveTextContent(`1 dari ${rows.length}`)
    await user.keyboard('{ArrowDown}')
    await waitFor(() =>
      expect(within(screen.getByTestId('customer-modal')).getByTestId('record-modal-position')).toHaveTextContent(
        `2 dari ${rows.length}`,
      ),
    )
    // Baris yang ada di tabel tidak pernah memicu pembacaan teraudit.
    expect(detailCalls).toEqual([])
    expect(screen.queryByRole('region', { name: 'Detail nasabah' })).not.toBeInTheDocument()
  })

  test('should open the modal from a deep link, and still honour an old ?pilih= link', async () => {
    renderPage('/users?pilih=usr_b')
    const modal = await screen.findByTestId('customer-modal')
    expect(within(modal).getByRole('heading', { name: 'Budi Santoso' })).toBeInTheDocument()
    expect(within(modal).getByTestId('record-modal-position')).toHaveTextContent('2 dari 3')
  })
})
