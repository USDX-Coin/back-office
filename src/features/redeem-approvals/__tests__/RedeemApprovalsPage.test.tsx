import { describe, test, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { toast } from 'sonner'
import { server } from '@/mocks/server'
import { configureRedeemApprovalControlsForTests, resetMockData } from '@/mocks/handlers'
import RedeemApprovalsPage from '@/features/redeem-approvals/RedeemApprovalsPage'
import { renderWithProviders } from '@/test/test-utils'
import type { RedeemApprovalListItem } from '@/lib/types'

// USDX-669 — antrean Persetujuan Pencairan (`sot/api/redeem-approvals.yaml`).
//
// Endpointnya DILAYANI MSW (backend USDX-668 dikerjakan paralel), jadi tes ini
// memakai handler bawaan — termasuk keadaannya: approve benar-benar mengeluarkan
// baris dari antrean, dan approve kedua benar-benar menjawab `409`. Tiruan yang
// tanpa keadaan akan membuat tes "baris hilang setelah approve" hijau tanpa
// membuktikan bahwa daftarnya benar-benar ditarik ulang.
//
// Peran: stf_1 ADMIN · stf_2 MANAGER (Linda Chen) · stf_3 DEVELOPER · stf_4 STAFF.

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  server.events.removeAllListeners()
  resetMockData()
  vi.restoreAllMocks()
})
afterAll(() => server.close())

/** Baris tertua pada data tiruan — antrean urut `burnedAt` ASC, jadi ia di atas. */
const OLDEST_CUSTOMER = 'Fajar Ramadhan'
/** Baris dengan nama menurut bank BERBEDA dari nama pada order. */
const MISMATCH_CUSTOMER = 'Dewi Kartika'
const MISMATCH_BANK_NAME = 'SRI WAHYUNI'

function setup(staffId = 'stf_2') {
  return renderWithProviders(<RedeemApprovalsPage />, {
    initialEntries: ['/redeem-approvals'],
    staffId,
  })
}

/** Catat tiap permintaan yang keluar, supaya "tidak ada panggilan API" bisa diuji. */
function recordRequests() {
  const seen: string[] = []
  server.events.on('request:start', ({ request }) => {
    seen.push(`${request.method} ${new URL(request.url).pathname}`)
  })
  return seen
}

function row(overrides: Partial<RedeemApprovalListItem> = {}): RedeemApprovalListItem {
  return {
    id: 'rdm_1',
    orderNumber: 'RDM260913AB01',
    customerName: 'Budi Santoso',
    userEmail: 'budi@example.com',
    amountUsdx: '95.000000',
    netPayoutIdr: '1520150.00',
    bankCode: '014',
    bankName: 'BCA',
    bankAccountNumber: '5271884213',
    bankAccountName: 'BUDI SANTOSO',
    burnedAt: '2026-09-13T02:00:00.000Z',
    burnTxHash: '0xfeed000000000000000000000000000000000000000000000000000000001234',
    ownerType: 'RETAIL',
    ...overrides,
  }
}

function okList(rows: RedeemApprovalListItem[]) {
  return HttpResponse.json({
    status: 'success',
    metadata: { page: 1, limit: 10, total: rows.length },
    data: rows,
  })
}

