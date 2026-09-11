import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { Route, Routes, Link } from 'react-router'
import { server } from '@/mocks/server'
import {
  configureMintModeForTests,
  findStaffByEmail,
  issueMockJwt,
  resetMockData,
} from '@/mocks/handlers'
import MainLayout from '@/components/layout/MainLayout'
import MintModePage from '@/features/mint-mode/MintModePage'
import { renderWithProviders } from '@/test/test-utils'

// USDX-639 — kartu Mode Mint + banner merah global. AC ditulis sebagai alur
// yang dilalui operator (sot/workflow.md § Acceptance Criteria FE), bukan
// sebagai pemeriksaan komponen.

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  resetMockData()
})
afterAll(() => server.close())

function loginAs(email: string) {
  const staff = findStaffByEmail(email)
  if (!staff) throw new Error(`Test fixture missing: ${email}`)
  localStorage.setItem(
    'usdx_auth_user',
    JSON.stringify({ version: 5, staff, issuedAt: Date.now() }),
  )
  document.cookie = `usdx_session=${issueMockJwt(staff)}; Path=/`
  return staff
}

const MANAGER = 'linda.c@usdx.io'
const STAFF = 'sking@usdx.io'
const DEVELOPER = 'marcus.a@usdx.io'

function seedTestMode(overrides: Partial<Parameters<typeof configureMintModeForTests>[0]> = {}) {
  configureMintModeForTests({
    mode: 'TEST',
    reason: 'Uji bayar produksi bersama DurianPay',
    expiresAt: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
    updatedBy: '00000000-0000-7000-8000-00000000000a',
    updatedByName: 'Linda Chen',
    allowedEmails: ['budi@usdx.io'],
    updatedAt: new Date().toISOString(),
    ...overrides,
  })
}

const REASON = 'Uji bayar produksi bersama DurianPay'

