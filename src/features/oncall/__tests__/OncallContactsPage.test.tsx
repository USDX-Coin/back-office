import { describe, test, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { server } from '@/mocks/server'
import { resetMockData, findStaffByEmail, issueMockJwt } from '@/mocks/handlers'
import OncallContactsPage from '@/features/oncall/OncallContactsPage'
import { renderWithProviders } from '@/test/test-utils'

// USDX-485 (audit alur uang P1-18) — halaman setting kontak on-call insiden uang.
//
// Kenapa halaman ini ada: alarm kondisi uang (#220/#224/#235) sudah sampai ke kanal
// eksternal, tapi tak ada yang tahu siapa yang mengangkat. Backend membaca daftar ini
// saat mengirim alarm; halaman ini yang membuatnya bisa diperbarui tanpa deploy.

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  resetMockData()
  localStorage.clear()
  document.cookie = 'usdx_session=; Path=/; Max-Age=0'
})
afterAll(() => server.close())

function loginAsStaffRole(email: string) {
  const staff = findStaffByEmail(email)
  if (!staff) throw new Error(`Test fixture missing: ${email}`)
  localStorage.setItem(
    'usdx_auth_user',
    JSON.stringify({ version: 5, staff, issuedAt: Date.now() }),
  )
  document.cookie = `usdx_session=${issueMockJwt(staff)}; Path=/`
  return staff
}

async function openAddForm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /tambah kontak/i }))
  return within(await screen.findByRole('dialog'))
}