describe('RedeemApprovalsPage @ USDX-669', () => {
  describe('positive', () => {
    test('should render the queue with the full account number and the exact payout amount', async () => {
      setup()

      expect(await screen.findByText(OLDEST_CUSTOMER)).toBeInTheDocument()
      // Nomor rekening PENUH, tidak dipotong dan tidak disamarkan — inilah nilai
      // yang ops diminta cocokkan, dan `***` membuat gerbang ini teater.
      expect(screen.getByText('0010144778')).toBeInTheDocument()
      // Nominal diformat dari STRING, tanpa melewati float.
      expect(screen.getByText('Rp 15.881.400,00')).toBeInTheDocument()
    })

    test('should put the oldest burn at the top — fairness, not newest-first', async () => {
      setup()
      await screen.findByText(OLDEST_CUSTOMER)
      const rows = screen.getAllByRole('row')
      // rows[0] = header
      expect(within(rows[1]!).getByText(OLDEST_CUSTOMER)).toBeInTheDocument()
    })

    test('should approve through the API and drop the row from the refetched queue', async () => {
      const user = userEvent.setup()
      const seen = recordRequests()
      setup()
      await screen.findByText(OLDEST_CUSTOMER)

      // Baris pertama = burn tertua. Handler MSW bawaan yang dipakai di sini,
      // bukan stub sekali pakai: ia menyimpan keputusan, jadi hilangnya baris
      // membuktikan daftarnya ditarik ulang dari server.
      await user.click(
        screen.getAllByRole('button', { name: /Setujui pencairan RDM/i })[0]!,
      )
      const dialog = await screen.findByRole('dialog')
      await user.click(within(dialog).getByRole('button', { name: /^Setujui pencairan$/ }))

      // Baris hilang HANYA kalau daftarnya benar-benar ditarik ulang setelah
      // mutasi — bukan karena komponen membuangnya sendiri secara optimistis.
      await waitFor(() => {
        expect(screen.queryByText(OLDEST_CUSTOMER)).not.toBeInTheDocument()
      })
      expect(seen.filter((r) => /POST .*\/approve$/.test(r))).toHaveLength(1)
      expect(seen.filter((r) => r === 'GET /api/v1/redeem-approvals').length).toBeGreaterThan(1)
    })

    test('should reject with a reason and drop the row from the queue', async () => {
      const user = userEvent.setup()
      const seen = recordRequests()
      setup()
      await screen.findByText(OLDEST_CUSTOMER)

      await user.click(screen.getAllByRole('button', { name: /Tolak pencairan RDM/i })[0]!)
      const dialog = await screen.findByRole('dialog')
      await user.type(
        within(dialog).getByLabelText('Alasan penolakan'),
        'Nomor rekening tidak cocok dengan berkas KYC',
      )
      await user.click(within(dialog).getByRole('button', { name: /^Tolak pencairan$/ }))

      await waitFor(() => {
        expect(screen.queryByText(OLDEST_CUSTOMER)).not.toBeInTheDocument()
      })
      expect(seen.filter((r) => /POST .*\/reject$/.test(r))).toHaveLength(1)
    })

    test('should flag a bank-owner name that differs from the name on the order', async () => {
      // Perbedaan itu sendiri informasi yang ops butuhkan, jadi kedua nama harus
      // terbaca — bukan salah satunya.
      server.use(
        http.get('/api/v1/redeem-approvals', () =>
          okList([
            row({
              customerName: MISMATCH_CUSTOMER,
              bankAccountName: MISMATCH_BANK_NAME,
            }),
          ]),
        ),
      )
      setup()
      await screen.findByText(MISMATCH_CUSTOMER)
      expect(
        screen.getByText(`${MISMATCH_BANK_NAME} — beda dari nama pada order`),
      ).toBeInTheDocument()
    })

    test('should say so when the bank name matches the name on the order', async () => {
      // "Cocok" juga informasi: ia satu pemeriksaan yang lolos, dan diamnya layar
      // akan terbaca sebagai "belum diperiksa".
      const user = userEvent.setup()
      server.use(http.get('/api/v1/redeem-approvals', () => okList([row()])))
      setup()
      await screen.findByText('Budi Santoso')

      await user.click(screen.getByRole('button', { name: /Setujui pencairan RDM/i }))
      const dialog = await screen.findByRole('dialog')
      expect(
        within(dialog).getByText('Nama pada order dan nama menurut bank sama.'),
      ).toBeInTheDocument()
      expect(within(dialog).queryByTestId('payout-name-mismatch')).not.toBeInTheDocument()
    })

    test('should link the burn hash straight to the block explorer from the row', async () => {
      // Kolomnya ada DI TABEL, bukan hanya di dialog: menariknya lewat `GET /:id`
      // per baris berarti satu baris `pii_access_audit` per baris — mencatat akses
      // PII untuk orang yang tidak sedang membuka PII siapa pun.
      server.use(http.get('/api/v1/redeem-approvals', () => okList([row()])))
      setup()
      await screen.findByText('Budi Santoso')

      const link = await screen.findByRole('link', { name: /0xfeed0000/ })
      expect(link).toHaveAttribute(
        'href',
        'https://polygonscan.com/tx/0xfeed000000000000000000000000000000000000000000000000000000001234',
      )
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    })

    test('should mark a partner order — it passes through the same gate', async () => {
      server.use(
        http.get('/api/v1/redeem-approvals', () =>
          okList([row({ ownerType: 'PARTNER', customerName: 'PT Nusantara Remit' })]),
        ),
      )
      setup()
      await screen.findByText('PT Nusantara Remit')
      expect(screen.getByText('Partner')).toBeInTheDocument()
    })

    test('should say in the approve dialog that approving is not sending', async () => {
      const user = userEvent.setup()
      server.use(http.get('/api/v1/redeem-approvals', () => okList([row()])))
      setup()
      await screen.findByText('Budi Santoso')

      await user.click(screen.getByRole('button', { name: /Setujui pencairan RDM/i }))
      const dialog = await screen.findByRole('dialog')
      // Menyetujui hanya membuka gerbang; pengirimannya milik Disbursement
      // Trigger pada tick berikutnya. Dialog tidak boleh menjanjikan "terkirim".
      expect(within(dialog).getByText(/sistem mengirim dananya pada pemeriksaan berikutnya/i)).toBeInTheDocument()
      expect(
        within(dialog).getByTestId('approve-irreversible-warning'),
      ).toHaveTextContent(/tidak bisa ditarik kembali/i)
    })

    test('should tell the reject dialog reader that the order lands in the payout-failures queue', async () => {
      const user = userEvent.setup()
      server.use(http.get('/api/v1/redeem-approvals', () => okList([row()])))
      setup()
      await screen.findByText('Budi Santoso')

      await user.click(screen.getByRole('button', { name: /Tolak pencairan RDM/i }))
      const dialog = await screen.findByRole('dialog')
      const consequences = within(dialog).getByTestId('reject-consequences')
      expect(consequences).toHaveTextContent(/Pencairan Bermasalah/)
      // Nasabah tidak dinotifikasi otomatis (D22-e) — diam soal ini membuat
      // penolakan terasa selesai padahal ada orang yang menunggu tanpa kabar.
      expect(consequences).toHaveTextContent(/tidak diberi tahu otomatis/i)
    })
  })

  describe('negative', () => {
    test('should not render the action buttons for STAFF', async () => {
      setup('stf_4')
      await screen.findByText(OLDEST_CUSTOMER)
      expect(screen.queryByRole('button', { name: /Setujui pencairan RDM/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Tolak pencairan RDM/i })).not.toBeInTheDocument()
      expect(screen.getByText('Hanya bisa melihat')).toBeInTheDocument()
    })

    test('should not render the action buttons for DEVELOPER', async () => {
      setup('stf_3')
      await screen.findByText(OLDEST_CUSTOMER)
      expect(screen.queryByRole('button', { name: /Setujui pencairan RDM/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Tolak pencairan RDM/i })).not.toBeInTheDocument()
    })

    test('should hold a reject with no reason — button disabled, nothing sent', async () => {
      const user = userEvent.setup()
      const seen = recordRequests()
      server.use(http.get('/api/v1/redeem-approvals', () => okList([row()])))
      setup()
      await screen.findByText('Budi Santoso')

      await user.click(screen.getByRole('button', { name: /Tolak pencairan RDM/i }))
      const dialog = await screen.findByRole('dialog')
      const submit = within(dialog).getByRole('button', { name: /^Tolak pencairan$/ })
      expect(submit).toBeDisabled()

      await user.click(submit)
      expect(seen.some((r) => /\/reject$/.test(r))).toBe(false)
    })

    test('should still hold a reject whose reason is only whitespace', async () => {
      const user = userEvent.setup()
      const seen = recordRequests()
      server.use(http.get('/api/v1/redeem-approvals', () => okList([row()])))
      setup()
      await screen.findByText('Budi Santoso')

      await user.click(screen.getByRole('button', { name: /Tolak pencairan RDM/i }))
      const dialog = await screen.findByRole('dialog')
      await user.type(within(dialog).getByLabelText('Alasan penolakan'), '     ')
      expect(within(dialog).getByRole('button', { name: /^Tolak pencairan$/ })).toBeDisabled()
      expect(seen.some((r) => /\/reject$/.test(r))).toBe(false)
    })

    test('should show a 403 as a sentence naming the roles, not the raw error', async () => {
      const user = userEvent.setup()
      const errSpy = vi.spyOn(toast, 'error')
      server.use(
        http.get('/api/v1/redeem-approvals', () => okList([row()])),
        // Kode galatnya sengaja tak terduga: backend USDX-668 belum merge, jadi
        // pesan manusianya harus bersandar pada STATUS, bukan pada ejaan kodenya.
        http.post('/api/v1/redeem-approvals/:id/reject', () =>
          HttpResponse.json(
            {
              status: 'error',
              metadata: null,
              data: null,
              error: { code: 'SOMETHING_ELSE', message: 'Forbidden resource' },
            },
            { status: 403 },
          ),
        ),
      )
      setup()
      await screen.findByText('Budi Santoso')

      await user.click(screen.getByRole('button', { name: /Tolak pencairan RDM/i }))
      const dialog = await screen.findByRole('dialog')
      await user.type(
        within(dialog).getByLabelText('Alasan penolakan'),
        'Rekening tujuan bukan milik nasabah',
      )
      await user.click(within(dialog).getByRole('button', { name: /^Tolak pencairan$/ }))

      await waitFor(() => expect(errSpy).toHaveBeenCalled())
      const message = String(errSpy.mock.calls[0]?.[0])
      expect(message).toMatch(/Manager dan Admin/)
      expect(message).not.toMatch(/Forbidden resource|SOMETHING_ELSE|403/)
    })
  })

  describe('edge cases', () => {
    test('should explain an empty queue by naming the active threshold', async () => {
      // Antrean kosong punya DUA sebab yang terlihat identik: tidak ada pencairan,
      // atau ambangnya melewatkan semuanya. "Tidak ada data" menyamakan keduanya.
      configureRedeemApprovalControlsForTests({
        approvalThresholdIdr: '50000000.00',
        updatedAt: '2026-09-12T10:00:00.000Z',
        updatedByName: 'Linda Chen',
      })
      server.use(http.get('/api/v1/redeem-approvals', () => okList([])))
      setup()

      expect(
        await screen.findByText(/Tidak ada pencairan yang menunggu persetujuan/),
      ).toBeInTheDocument()
      expect(screen.getByText(/Ambang aktif Rp 50\.000\.000,00/)).toBeInTheDocument()
    })

    test('should say the queue will fill when the threshold is 0', async () => {
      server.use(http.get('/api/v1/redeem-approvals', () => okList([])))
      setup()
      expect(await screen.findByText(/Ambangnya 0/)).toBeInTheDocument()
    })

    test('should NOT claim the threshold is 0 when the controls endpoint failed', async () => {
      // Cabang ini yang membuat layar berbohong sebelum diperbaiki: `threshold`
      // `undefined` jatuh ke kalimat "ambangnya 0, semua akan muncul di sini", dan
      // ops menyimpulkan tidak ada yang menunggu — padahal ambangnya bisa Rp 50
      // juta dan rupiah sedang keluar tanpa dilihat siapa pun.
      server.use(
        http.get('/api/v1/redeem-approvals', () => okList([])),
        http.get('/api/v1/redeem-approval-controls', () =>
          HttpResponse.json(
            {
              status: 'error',
              metadata: null,
              data: null,
              error: { code: 'INTERNAL', message: 'boom' },
            },
            { status: 500 },
          ),
        ),
      )
      setup()

      expect(await screen.findByText(/Ambang aktif belum diketahui/)).toBeInTheDocument()
      expect(screen.queryByText(/Ambangnya 0/)).not.toBeInTheDocument()
      // Kartu di atas mengatakan hal yang sama — satu layar, satu keadaan.
      expect(screen.getByText(/Ambang aktif gagal dimuat/)).toBeInTheDocument()
    })

    test('should turn a second approval into ALREADY_APPROVED guidance, not a raw 409', async () => {
      const user = userEvent.setup()
      const errSpy = vi.spyOn(toast, 'error')
      server.use(
        // Daftarnya tetap memuat barisnya (mis. tab lain sudah menyetujuinya),
        // supaya tombolnya masih ada untuk ditekan — persis keadaan yang membuat
        // dua staf masing-masing mengira dialah yang melepasnya.
        http.get('/api/v1/redeem-approvals', () => okList([row()])),
        http.post('/api/v1/redeem-approvals/:id/approve', () =>
          HttpResponse.json(
            {
              status: 'error',
              metadata: null,
              data: null,
              error: { code: 'ALREADY_APPROVED', message: 'already approved' },
            },
            { status: 409 },
          ),
        ),
      )
      setup()
      await screen.findByText('Budi Santoso')

      await user.click(screen.getByRole('button', { name: /Setujui pencairan RDM/i }))
      const dialog = await screen.findByRole('dialog')
      await user.click(within(dialog).getByRole('button', { name: /^Setujui pencairan$/ }))

      await waitFor(() => expect(errSpy).toHaveBeenCalled())
      const message = String(errSpy.mock.calls[0]?.[0])
      expect(message).toMatch(/sudah disetujui/i)
      expect(message).toMatch(/Pencairan Bermasalah/)
    })

    test('should keep the approve button usable when the fee breakdown fails to load', async () => {
      // Nominal, bank dan rekening — seluruh dasar keputusannya — ada di baris
      // antrean. Mematikan tombol karena satu blok penjelas gagal dimuat menahan
      // pencairan nasabah atas alasan yang tidak ada hubungannya dengan mereka.
      const user = userEvent.setup()
      server.use(
        http.get('/api/v1/redeem-approvals', () => okList([row()])),
        http.get('/api/v1/redeem-approvals/:id', () =>
          HttpResponse.json(
            {
              status: 'error',
              metadata: null,
              data: null,
              error: { code: 'INTERNAL', message: 'boom' },
            },
            { status: 500 },
          ),
        ),
      )
      setup()
      await screen.findByText('Budi Santoso')

      await user.click(screen.getByRole('button', { name: /Setujui pencairan RDM/i }))
      const dialog = await screen.findByRole('dialog')
      expect(
        await within(dialog).findByText(/Rincian kurs dan biaya gagal dimuat/),
      ).toBeInTheDocument()
      expect(
        within(dialog).getByRole('button', { name: /^Setujui pencairan$/ }),
      ).toBeEnabled()
      // Nominal tetap terbaca dari baris antrean.
      expect(within(dialog).getByTestId('payout-net-idr')).toHaveTextContent('Rp 1.520.150,00')
    })

    test('should say a missing burn hash is unrecorded, not that the burn never happened', async () => {
      // Antrean ini HANYA memuat order yang sudah `BURNED`. Em dash telanjang akan
      // terbaca sebagai "belum dibakar", dan ops lalu menahan pencairan atas
      // alasan yang tidak ada. Barisnya juga harus tetap utuh — tombol keputusan
      // masih dirender.
      server.use(
        http.get('/api/v1/redeem-approvals', () => okList([row({ burnTxHash: null })])),
      )
      setup()
      await screen.findByText('Budi Santoso')

      expect(screen.getByText('belum tercatat')).toBeInTheDocument()
      expect(screen.queryByRole('link', { name: /0x/ })).not.toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: /Setujui pencairan RDM/i }),
      ).toBeInTheDocument()
    })

    test('should render the hash without a link when the chain cannot be inferred', async () => {
      // Dua rantai terkonfigurasi dan baris antrean tidak membawa `chain`-nya:
      // menebak mengirim ops ke explorer yang salah, yang menjawab "transaksi
      // tidak ditemukan" untuk burn yang sebenarnya ada.
      server.use(
        http.get('/api/v1/redeem-approvals', () => okList([row()])),
        http.get('/api/v1/chains', () =>
          HttpResponse.json({
            status: 'success',
            metadata: null,
            data: [
              {
                chain: 'polygon',
                chainId: 137,
                name: 'Polygon',
                blockExplorerUrl: 'https://polygonscan.com',
                staffSafeAddress: '0x1',
                managerSafeAddress: '0x2',
                usdxAddress: '0x3',
              },
              {
                chain: 'base',
                chainId: 8453,
                name: 'Base',
                blockExplorerUrl: 'https://basescan.org',
                staffSafeAddress: '0x4',
                managerSafeAddress: '0x5',
                usdxAddress: '0x6',
              },
            ],
          }),
        ),
      )
      setup()
      await screen.findByText('Budi Santoso')

      // Hash tetap terbaca (dipendekkan, penuh di `title`) tapi tidak tertaut.
      expect(await screen.findByTitle(row().burnTxHash!)).toBeInTheDocument()
      expect(screen.queryByRole('link', { name: /0xfeed0000/ })).not.toBeInTheDocument()
    })

    test('should clear the typed reason when the dialog moves to another order', async () => {
      // Alasan yang tertinggal akan ditulis ke `payout_issue_reason` order LAIN,
      // dan itulah satu-satunya keterangan yang dibaca ops yang menuntaskannya.
      const user = userEvent.setup()
      server.use(
        http.get('/api/v1/redeem-approvals', () =>
          okList([
            row({ id: 'rdm_1', orderNumber: 'RDM26A', customerName: 'Satu' }),
            row({ id: 'rdm_2', orderNumber: 'RDM26B', customerName: 'Dua' }),
          ]),
        ),
      )
      setup()
      await screen.findByText('Satu')

      await user.click(screen.getByRole('button', { name: /Tolak pencairan RDM26A/i }))
      let dialog = await screen.findByRole('dialog')
      await user.type(
        within(dialog).getByLabelText('Alasan penolakan'),
        'alasan milik order pertama',
      )
      await user.click(within(dialog).getByRole('button', { name: /^Batal$/ }))

      await user.click(await screen.findByRole('button', { name: /Tolak pencairan RDM26B/i }))
      dialog = await screen.findByRole('dialog')
      expect(within(dialog).getByLabelText('Alasan penolakan')).toHaveValue('')
    })
  })
})