describe('MintModePage @integration', () => {
  describe('AC: buka halaman → kartu menampilkan mode aktif + alasan + waktu berakhir', () => {
    test('mode uji aktif → kartu memuat keempat keterangannya', async () => {
      loginAs(MANAGER)
      seedTestMode()
      renderWithProviders(<MintModePage />)

      expect(await screen.findByLabelText(/mode mint aktif/i)).toHaveTextContent(/mode uji/i)
      expect(screen.getByText(/uji bayar produksi bersama durianpay/i)).toBeInTheDocument()
      expect(screen.getByText('Linda Chen')).toBeInTheDocument()
      expect(screen.getByLabelText(/mode uji berakhir/i)).toHaveTextContent(/WIB/)
    })

    test('mode PROD → kartu berkata PROD dan waktu berakhir kosong, bukan tanggal palsu', async () => {
      loginAs(MANAGER)
      renderWithProviders(<MintModePage />)

      expect(await screen.findByLabelText(/mode mint aktif/i)).toHaveTextContent('PROD')
      expect(screen.queryByLabelText(/mode uji berakhir/i)).not.toBeInTheDocument()
    })
  })

  describe('AC: MANAGER menggeser ke uji tanpa alasan → simpan tidak aktif', () => {
    test('tombol simpan mati sampai alasan DAN durasi terisi', async () => {
      const user = userEvent.setup()
      loginAs(MANAGER)
      renderWithProviders(<MintModePage />)

      await user.click(await screen.findByRole('button', { name: /geser ke mode uji/i }))
      const dialog = await screen.findByRole('dialog')
      const submit = within(dialog).getByRole('button', { name: /geser ke mode uji/i })
      expect(submit).toBeDisabled()

      // Durasi saja belum cukup — alasan yang wajib.
      await user.type(within(dialog).getByLabelText(/durasi \(jam\)/i), '2')
      expect(submit).toBeDisabled()

      await user.type(within(dialog).getByLabelText(/alasan/i), REASON)
      expect(submit).toBeEnabled()
    })

    test('durasi di atas 24 jam menahan simpan', async () => {
      const user = userEvent.setup()
      loginAs(MANAGER)
      renderWithProviders(<MintModePage />)

      await user.click(await screen.findByRole('button', { name: /geser ke mode uji/i }))
      const dialog = await screen.findByRole('dialog')
      await user.type(within(dialog).getByLabelText(/alasan/i), REASON)
      await user.type(within(dialog).getByLabelText(/durasi \(jam\)/i), '25')
      expect(
        within(dialog).getByRole('button', { name: /geser ke mode uji/i }),
      ).toBeDisabled()
    })
  })

  describe('AC: berhasil geser ke uji → banner merah muncul di SEMUA halaman', () => {
    test('banner bertahan setelah pindah rute', async () => {
      const user = userEvent.setup()
      loginAs(MANAGER)
      renderWithProviders(
        <Routes>
          <Route element={<MainLayout />}>
            <Route
              path="/settings/mint-mode"
              element={
                <>
                  <MintModePage />
                  <Link to="/other">pindah halaman</Link>
                </>
              }
            />
            <Route path="/other" element={<p>HALAMAN LAIN</p>} />
          </Route>
        </Routes>,
        { initialEntries: ['/settings/mint-mode'] },
      )

      expect(await screen.findByLabelText(/mode mint aktif/i)).toHaveTextContent('PROD')
      expect(screen.queryByTestId('mint-test-mode-banner')).not.toBeInTheDocument()

      await user.click(await screen.findByRole('button', { name: /geser ke mode uji/i }))
      const dialog = await screen.findByRole('dialog')
      await user.type(within(dialog).getByLabelText(/alasan/i), REASON)
      await user.type(within(dialog).getByLabelText(/durasi \(jam\)/i), '2')
      await user.click(within(dialog).getByRole('button', { name: /geser ke mode uji/i }))

      const banner = await screen.findByTestId('mint-test-mode-banner')
      expect(banner).toHaveTextContent(/mint mencetak token uji, bukan USDX/i)
      expect(banner).toHaveTextContent(/Berakhir \d{2}:\d{2} WIB/)
      // Tidak ada jalan menutupnya — itu inti tiketnya.
      expect(within(banner).queryByRole('button')).not.toBeInTheDocument()

      // Pindah rute: MainLayout tetap terpasang, banner ikut.
      await user.click(screen.getByRole('link', { name: /pindah halaman/i }))
      expect(await screen.findByText('HALAMAN LAIN')).toBeInTheDocument()
      expect(screen.queryByLabelText(/mode mint aktif/i)).not.toBeInTheDocument()
      expect(screen.getByTestId('mint-test-mode-banner')).toBeInTheDocument()
    })
  })

  describe('AC: STAFF membuka halaman', () => {
    test('tidak ada tombol ke mode uji, tapi tombol kembali ke PROD tersedia', async () => {
      loginAs(STAFF)
      seedTestMode()
      renderWithProviders(<MintModePage />)

      expect(await screen.findByRole('button', { name: /kembali ke prod/i })).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: /geser ke mode uji/i }),
      ).not.toBeInTheDocument()
    })

    test('pada mode PROD, STAFF melihat keterangan siapa yang boleh menggeser', async () => {
      loginAs(STAFF)
      renderWithProviders(<MintModePage />)

      expect(
        await screen.findByText(/hanya manager dan admin yang bisa menggeser/i),
      ).toBeInTheDocument()
    })

    test('STAFF mematikan mode uji → kartu kembali ke PROD', async () => {
      const user = userEvent.setup()
      loginAs(STAFF)
      seedTestMode()
      renderWithProviders(<MintModePage />)

      await user.click(await screen.findByRole('button', { name: /kembali ke prod/i }))
      const dialog = await screen.findByRole('dialog')
      await user.click(within(dialog).getByRole('button', { name: /kembali ke prod/i }))

      await waitFor(() => {
        expect(screen.getByLabelText(/mode mint aktif/i)).toHaveTextContent('PROD')
      })
    })
  })

  describe('AC: waktu berakhir lewat → setelah refetch kembali ke PROD', () => {
    test('jendela yang sudah lewat tidak lagi dilaporkan sebagai mode uji', async () => {
      loginAs(MANAGER)
      // Jendela yang berakhir semenit lalu: server yang memutuskan, bukan
      // jam browser, jadi jawaban GET berikutnya sudah PROD.
      seedTestMode({ expiresAt: new Date(Date.now() - 60_000).toISOString() })
      renderWithProviders(<MintModePage />)

      expect(await screen.findByLabelText(/mode mint aktif/i)).toHaveTextContent('PROD')
      expect(screen.queryByTestId('mint-test-mode-banner')).not.toBeInTheDocument()
    })
  })

  describe('AC: backend 422 (env uji kurang) → daftar env tampil, mode tidak berubah', () => {
    test('pesan server + daftar env dirender di dalam dialog', async () => {
      const user = userEvent.setup()
      loginAs(MANAGER)
      server.use(
        http.post('/api/v1/mint-mode', () =>
          HttpResponse.json(
            {
              status: 'error',
              metadata: null,
              data: null,
              error: {
                code: 'VALIDATION_ERROR',
                message: 'Env mode uji belum lengkap',
                details: ['MINT_TEST_SAFE_ADDRESS', 'MINT_TEST_TOKEN_ADDRESS'],
              },
            },
            { status: 422 },
          ),
        ),
      )
      renderWithProviders(<MintModePage />)

      await user.click(await screen.findByRole('button', { name: /geser ke mode uji/i }))
      const dialog = await screen.findByRole('dialog')
      await user.type(within(dialog).getByLabelText(/alasan/i), REASON)
      await user.type(within(dialog).getByLabelText(/durasi \(jam\)/i), '2')
      await user.click(within(dialog).getByRole('button', { name: /geser ke mode uji/i }))

      expect(await within(dialog).findByText(/env mode uji belum lengkap/i)).toBeInTheDocument()
      expect(within(dialog).getByText('MINT_TEST_SAFE_ADDRESS')).toBeInTheDocument()
      expect(within(dialog).getByText('MINT_TEST_TOKEN_ADDRESS')).toBeInTheDocument()
      // Dialog tetap terbuka dan mode tidak bergeser.
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByLabelText(/mode mint aktif/i)).toHaveTextContent('PROD')
      expect(screen.queryByTestId('mint-test-mode-banner')).not.toBeInTheDocument()
    })

    test('422 tanpa daftar env tetap menampilkan pesan server apa adanya', async () => {
      const user = userEvent.setup()
      loginAs(MANAGER)
      server.use(
        http.post('/api/v1/mint-mode', () =>
          HttpResponse.json(
            {
              status: 'error',
              metadata: null,
              data: null,
              error: { code: 'VALIDATION_ERROR', message: 'MINT_TEST_RPC_URL belum diset' },
            },
            { status: 422 },
          ),
        ),
      )
      renderWithProviders(<MintModePage />)

      await user.click(await screen.findByRole('button', { name: /geser ke mode uji/i }))
      const dialog = await screen.findByRole('dialog')
      await user.type(within(dialog).getByLabelText(/alasan/i), REASON)
      await user.type(within(dialog).getByLabelText(/durasi \(jam\)/i), '1')
      await user.click(within(dialog).getByRole('button', { name: /geser ke mode uji/i }))

      expect(
        await within(dialog).findByText(/MINT_TEST_RPC_URL belum diset/i),
      ).toBeInTheDocument()
    })
  })

  // ── Tambahan lingkup 11 Sep 2026: daftar akses saat mode uji ──────────────
  describe('AC: nyalakan mode uji dengan 2 email → kartu menampilkan keduanya', () => {
    test('kedua alamat terbaca di kartu tanpa membuka dialog', async () => {
      const user = userEvent.setup()
      loginAs(MANAGER)
      renderWithProviders(<MintModePage />)

      await user.click(await screen.findByRole('button', { name: /geser ke mode uji/i }))
      const dialog = await screen.findByRole('dialog')
      await user.type(within(dialog).getByLabelText(/alasan/i), REASON)
      await user.type(within(dialog).getByLabelText(/durasi \(jam\)/i), '2')

      const emailInput = within(dialog).getByLabelText(/email yang boleh mint/i)
      await user.type(emailInput, 'budi@usdx.io{Enter}')
      await user.type(emailInput, 'siti@usdx.io')
      await user.click(within(dialog).getByRole('button', { name: /^tambah$/i }))

      await user.click(within(dialog).getByRole('button', { name: /geser ke mode uji/i }))

      const list = await screen.findByTestId('allowed-emails-list')
      expect(within(list).getByText('budi@usdx.io')).toBeInTheDocument()
      expect(within(list).getByText('siti@usdx.io')).toBeInTheDocument()
    })

    test('alamat yang sama dua kali hanya masuk sekali', async () => {
      const user = userEvent.setup()
      loginAs(MANAGER)
      renderWithProviders(<MintModePage />)

      await user.click(await screen.findByRole('button', { name: /geser ke mode uji/i }))
      const dialog = await screen.findByRole('dialog')
      const emailInput = within(dialog).getByLabelText(/email yang boleh mint/i)
      await user.type(emailInput, 'budi@usdx.io{Enter}')
      await user.type(emailInput, 'BUDI@usdx.io{Enter}')

      const draft = within(dialog).getByTestId('allowed-emails-draft')
      expect(within(draft).getAllByRole('listitem')).toHaveLength(1)
    })
  })

  describe('AC: email berformat salah → tombol simpan tidak aktif', () => {
    test('alamat setengah jadi di kotak menahan simpan sampai diperbaiki', async () => {
      const user = userEvent.setup()
      loginAs(MANAGER)
      renderWithProviders(<MintModePage />)

      await user.click(await screen.findByRole('button', { name: /geser ke mode uji/i }))
      const dialog = await screen.findByRole('dialog')
      await user.type(within(dialog).getByLabelText(/alasan/i), REASON)
      await user.type(within(dialog).getByLabelText(/durasi \(jam\)/i), '2')
      const submit = within(dialog).getByRole('button', { name: /geser ke mode uji/i })
      expect(submit).toBeEnabled()

      await user.type(within(dialog).getByLabelText(/email yang boleh mint/i), 'budi@usdx')
      expect(within(dialog).getByText(/format email tidak valid/i)).toBeInTheDocument()
      expect(submit).toBeDisabled()

      await user.type(within(dialog).getByLabelText(/email yang boleh mint/i), '.io')
      expect(submit).toBeEnabled()
    })

    test('alamat salah tidak bisa ditambahkan ke daftar', async () => {
      const user = userEvent.setup()
      loginAs(MANAGER)
      renderWithProviders(<MintModePage />)

      await user.click(await screen.findByRole('button', { name: /geser ke mode uji/i }))
      const dialog = await screen.findByRole('dialog')
      await user.type(within(dialog).getByLabelText(/email yang boleh mint/i), 'bukan-email{Enter}')

      expect(within(dialog).queryByTestId('allowed-emails-draft')).not.toBeInTheDocument()
      expect(within(dialog).getByTestId('allowed-emails-empty-warning')).toBeInTheDocument()
    })
  })

  describe('AC: nyalakan tanpa email → boleh, tapi diperingatkan', () => {
    test('peringatan "kosong = tidak ada yang bisa mint" tampil dan simpan tetap hidup', async () => {
      const user = userEvent.setup()
      loginAs(MANAGER)
      renderWithProviders(<MintModePage />)

      await user.click(await screen.findByRole('button', { name: /geser ke mode uji/i }))
      const dialog = await screen.findByRole('dialog')
      const warning = within(dialog).getByTestId('allowed-emails-empty-warning')
      expect(warning).toHaveTextContent(/TIDAK ADA yang bisa mint/i)
      // Kalimatnya harus menutup tafsir terbalik, bukan sekadar menyebut kosong.
      expect(warning).toHaveTextContent(/bukan berarti semua boleh/i)

      await user.type(within(dialog).getByLabelText(/alasan/i), REASON)
      await user.type(within(dialog).getByLabelText(/durasi \(jam\)/i), '2')
      expect(within(dialog).getByRole('button', { name: /geser ke mode uji/i })).toBeEnabled()
      await user.click(within(dialog).getByRole('button', { name: /geser ke mode uji/i }))

      // Kartu menyatakan akibatnya, bukan daftar nol baris.
      expect(await screen.findByTestId('allowed-emails-empty')).toHaveTextContent(
        /tidak ada satu pun user yang bisa mint/i,
      )
    })
  })

  describe('AC: kembali ke PROD → daftar tidak lagi ditampilkan', () => {
    test('daftar akses hilang dari kartu begitu mode kembali PROD', async () => {
      const user = userEvent.setup()
      loginAs(MANAGER)
      seedTestMode({ allowedEmails: ['budi@usdx.io', 'siti@usdx.io'] })
      renderWithProviders(<MintModePage />)

      expect(await screen.findByTestId('allowed-emails-list')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: /kembali ke prod/i }))
      const dialog = await screen.findByRole('dialog')
      await user.click(within(dialog).getByRole('button', { name: /kembali ke prod/i }))

      await waitFor(() => {
        expect(screen.getByLabelText(/mode mint aktif/i)).toHaveTextContent('PROD')
      })
      expect(screen.queryByTestId('allowed-emails-list')).not.toBeInTheDocument()
      expect(screen.queryByTestId('allowed-emails-empty')).not.toBeInTheDocument()
    })
  })

  describe('banner ikut menyebut pembatasan akses', () => {
    test('dengan daftar terisi, banner menyebut jumlahnya', async () => {
      loginAs(MANAGER)
      seedTestMode({ allowedEmails: ['budi@usdx.io', 'siti@usdx.io'] })
      renderWithProviders(
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/settings/mint-mode" element={<MintModePage />} />
          </Route>
        </Routes>,
        { initialEntries: ['/settings/mint-mode'] },
      )

      const banner = await screen.findByTestId('mint-test-mode-banner')
      expect(banner).toHaveTextContent(/mint mencetak token uji, bukan USDX/i)
      expect(banner).toHaveTextContent(/dibatasi ke 2 email/i)
    })

    test('dengan daftar kosong, banner berkata mint tertutup untuk semua user', async () => {
      loginAs(MANAGER)
      seedTestMode({ allowedEmails: [] })
      renderWithProviders(
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/settings/mint-mode" element={<MintModePage />} />
          </Route>
        </Routes>,
        { initialEntries: ['/settings/mint-mode'] },
      )

      expect(await screen.findByTestId('mint-test-mode-banner')).toHaveTextContent(
        /tertutup untuk semua user/i,
      )
    })
  })

  describe('gerbang role DEVELOPER (view-only)', () => {
    test('DEVELOPER tidak melihat satu pun tombol geser', async () => {
      loginAs(DEVELOPER)
      seedTestMode()
      renderWithProviders(<MintModePage />)

      expect(await screen.findByLabelText(/mode mint aktif/i)).toHaveTextContent(/mode uji/i)
      expect(
        screen.queryByRole('button', { name: /kembali ke prod/i }),
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: /geser ke mode uji/i }),
      ).not.toBeInTheDocument()
    })
  })
})