describe('OncallContactsPage @integration', () => {
  describe('positive', () => {
    test('should list the registered on-call contacts with role, channel and categories', async () => {
      renderWithProviders(<OncallContactsPage />, { authenticated: true })

      expect(await screen.findByText('Budi Santoso')).toBeInTheDocument()
      expect(screen.getByText(/ops lead/i)).toBeInTheDocument()
      expect(screen.getAllByText(/pencairan/i).length).toBeGreaterThan(0)
    })

    test('should add a contact and show it in the list', async () => {
      const user = userEvent.setup()
      renderWithProviders(<OncallContactsPage />, { authenticated: true })
      await screen.findByText('Budi Santoso')

      const dialog = await openAddForm(user)
      await user.type(dialog.getByLabelText(/^nama$/i), 'Rina Kartika')
      await user.type(dialog.getByLabelText(/^jabatan$/i), 'Treasury')
      await user.type(dialog.getByLabelText(/^kontak$/i), 'rina@usdx.io')
      await user.click(dialog.getByRole('checkbox', { name: /rekonsiliasi/i }))
      await user.click(dialog.getByRole('button', { name: /simpan kontak/i }))

      expect(await screen.findByText('Rina Kartika')).toBeInTheDocument()
    })

    test('should edit an existing contact', async () => {
      const user = userEvent.setup()
      renderWithProviders(<OncallContactsPage />, { authenticated: true })
      await screen.findByText('Budi Santoso')

      await user.click(screen.getByRole('button', { name: /ubah budi santoso/i }))
      const dialog = within(await screen.findByRole('dialog'))
      const roleInput = dialog.getByLabelText(/^jabatan$/i)
      await user.clear(roleInput)
      await user.type(roleInput, 'Head of Ops')
      await user.click(dialog.getByRole('button', { name: /simpan kontak/i }))

      expect(await screen.findByText(/head of ops/i)).toBeInTheDocument()
    })

    test('should delete a contact after confirmation', async () => {
      const user = userEvent.setup()
      renderWithProviders(<OncallContactsPage />, { authenticated: true })
      await screen.findByText('Budi Santoso')

      await user.click(screen.getByRole('button', { name: /hapus budi santoso/i }))
      const dialog = within(await screen.findByRole('dialog'))
      await user.click(dialog.getByRole('button', { name: /^hapus kontak$/i }))

      await waitFor(() => {
        expect(screen.queryByText('Budi Santoso')).not.toBeInTheDocument()
      })
    })
  })

  describe('negative', () => {
    test('should block submit and show field errors when the form is empty', async () => {
      const user = userEvent.setup()
      renderWithProviders(<OncallContactsPage />, { authenticated: true })
      await screen.findByText('Budi Santoso')

      const dialog = await openAddForm(user)
      await user.click(dialog.getByRole('button', { name: /simpan kontak/i }))

      expect(await dialog.findByText(/nama wajib diisi/i)).toBeInTheDocument()
      // Tidak ada baris baru yang masuk daftar.
      expect(screen.queryByText('Rina Kartika')).not.toBeInTheDocument()
    })

    test('should require at least one incident category', async () => {
      const user = userEvent.setup()
      renderWithProviders(<OncallContactsPage />, { authenticated: true })
      await screen.findByText('Budi Santoso')

      const dialog = await openAddForm(user)
      await user.type(dialog.getByLabelText(/^nama$/i), 'Rina Kartika')
      await user.type(dialog.getByLabelText(/^jabatan$/i), 'Treasury')
      await user.type(dialog.getByLabelText(/^kontak$/i), 'rina@usdx.io')
      await user.click(dialog.getByRole('button', { name: /simpan kontak/i }))

      expect(
        await dialog.findByText(/minimal satu kategori insiden/i),
      ).toBeInTheDocument()
    })

    test('should surface the backend 409 for a duplicate channel + contact value', async () => {
      const user = userEvent.setup()
      const errSpy = vi.spyOn(toast, 'error')
      renderWithProviders(<OncallContactsPage />, { authenticated: true })
      await screen.findByText('Budi Santoso')

      const dialog = await openAddForm(user)
      await user.type(dialog.getByLabelText(/^nama$/i), 'Duplikat')
      await user.type(dialog.getByLabelText(/^jabatan$/i), 'Ops')
      // Nilai yang sama persis dengan kontak PHONE yang sudah ada di mock.
      await user.type(dialog.getByLabelText(/^kontak$/i), '+6281234567890')
      await user.click(dialog.getByRole('checkbox', { name: /pencairan/i }))
      await user.click(dialog.getByRole('button', { name: /simpan kontak/i }))

      // Pesannya datang dari handler MSW (`src/mocks/handlers.ts`), di luar
      // lingkup terjemahan ini — teksnya masih bahasa Inggris dengan sengaja.
      await waitFor(() =>
        expect(errSpy).toHaveBeenCalledWith(
          'A contact with this channel and value is already registered.',
        ),
      )
      errSpy.mockRestore()
    })

    // Pagar utamanya: daftar ini menentukan siapa yang dipanggil saat uang bermasalah,
    // dan `contactValue` bisa berupa nomor telepon (PII → ADMIN saja, per tabel role di
    // conventions.md § Audit Akses PII). Non-ADMIN tidak boleh melihatnya, bukan sekadar
    // tidak boleh mengubahnya.
    test.each(['sking@usdx.io', 'marcus.a@usdx.io', 'linda.c@usdx.io'])(
      'should refuse to render the directory for non-admin %s',
      async (email) => {
        loginAsStaffRole(email)
        renderWithProviders(<OncallContactsPage />)

        expect(
          await screen.findByText(/tidak diizinkan membuka daftar kontak darurat/i),
        ).toBeInTheDocument()
        expect(screen.queryByText('Budi Santoso')).not.toBeInTheDocument()
        expect(screen.queryByText('+6281234567890')).not.toBeInTheDocument()
        expect(
          screen.queryByRole('button', { name: /tambah kontak/i }),
        ).not.toBeInTheDocument()
      },
    )
  })

  describe('edge cases', () => {
    test('should show an explicit warning when no contact is registered at all', async () => {
      const user = userEvent.setup()
      renderWithProviders(<OncallContactsPage />, { authenticated: true })
      await screen.findByText('Budi Santoso')

      // Kosongkan daftarnya lewat UI, lalu daftar kosong harus BERBUNYI —
      // bukan tabel kosong yang tak berkata apa-apa. Ini cermin perilaku
      // backend: nol kontak = alarm tetap terkirim, dengan peringatan.
      for (;;) {
        const buttons = screen.queryAllByRole('button', { name: /^hapus /i })
        if (buttons.length === 0) break
        await user.click(buttons[0]!)
        const dialog = within(await screen.findByRole('dialog'))
        await user.click(dialog.getByRole('button', { name: /^hapus kontak$/i }))
        await waitFor(() => {
          expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        })
      }

      const banner = await screen.findByRole('alert')
      expect(banner).toHaveTextContent(/belum ada satu pun kontak darurat yang terdaftar/i)
      expect(banner).toHaveTextContent(/belum ada kontak darurat terdaftar/i)
    })

    test('should keep the modal open and preserve values when the backend rejects', async () => {
      const user = userEvent.setup()
      const errSpy = vi.spyOn(toast, 'error')
      renderWithProviders(<OncallContactsPage />, { authenticated: true })
      await screen.findByText('Budi Santoso')

      const dialog = await openAddForm(user)
      await user.type(dialog.getByLabelText(/^nama$/i), 'Duplikat')
      await user.type(dialog.getByLabelText(/^jabatan$/i), 'Ops')
      await user.type(dialog.getByLabelText(/^kontak$/i), '+6281234567890')
      await user.click(dialog.getByRole('checkbox', { name: /pencairan/i }))
      await user.click(dialog.getByRole('button', { name: /simpan kontak/i }))

      await waitFor(() => expect(errSpy).toHaveBeenCalled())
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(dialog.getByLabelText(/^nama$/i)).toHaveValue('Duplikat')
      errSpy.mockRestore()
    })

    test('should list every incident category the backend understands', async () => {
      const user = userEvent.setup()
      renderWithProviders(<OncallContactsPage />, { authenticated: true })
      await screen.findByText('Budi Santoso')

      const dialog = await openAddForm(user)
      for (const category of [
        'Pencairan',
        'Rekonsiliasi',
        'Mint',
        'Redeem',
        'Penipuan',
        'Keamanan',
        'Infrastruktur',
        // USDX-632 — zona kunci custodial (alert WALLET_* dari backend/wallet-service)
        'Custodial',
        'Lainnya',
      ]) {
        expect(
          dialog.getByRole('checkbox', { name: new RegExp(`^${category}$`, 'i') }),
        ).toBeInTheDocument()
      }
    })
  })
})