describe('POST /api/v1/mint-mode authorization (kontrak USDX-639)', () => {
  async function post(email: string | null, body: unknown) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (email) {
      const staff = findStaffByEmail(email)!
      headers.Authorization = `Bearer ${issueMockJwt(staff)}`
    }
    return fetch('/api/v1/mint-mode', { method: 'POST', headers, body: JSON.stringify(body) })
  }

  test('401 tanpa sesi', async () => {
    const res = await post(null, { mode: 'PROD' })
    expect(res.status).toBe(401)
  })

  test('403 saat STAFF mencoba menyalakan mode uji', async () => {
    const res = await post(STAFF, { mode: 'TEST', reason: 'coba', durationHours: 2 })
    expect(res.status).toBe(403)
    expect((await res.json()).error.code).toBe('FORBIDDEN')
  })

  test('403 saat DEVELOPER mencoba kembali ke PROD', async () => {
    const res = await post(DEVELOPER, { mode: 'PROD' })
    expect(res.status).toBe(403)
  })

  test('422 saat alasan kosong', async () => {
    const res = await post(MANAGER, { mode: 'TEST', reason: '   ', durationHours: 2 })
    expect(res.status).toBe(422)
  })

  test('422 saat durasi di atas 24 jam', async () => {
    const res = await post(MANAGER, {
      mode: 'TEST',
      reason: 'uji bayar produksi',
      durationHours: 25,
    })
    expect(res.status).toBe(422)
  })

  test('200 + MintModeConfig saat MANAGER menyalakan mode uji', async () => {
    const res = await post(MANAGER, {
      mode: 'TEST',
      reason: 'uji bayar produksi',
      durationHours: 2,
      allowedEmails: ['budi@usdx.io'],
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toMatchObject({
      mode: 'TEST',
      reason: 'uji bayar produksi',
      allowedEmails: ['budi@usdx.io'],
    })
    expect(typeof body.data.expiresAt).toBe('string')
    // sot/api/mint-mode.yaml: kartu membaca nama, bukan UUID.
    expect(typeof body.data.updatedByName).toBe('string')
  })

  test('422 saat alasan kurang dari 10 karakter (CHECK yang sama ada di DB)', async () => {
    const res = await post(MANAGER, { mode: 'TEST', reason: 'uji', durationHours: 2 })
    expect(res.status).toBe(422)
  })

  test('daftar kosong diterima apa adanya — artinya tidak ada yang bisa mint', async () => {
    const res = await post(MANAGER, {
      mode: 'TEST',
      reason: 'uji bayar produksi',
      durationHours: 2,
      allowedEmails: [],
    })
    expect(res.status).toBe(200)
    expect((await res.json()).data.allowedEmails).toEqual([])
  })
})

describe('GET /api/v1/mint-mode response shape', () => {
  test('membawa kelima field kontrak dalam envelope SoT', async () => {
    const res = await fetch('/api/v1/mint-mode')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('success')
    expect(body.data).toMatchObject({ mode: 'PROD' })
    expect(body.data).toHaveProperty('reason')
    expect(body.data).toHaveProperty('expiresAt')
    expect(body.data).toHaveProperty('updatedBy')
    expect(body.data).toHaveProperty('updatedByName')
    expect(body.data).toHaveProperty('allowedEmails')
    expect(body.data).toHaveProperty('updatedAt')
  })
})
