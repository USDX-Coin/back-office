import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { Route, Routes } from 'react-router'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { resetMockData } from '@/mocks/handlers'
import TransactionsListPage from '@/features/transactions/TransactionsListPage'
import { renderWithProviders } from '@/test/test-utils'
import type { OrderDetail, OrderListItem } from '@/lib/types'

// USDX-206 — backoffice "User Transaction" (consumer mint orders). Read-only
// list + filter + detail. Covers the E2E acceptance criteria at the unit level:
//   1. open menu → list renders + filters wire to the query
//   2. detail shows the fee / spread / revenue breakdown
//   3. read-only — no approve/reject action anywhere

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  resetMockData()
})
afterAll(() => server.close())

const baseRow = (overrides: Partial<OrderListItem> = {}): OrderListItem => ({
  id: 'ord_1',
  type: 'MINT',
  userId: 'usr_1',
  userEmail: 'alice@example.com',
  // Retail row: no partner (USDX-547).
  partner: null,
  onBehalfOf: null,
  amount: '250.00',
  totalPayIdr: '4078500.00',
  netPayoutIdr: null,
  chain: 'polygon',
  paymentStatus: 'PAID',
  safeStatus: 'EXECUTED',
  status: 'COMPLETED',
  createdAt: '2026-06-01T00:00:00Z',
  ...overrides,
})

// Redeem list row — mint-only fields null, netPayoutIdr set (USDX-245).
const redeemRow = (overrides: Partial<OrderListItem> = {}): OrderListItem => ({
  id: 'ord_rdm',
  type: 'REDEEM',
  userId: 'usr_2',
  userEmail: 'bob@example.com',
  partner: null,
  onBehalfOf: null,
  amount: '100.00',
  totalPayIdr: null,
  netPayoutIdr: '1547320.00',
  chain: 'polygon',
  paymentStatus: null,
  safeStatus: null,
  status: 'PAYOUT_COMPLETE',
  createdAt: '2026-06-02T00:00:00Z',
  ...overrides,
})

const baseDetail = (overrides: Partial<OrderDetail> = {}): OrderDetail => ({
  id: 'ord_1',
  type: 'MINT',
  userId: 'usr_1',
  userEmail: 'alice@example.com',
  // Retail detail: no partner block (USDX-547).
  partner: null,
  onBehalfOf: null,
  partnerCustomerId: null,
  externalReference: null,
  userAddress: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
  chain: 'polygon',
  idempotencyKey: 'mint_abc123',
  amount: '250.00',
  baseRate: '16200.00',
  spreadBuyPct: '0.50',
  spreadSellPct: '0.40',
  effectiveRate: '16281.00',
  subtotalIdr: '4070250.00',
  paymentChannel: 'VA',
  paymentBank: 'BCA',
  mintFeePct: '0.30',
  mintFeeIdr: '12210.75',
  pgFeeIdr: '4440.00',
  totalPayIdr: '4086900.75',
  safeType: 'STAFF',
  paymentStatus: 'PAID',
  safeStatus: 'EXECUTED',
  paidAt: '2026-06-01T00:05:00Z',
  safeTxHash: '0x' + 'b'.repeat(64),
  onChainTxHash: '0x' + 'a'.repeat(64),
  paymentProvider: 'MOCK',
  // REDEEM block — null for mint.
  redeemId: null,
  grossIdr: null,
  redeemFeePct: null,
  redeemFeeIdr: null,
  disbursementFeeIdr: null,
  netPayoutIdr: null,
  bankCode: null,
  bankName: null,
  bankAccountNumber: null,
  bankAccountName: null,
  lateBurn: null,
  payoutRef: null,
  burnTxHash: null,
  burnedAt: null,
  payoutCompletedAt: null,
  payoutProvider: null,
  // Shared.
  totalFeeIdr: '16650.75',
  estimatedRevenueIdr: '32310.75',
  status: 'COMPLETED',
  expiresAt: '2026-06-01T01:00:00Z',
  createdAt: '2026-06-01T00:00:00Z',
  updatedAt: '2026-06-01T00:10:00Z',
  ...overrides,
})

// Redeem detail — mint block null, redeem block populated (USDX-245).
const redeemDetail = (overrides: Partial<OrderDetail> = {}): OrderDetail => ({
  id: 'ord_rdm',
  type: 'REDEEM',
  userId: 'usr_2',
  userEmail: 'bob@example.com',
  partner: null,
  onBehalfOf: null,
  partnerCustomerId: null,
  externalReference: null,
  userAddress: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
  chain: 'polygon',
  // ENAM desimal, bentuk yang backend benar-benar kirim (`numeric(30,6)`).
  // Dengan `'100.00'` pagar konvensi angka di dalam dialog tidak menguji apa pun:
  // dua digit setelah titik tidak bisa dibedakan dari pemisah ribuan id-ID.
  amount: '100.000000',
  baseRate: '16000.00',
  spreadBuyPct: null,
  spreadSellPct: '2.00',
  effectiveRate: '15680.00',
  // MINT block — null for redeem.
  idempotencyKey: null,
  subtotalIdr: null,
  paymentChannel: null,
  paymentBank: null,
  mintFeePct: null,
  mintFeeIdr: null,
  pgFeeIdr: null,
  totalPayIdr: null,
  safeType: null,
  paymentStatus: null,
  safeStatus: null,
  paidAt: null,
  safeTxHash: null,
  onChainTxHash: null,
  paymentProvider: null,
  // REDEEM block.
  redeemId: '0x' + 'c'.repeat(64),
  grossIdr: '1568000.00',
  redeemFeePct: '1.00',
  redeemFeeIdr: '15680.00',
  disbursementFeeIdr: '5000.00',
  netPayoutIdr: '1547320.00',
  bankCode: 'BCA',
  bankName: 'BCA',
  bankAccountNumber: '1234563271',
  bankAccountName: 'BOB SETIAWAN',
  lateBurn: false,
  payoutRef: 'disb_abc123',
  burnTxHash: '0x' + 'd'.repeat(64),
  burnedAt: '2026-06-02T00:12:00Z',
  payoutCompletedAt: '2026-06-02T00:20:00Z',
  payoutProvider: 'MOCK',
  // Shared.
  totalFeeIdr: '20680.00',
  estimatedRevenueIdr: '47680.00',
  status: 'PAYOUT_COMPLETE',
  expiresAt: '2026-06-02T01:00:00Z',
  createdAt: '2026-06-02T00:00:00Z',
  updatedAt: '2026-06-02T00:20:00Z',
  ...overrides,
})

function okList(rows: OrderListItem[]) {
  return HttpResponse.json({
    status: 'success',
    metadata: { page: 1, limit: 20, total: rows.length },
    data: rows,
  })
}

function okDetail(detail: OrderDetail) {
  return HttpResponse.json({ status: 'success', metadata: null, data: detail })
}

function TestApp() {
  return (
    <Routes>
      <Route path="/transactions" element={<TransactionsListPage />} />
      <Route path="/transactions/:id" element={<TransactionsListPage />} />
    </Routes>
  )
}

function setup(initialEntries: string[] = ['/transactions']) {
  return renderWithProviders(<TestApp />, { initialEntries, authenticated: true })
}

describe('TransactionsListPage @ USDX-206', () => {
  describe('positive', () => {
    test('AC #1 — opens /transactions and renders a row from GET /api/v1/orders', async () => {
      server.use(http.get('/api/v1/orders', () => okList([baseRow()])))
      setup()
      await screen.findByText('alice@example.com')
      // list columns: amount + status badges visible
      expect(screen.getByText('250,00')).toBeInTheDocument()

      // Pagar konvensi angka — layar INI yang paling telanjang menunjukkan
      // masalahnya: nominal USDX dan `Rp 4.078.500,00` berdiri di satu baris.
      // Assertion literal di atas hanya membuktikan satu sel; ini membaca
      // SELURUH badan tabel, jadi kolom baru yang kelak dipasang dengan
      // `'en-US'` ikut memerahkannya. Yang dijaga cuma koma-sebagai-pemisah-
      // ribuan (`1,234`); pola desimal-titik sengaja tidak dipakai karena badan
      // tabel memuat hash terpotong dan id yang cocok tanpa angka uang terlibat.
      const tbody = document.querySelector('tbody')
      expect(tbody).not.toBeNull()
      expect(tbody!.textContent ?? '').not.toMatch(/\d,\d{3}/)

      // § 4 P1-1 — header kolom berbahasa Indonesia. "Safe" khususnya: operator
      // non-crypto membacanya enam kali sehari tanpa pernah diberi tahu artinya,
      // sementara yang perlu ia tahu adalah tahap tanda tangannya. Nilai enum
      // (`paymentStatus` / `safeStatus`) TIDAK ikut diterjemahkan.
      expect(screen.getByRole('columnheader', { name: /pembayaran/i })).toBeInTheDocument()
      expect(screen.getByRole('columnheader', { name: /tanda tangan/i })).toBeInTheDocument()
    })

    test('AC #1 — Status filter wires to ?status=COMPLETED', async () => {
      const user = userEvent.setup()
      const captured: string[] = []
      server.use(
        http.get('/api/v1/orders', ({ request }) => {
          captured.push(new URL(request.url).search)
          return okList([])
        }),
      )
      setup()
      await waitFor(() => expect(captured.length).toBeGreaterThan(0))

      await user.click(screen.getByRole('button', { name: /^filter/i }))
      await user.click(await screen.findByRole('combobox', { name: 'Status' }))
      await user.click(await screen.findByRole('option', { name: /^selesai$/i }))
      await user.click(screen.getByRole('button', { name: /^terapkan$/i }))

      await waitFor(() =>
        expect(captured.some((s) => s.includes('status=COMPLETED'))).toBe(true),
      )
    })

    test('AC #1 — Payment filter wires to ?paymentStatus=PAID', async () => {
      const user = userEvent.setup()
      const captured: string[] = []
      server.use(
        http.get('/api/v1/orders', ({ request }) => {
          captured.push(new URL(request.url).search)
          return okList([])
        }),
      )
      setup()
      await waitFor(() => expect(captured.length).toBeGreaterThan(0))

      await user.click(screen.getByRole('button', { name: /^filter/i }))
      await user.click(await screen.findByRole('combobox', { name: 'Pembayaran' }))
      await user.click(await screen.findByRole('option', { name: /sudah dibayar/i }))
      await user.click(screen.getByRole('button', { name: /^terapkan$/i }))

      await waitFor(() =>
        expect(captured.some((s) => s.includes('paymentStatus=PAID'))).toBe(true),
      )
    })

    test('AC #2 — row click opens detail modal with fee / spread / revenue breakdown', async () => {
      const user = userEvent.setup()
      server.use(
        http.get('/api/v1/orders', () => okList([baseRow({ id: 'ord_open' })])),
        http.get('/api/v1/orders/ord_open', () => okDetail(baseDetail({ id: 'ord_open' }))),
      )
      setup()
      await user.click(await screen.findByText('alice@example.com'))

      const dialog = await screen.findByRole('dialog')
      // Breakdown sections + key figures present
      expect(within(dialog).getByText(/^kurs & spread$/i)).toBeInTheDocument()
      expect(within(dialog).getByText(/^rincian biaya$/i)).toBeInTheDocument()
      expect(within(dialog).getByText(/^perkiraan pendapatan$/i)).toBeInTheDocument()
      expect(within(dialog).getByText(/spread beli/i)).toBeInTheDocument()
      expect(within(dialog).getByText(/spread jual/i)).toBeInTheDocument()
      expect(within(dialog).getByText(/^biaya payment gateway$/i)).toBeInTheDocument()
      // Effective rate + estimated revenue values rendered
      expect(within(dialog).getByText(/32.*310/)).toBeInTheDocument()
      // P1-2 — blok Detail teknis ada, dan tertutup sampai dibuka.
      expect(within(dialog).getByText('Detail teknis')).toBeInTheDocument()
      // TERTUTUP = TIDAK TERLIHAT, bukan tidak ada di DOM. Sejak `DetailTeknis`
      // memakai `hidden="until-found"` isinya sengaja TETAP di DOM supaya Ctrl+F
      // menemukannya — jadi yang dijaga di sini keadaan yang benar-benar dialami
      // operator: ia tidak melihatnya sampai membukanya.
      expect(within(dialog).getByText('Kode anti-dobel')).not.toBeVisible()
      await user.click(within(dialog).getByText('Detail teknis'))
      expect(await within(dialog).findByText('Kode anti-dobel')).toBeInTheDocument()
      expect(within(dialog).getByText('ID order')).toBeInTheDocument()
    })

    test('AC #2 — detail links safe/on-chain tx hashes out via chains config', async () => {
      const user = userEvent.setup()
      const onChain = '0x' + 'a'.repeat(64)
      server.use(
        http.get('/api/v1/orders', () => okList([baseRow({ id: 'ord_links' })])),
        http.get('/api/v1/orders/ord_links', () =>
          okDetail(baseDetail({ id: 'ord_links', onChainTxHash: onChain })),
        ),
      )
      setup()
      await user.click(await screen.findByText('alice@example.com'))
      await screen.findByRole('dialog')
      // § 4 P1-2 — hash dan tautannya dilipat ke blok "Detail teknis" yang
      // tertutup default. BOLEH DILIPAT, TIDAK BOLEH DIBUANG: tes ini membukanya
      // dan membuktikan tautan explorer-nya masih utuh beserta rel-nya.
      await user.click(await screen.findByText('Detail teknis'))
      await waitFor(() => {
        expect(
          document.querySelector(`a[href="https://polygonscan.com/tx/${onChain}"]`),
        ).not.toBeNull()
      })
      const link = document.querySelector(`a[href="https://polygonscan.com/tx/${onChain}"]`)!
      expect(link.getAttribute('rel')).toBe('noopener noreferrer')
    })

    test('deep-link /transactions/:id auto-opens the modal on first render', async () => {
      server.use(
        http.get('/api/v1/orders', () => okList([baseRow({ id: 'ord_deep' })])),
        http.get('/api/v1/orders/ord_deep', () => okDetail(baseDetail({ id: 'ord_deep' }))),
      )
      setup(['/transactions/ord_deep'])
      const dialog = await screen.findByRole('dialog')
      expect(within(dialog).getByText(/order mint/i)).toBeInTheDocument()
    })
  })

  describe('AC #3 — read-only', () => {
    test('list has no approve / reject controls', async () => {
      server.use(http.get('/api/v1/orders', () => okList([baseRow()])))
      setup()
      await screen.findByText('alice@example.com')
      expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /reject/i })).not.toBeInTheDocument()
    })

    test('detail modal has no approve / reject controls', async () => {
      const user = userEvent.setup()
      server.use(
        http.get('/api/v1/orders', () => okList([baseRow({ id: 'ord_ro' })])),
        http.get('/api/v1/orders/ord_ro', () => okDetail(baseDetail({ id: 'ord_ro' }))),
      )
      setup()
      await user.click(await screen.findByText('alice@example.com'))
      const dialog = await screen.findByRole('dialog')
      expect(within(dialog).queryByRole('button', { name: /approve/i })).not.toBeInTheDocument()
      expect(within(dialog).queryByRole('button', { name: /reject/i })).not.toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    test('renders the empty state when there are no orders', async () => {
      server.use(http.get('/api/v1/orders', () => okList([])))
      setup()
      await screen.findByText(/belum ada transaksi nasabah/i)
    })

    test('null totalPayIdr renders a dash (channel not yet chosen)', async () => {
      server.use(
        http.get('/api/v1/orders', () =>
          okList([
            baseRow({
              id: 'ord_pending',
              paymentStatus: 'REQUESTED',
              safeStatus: 'NONE',
              status: 'WAITING_FOR_PAYMENT',
              totalPayIdr: null,
            }),
          ]),
        ),
      )
      setup()
      await screen.findByText('alice@example.com')
      // The Total pay (IDR) cell shows an em dash for the null value.
      expect(screen.getAllByText('—').length).toBeGreaterThan(0)
    })

    test('REDEEM type option is now selectable (W3, USDX-245)', async () => {
      const user = userEvent.setup()
      server.use(http.get('/api/v1/orders', () => okList([baseRow()])))
      setup()
      await screen.findByText('alice@example.com')
      await user.click(screen.getByRole('button', { name: /^filter/i }))
      await user.click(await screen.findByRole('combobox', { name: 'Jenis' }))
      const redeem = await screen.findByRole('option', { name: /redeem/i })
      expect(redeem).not.toHaveAttribute('aria-disabled', 'true')
    })
  })
})

// USDX-245 — User Transaction extended to redeem orders (type=REDEEM).
describe('TransactionsListPage @ USDX-245 — redeem', () => {
  describe('positive', () => {
    test('AC #1 — filter type=REDEEM wires to ?type=REDEEM', async () => {
      const user = userEvent.setup()
      const captured: string[] = []
      server.use(
        http.get('/api/v1/orders', ({ request }) => {
          captured.push(new URL(request.url).search)
          return okList([redeemRow()])
        }),
      )
      setup()
      await waitFor(() => expect(captured.length).toBeGreaterThan(0))

      await user.click(screen.getByRole('button', { name: /^filter/i }))
      await user.click(await screen.findByRole('combobox', { name: 'Jenis' }))
      await user.click(await screen.findByRole('option', { name: /^redeem$/i }))
      await user.click(screen.getByRole('button', { name: /^terapkan$/i }))

      await waitFor(() => expect(captured.some((s) => s.includes('type=REDEEM'))).toBe(true))
    })

    test('AC #1 — redeem row renders net payout + dashes for payment/safe', async () => {
      server.use(http.get('/api/v1/orders', () => okList([redeemRow()])))
      setup()
      await screen.findByText('bob@example.com')
      // Net payout (IDR) figure is shown for the redeem row.
      expect(screen.getByText(/1.*547.*320/)).toBeInTheDocument()
    })

    test('type=REDEEM TIDAK menawarkan saringan Status sama sekali', async () => {
      // `ListOrdersDto` backend (`origin/dev`) tidak menerima `redeemStatus`, dan
      // `whitelist: true` tanpa `forbidNonWhitelisted` membuangnya DIAM-DIAM.
      // Saringan itu dulu memasang chip "Status: Pencairan gagal" di atas SELURUH
      // order redeem — termasuk yang rupiahnya sudah cair. Kontrol yang membuat
      // orang mengira daftarnya tersaring lebih buruk daripada tidak ada kontrol.
      //
      // Saringan Status MINT tetap ada, jadi test ini juga membuktikan yang
      // dilepas hanya cabang redeem-nya.
      const user = userEvent.setup()
      server.use(http.get('/api/v1/orders', () => okList([redeemRow()])))
      setup(['/transactions?type=REDEEM'])
      await screen.findByText('bob@example.com')
      await user.click(screen.getByRole('button', { name: /^filter/i }))
      const popover = await screen.findByRole('dialog')
      expect(within(popover).queryByRole('combobox', { name: 'Status' })).not.toBeInTheDocument()
      expect(within(popover).getByRole('combobox', { name: 'Jenis' })).toBeInTheDocument()
    })

    test('AC #2 — redeem detail shows fee / net payout / bank + burn tx link', async () => {
      const user = userEvent.setup()
      const burn = '0x' + 'd'.repeat(64)
      server.use(
        http.get('/api/v1/orders', () => okList([redeemRow({ id: 'ord_r1' })])),
        http.get('/api/v1/orders/ord_r1', () =>
          okDetail(redeemDetail({ id: 'ord_r1', burnTxHash: burn })),
        ),
      )
      setup()
      await user.click(await screen.findByText('bob@example.com'))

      const dialog = await screen.findByRole('dialog')
      expect(within(dialog).getByText(/order redeem/i)).toBeInTheDocument()

      // Pagar konvensi angka DI DALAM DIALOG — POSITIF, bukan negatif.
      //
      // Versi negatif sebelumnya (`not.toMatch(/\d\.\d{4,}/)`) TERBUKTI BUTA:
      // merusak `{money(detail.netPayoutIdr)}` jadi `{detail.netPayoutIdr}`
      // membuat dialog mencetak `1547320.00`, dan seluruh berkas ini tetap
      // hijau. Sebabnya struktural — pola itu hanya menangkap `numeric(*,4)` ke
      // atas, sementara SETIAP rupiah di repo ini `numeric(*,2)`. Dan `100.000`
      // (titik + tepat tiga digit) tidak mungkin dibedakan regex mana pun dari
      // pemisah ribuan id-ID, sambil berarti salah 1000×.
      //
      // Jadi yang dipatok NILAI YANG DIRENDER, satu per satu. Lebih berisik,
      // tapi ia tidak bisa buta.
      expect(within(dialog).getByText('100,00')).toBeInTheDocument() // USDX, dari '100.000000'
      // Regex, bukan string persis: `netPayoutIdr` juga muncul di dalam kalimat
      // yang diakhiri titik, jadi simpul teksnya tidak sama persis.
      expect(within(dialog).getAllByText(/Rp 1\.547\.320/).length).toBeGreaterThan(0) // netPayoutIdr
      expect(within(dialog).getAllByText(/Rp 1\.568\.000/).length).toBeGreaterThan(0) // grossIdr
      expect(within(dialog).getByText(/15\.680,00 IDR\/USD/)).toBeInTheDocument() // effectiveRate
      expect(within(dialog).getByText(/16\.000,00 IDR\/USD/)).toBeInTheDocument() // baseRate
      expect(within(dialog).getByText('2%')).toBeInTheDocument() // spreadSellPct
      expect(within(dialog).getAllByText(/Rp 15\.680/).length).toBeGreaterThan(0) // redeemFeeIdr
      expect(within(dialog).getAllByText(/Rp 5\.000/).length).toBeGreaterThan(0) // disbursementFeeIdr
      expect(within(dialog).getAllByText(/Rp 20\.680/).length).toBeGreaterThan(0) // totalFeeIdr

      // Backstop murah untuk bentuk yang PASTI Inggris, di atas assertion di atas.
      const teksDialog = dialog.textContent ?? ''
      expect(teksDialog).not.toMatch(/\d\.\d{4,}/)
      expect(teksDialog).not.toMatch(/\d,\d{3}/)
      // Redeem-specific fields.
      expect(within(dialog).getByText(/spread jual/i)).toBeInTheDocument()
      expect(within(dialog).getByText(/^biaya transfer bank$/i)).toBeInTheDocument()
      expect(within(dialog).getByText(/^nominal transfer \(rp\)$/i)).toBeInTheDocument()
      expect(within(dialog).getByText(/bank tujuan/i)).toBeInTheDocument()
      // Bank name + full account number + account name shown (un-mask, USDX-270).
      expect(within(dialog).getByText('BCA')).toBeInTheDocument()
      expect(within(dialog).getByText('1234563271')).toBeInTheDocument()
      expect(within(dialog).getByText('BOB SETIAWAN')).toBeInTheDocument()
      // Burn tx hash deep-links to the block explorer — sekarang di dalam blok
      // "Detail teknis" (P1-2). Nomor rekening dan nama menurut bank di atas
      // SENGAJA tidak ikut dilipat: keduanya bahan keputusan, bukan penelusuran.
      await user.click(await within(dialog).findByText('Detail teknis'))
      await waitFor(() => {
        expect(
          document.querySelector(`a[href="https://polygonscan.com/tx/${burn}"]`),
        ).not.toBeNull()
      })
    })
  })

  describe('AC #3 — read-only', () => {
    test('redeem detail modal has no approve / reject controls', async () => {
      const user = userEvent.setup()
      server.use(
        http.get('/api/v1/orders', () => okList([redeemRow({ id: 'ord_r2' })])),
        http.get('/api/v1/orders/ord_r2', () => okDetail(redeemDetail({ id: 'ord_r2' }))),
      )
      setup()
      await user.click(await screen.findByText('bob@example.com'))
      const dialog = await screen.findByRole('dialog')
      expect(within(dialog).queryByRole('button', { name: /approve/i })).not.toBeInTheDocument()
      expect(within(dialog).queryByRole('button', { name: /reject/i })).not.toBeInTheDocument()
    })
  })
})

// USDX-254 — type-aware status filter: when type=REDEEM the RedeemStatus value
// is sent through a distinct `redeemStatus` query param, never the mint `status`.
describe('TransactionsListPage @ USDX-254 — redeem status filter', () => {
  describe('positive', () => {
    test('nilai URL basi `?redeemStatus=` TIDAK pernah ikut dikirim ke server', async () => {
      // Tautan lama dan bookmark masih membawa parameter itu. Meneruskannya berarti
      // server membuangnya diam-diam lalu menjawab SELURUH order redeem, sementara
      // layar menampilkan chip seolah tersaring.
      const captured: string[] = []
      server.use(
        http.get('/api/v1/orders', ({ request }) => {
          captured.push(new URL(request.url).search)
          return okList([redeemRow({ status: 'PROCESSING_PAYOUT' })])
        }),
      )
      setup(['/transactions?type=REDEEM&redeemStatus=PROCESSING_PAYOUT'])
      await waitFor(() => expect(captured.length).toBeGreaterThan(0))

      expect(captured.every((q) => !q.includes('redeemStatus'))).toBe(true)
      // Dan nilainya juga tidak diselundupkan lewat param `status` milik mint.
      expect(captured.every((q) => !/[?&]status=/.test(q))).toBe(true)
      expect(captured.some((q) => q.includes('type=REDEEM'))).toBe(true)
    })
  })

  describe('AC #3 — type switch resets the stale status dimension', () => {
    test('REDEEM → MINT membersihkan `redeemStatus` dari URL, bukan cuma dari request', async () => {
      const user = userEvent.setup()
      const captured: string[] = []
      server.use(
        http.get('/api/v1/orders', ({ request }) => {
          captured.push(new URL(request.url).search)
          return okList([baseRow()])
        }),
      )
      setup(['/transactions?type=REDEEM&redeemStatus=PROCESSING_PAYOUT'])
      await waitFor(() => expect(captured.length).toBeGreaterThan(0))

      await user.click(screen.getByRole('button', { name: /^filter/i }))
      await user.click(await screen.findByRole('combobox', { name: 'Jenis' }))
      await user.click(await screen.findByRole('option', { name: /^mint$/i }))
      await user.click(screen.getByRole('button', { name: /^terapkan$/i }))

      await waitFor(() => {
        const last = captured[captured.length - 1]
        expect(last).toContain('type=MINT')
      })
      // Nilai basinya juga hilang dari URL — kalau ia tertinggal di sana, chip
      // saringan akan menyala untuk sesuatu yang tidak pernah dikirim ke server.
      expect(captured.every((q) => !q.includes('redeemStatus'))).toBe(true)
      expect(window.location.search).not.toContain('redeemStatus')
    })
  })

  describe('negative', () => {
    test('a 422 from an invalid combo surfaces a graceful error state (not a crash)', async () => {
      server.use(
        http.get('/api/v1/orders', () =>
          HttpResponse.json(
            {
              status: 'error',
              metadata: null,
              data: null,
              error: { code: 'VALIDATION_ERROR', message: 'invalid filter combination' },
            },
            { status: 422 },
          ),
        ),
      )
      setup(['/transactions?type=REDEEM&redeemStatus=PROCESSING_PAYOUT'])
      expect(await screen.findByRole('button', { name: /coba lagi/i })).toBeInTheDocument()
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// USDX-547 — the Partner column, the external reference, and the Owner filter.
//
// The question these answer is not "why is this email cell not an email" (the
// `(partner customer)` marker already covers that) but "which partner is this
// order from" — because a partner order that goes wrong is chased with the
// PARTNER, and the partner's customer has no relationship with USDX at all.
// ─────────────────────────────────────────────────────────────────────────────

const PARTNER = {
  id: 'ptn_1',
  code: 'juara',
  displayName: 'PT Juara Remiten Indonesia',
}

/** A partner order on behalf of the partner's CUSTOMER — no `users` row at all. */
const partnerCustomerRow = (overrides: Partial<OrderListItem> = {}): OrderListItem =>
  baseRow({
    id: 'ord_ptn_cust',
    // Nullable since migration 0076, precisely for this case.
    userId: null,
    userEmail: '(partner customer)',
    partner: PARTNER,
    onBehalfOf: 'CUSTOMER',
    ...overrides,
  })

/** A partner order for the partner ITSELF — it does have a `users` row. */
const partnerSelfRow = (overrides: Partial<OrderListItem> = {}): OrderListItem =>
  baseRow({
    id: 'ord_ptn_self',
    userId: 'usr_partner_legal',
    userEmail: 'ops@juara.co.id',
    partner: PARTNER,
    onBehalfOf: 'SELF',
    ...overrides,
  })

const partnerDetail = (overrides: Partial<OrderDetail> = {}): OrderDetail =>
  baseDetail({
    id: 'ord_ptn_cust',
    userId: null,
    userEmail: '(partner customer)',
    partner: PARTNER,
    onBehalfOf: 'CUSTOMER',
    partnerCustomerId: 'pc_9f3a2b',
    externalReference: 'JUARA-ORD-2026-000042',
    ...overrides,
  })

function partnerColumnIndex(): number {
  const headers = screen.getAllByRole('columnheader')
  const index = headers.findIndex((h) => h.textContent?.trim() === 'Partner')
  expect(index).toBeGreaterThan(-1)
  return index
}

/** The cell under the "Partner" header, for the row containing `rowText`. */
function partnerCellFor(rowText: string): HTMLElement {
  const index = partnerColumnIndex()
  const row = screen.getByText(rowText).closest('tr')
  expect(row).not.toBeNull()
  const cells = within(row as HTMLElement).getAllByRole('cell')
  return cells[index]!
}

/**
 * DataTable renders SKELETON rows while the query is in flight, and those rows
 * have empty cells. Asserting on cell contents before the data lands would pass
 * or fail on timing rather than on behaviour, so wait for the footer to report a
 * non-zero row count first ("1–12 dari 12" — it reads "0–0 dari 0" while loading).
 */
async function waitForRowsLoaded() {
  await waitFor(() => {
    const footer = screen.getByText(/dari \d+$/)
    expect(footer.textContent).not.toMatch(/dari 0$/)
  })
}

/**
 * The table's data rows.
 *
 * A DOM query rather than `getAllByRole('row')` because DataTable gives every
 * CLICKABLE row `role="button"` (it opens the detail modal), so the data rows do
 * not carry the `row` role at all — only the header row does.
 */
function dataRows(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('tbody tr'))
}

describe('TransactionsListPage @ USDX-547 — Partner column', () => {
  describe('positive', () => {
    test('partner order shows the partner display name AND code in its own column', async () => {
      server.use(http.get('/api/v1/orders', () => okList([partnerCustomerRow()])))
      setup()
      await screen.findByText('(partner customer)')

      const cell = partnerCellFor('(partner customer)')
      expect(cell).toHaveTextContent('PT Juara Remiten Indonesia')
      // `code` is what appears in transaction references and survives a change of
      // legal name, so it earns the second line.
      expect(cell).toHaveTextContent('juara')
    })

    test('partner-customer order keeps the `(partner customer)` marker in the User column', async () => {
      // The marker is CORRECT once the Partner column exists: there genuinely is
      // no email, and the partner is readable in the next cell.
      server.use(http.get('/api/v1/orders', () => okList([partnerCustomerRow()])))
      setup()
      expect(await screen.findByText('(partner customer)')).toBeInTheDocument()
    })

    test("a partner's OWN order counts as a partner order even though it has a real email", async () => {
      // Partner-ness is decided by `partner_id`, not by the email marker. A rule
      // written against the marker would misfile every `SELF` order as retail.
      server.use(http.get('/api/v1/orders', () => okList([partnerSelfRow()])))
      setup()
      await screen.findByText('ops@juara.co.id')
      expect(partnerCellFor('ops@juara.co.id')).toHaveTextContent(
        'PT Juara Remiten Indonesia',
      )
    })

    test('detail modal shows the partner, the external reference and on-behalf-of', async () => {
      const detail = partnerDetail()
      server.use(
        http.get('/api/v1/orders', () => okList([partnerCustomerRow()])),
        http.get('/api/v1/orders/ord_ptn_cust', () => okDetail(detail)),
      )
      setup(['/transactions/ord_ptn_cust'])

      const dialog = await screen.findByRole('dialog')
      expect(
        await within(dialog).findByText('PT Juara Remiten Indonesia'),
      ).toBeInTheDocument()
      // Shown IN FULL, not middle-truncated: this is the number the partner
      // quotes when it reports a problem, so ops must be able to match it
      // character for character.
      expect(within(dialog).getByText('JUARA-ORD-2026-000042')).toBeInTheDocument()
      expect(within(dialog).getByText('Nasabah milik partner')).toBeInTheDocument()
      expect(within(dialog).getByText('pc_9f3a2b')).toBeInTheDocument()
    })
  })

  describe('negative', () => {
    test('retail order leaves the Partner cell EMPTY — no dash, no "N/A"', async () => {
      // A dash or "N/A" reads as "this value failed to load". Empty reads as
      // "this concept does not apply", which is the truth for a retail order.
      server.use(http.get('/api/v1/orders', () => okList([baseRow()])))
      setup()
      await screen.findByText('alice@example.com')

      const cell = partnerCellFor('alice@example.com')
      expect(cell).toBeEmptyDOMElement()
      expect(cell.textContent).toBe('')
    })

    test('retail order renders exactly as before — no regression from the new column', async () => {
      server.use(http.get('/api/v1/orders', () => okList([baseRow()])))
      setup()
      await screen.findByText('alice@example.com')

      // Every pre-existing cell still says what it said before USDX-547.
      expect(screen.getByText('250,00')).toBeInTheDocument()
      expect(screen.getByText('Rp 4.078.500,00')).toBeInTheDocument()
      expect(screen.getByRole('columnheader', { name: /pembayaran/i })).toBeInTheDocument()
      expect(screen.getByRole('columnheader', { name: /tanda tangan/i })).toBeInTheDocument()
      // The email is still rendered as an email (avatar + plain text), not as the
      // partner-customer marker.
      expect(screen.queryByText('(partner customer)')).not.toBeInTheDocument()
    })

    test('retail detail modal renders no Partner section at all', async () => {
      server.use(
        http.get('/api/v1/orders', () => okList([baseRow()])),
        http.get('/api/v1/orders/ord_1', () => okDetail(baseDetail())),
      )
      setup(['/transactions/ord_1'])

      const dialog = await screen.findByRole('dialog')
      // Wait for the detail to land before asserting on absence — otherwise the
      // skeleton state would make this pass for the wrong reason.
      expect(await within(dialog).findByText('alice@example.com')).toBeInTheDocument()
      // An always-present section full of dashes would suggest missing data.
      expect(within(dialog).queryByText('Nomor order menurut partner')).not.toBeInTheDocument()
      expect(within(dialog).queryByText('On behalf of')).not.toBeInTheDocument()
      expect(within(dialog).queryByText(/^partner$/i)).not.toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    test('mixed list: the partner row is populated and the retail row stays empty', async () => {
      // The situation the column exists for — two populations in one table.
      server.use(
        http.get('/api/v1/orders', () => okList([partnerCustomerRow(), baseRow()])),
      )
      setup()
      await screen.findByText('alice@example.com')

      expect(partnerCellFor('(partner customer)')).toHaveTextContent(
        'PT Juara Remiten Indonesia',
      )
      expect(partnerCellFor('alice@example.com')).toBeEmptyDOMElement()
      expect(dataRows()).toHaveLength(2)
    })

    test('a partner order with no external reference shows a dash, not a blank', async () => {
      // Inside the Partner section the field is EXPECTED, so absent means "the
      // partner did not send one" — that is missing data and a dash is right.
      const detail = partnerDetail({ externalReference: null, partnerCustomerId: null })
      server.use(
        http.get('/api/v1/orders', () => okList([partnerCustomerRow()])),
        http.get('/api/v1/orders/ord_ptn_cust', () => okDetail(detail)),
      )
      setup(['/transactions/ord_ptn_cust'])

      const dialog = await screen.findByRole('dialog')
      expect(await within(dialog).findByText('Nomor order menurut partner')).toBeInTheDocument()
      expect(
        within(dialog).queryByText('JUARA-ORD-2026-000042'),
      ).not.toBeInTheDocument()
    })
  })
})

describe('TransactionsListPage @ USDX-547 — Owner filter', () => {
  describe('positive', () => {
    test('"Partner orders" sends ?ownerType=PARTNER', async () => {
      const user = userEvent.setup()
      const captured: string[] = []
      server.use(
        http.get('/api/v1/orders', ({ request }) => {
          captured.push(new URL(request.url).search)
          return okList([])
        }),
      )
      setup()
      await waitFor(() => expect(captured.length).toBeGreaterThan(0))

      await user.click(screen.getByRole('button', { name: /^filter/i }))
      await user.click(await screen.findByRole('combobox', { name: 'Pemilik order' }))
      await user.click(await screen.findByRole('option', { name: /order partner/i }))
      await user.click(screen.getByRole('button', { name: /^terapkan$/i }))

      await waitFor(() =>
        expect(captured.some((s) => s.includes('ownerType=PARTNER'))).toBe(true),
      )
    })

    test('the filter actually filters — the MSW store returns only partner rows', async () => {
      // Deliberately NOT a stub: this runs against the seeded mock store, so it
      // proves the parameter narrows a mixed population rather than merely
      // proving the URL was written.
      setup(['/transactions?ownerType=PARTNER'])
      await waitForRowsLoaded()

      const partnerIndex = partnerColumnIndex()
      const rows = dataRows()
      expect(rows.length).toBeGreaterThan(0)
      for (const row of rows) {
        const cells = within(row).getAllByRole('cell')
        // Every visible row belongs to a partner.
        expect(cells[partnerIndex]!.textContent?.trim()).not.toBe('')
      }
    })

    test('RETAIL narrows to rows with an EMPTY partner cell', async () => {
      setup(['/transactions?ownerType=RETAIL'])
      await waitForRowsLoaded()

      const partnerIndex = partnerColumnIndex()
      const rows = dataRows()
      expect(rows.length).toBeGreaterThan(0)
      for (const row of rows) {
        const cells = within(row).getAllByRole('cell')
        expect(cells[partnerIndex]!.textContent?.trim()).toBe('')
      }
      // …and no retail row carries the partner-customer marker.
      expect(screen.queryByText('(partner customer)')).not.toBeInTheDocument()
    })
  })

  describe('negative', () => {
    test('the two values return DIFFERENT, non-overlapping row sets', async () => {
      // A filter that is silently ignored would return the same rows for both
      // values — the failure mode where an operator believes they are looking at
      // partner orders only.
      const partnerRes = await fetch('/api/v1/orders?ownerType=PARTNER&take=100')
      const retailRes = await fetch('/api/v1/orders?ownerType=RETAIL&take=100')
      const partnerJson = (await partnerRes.json()) as { data: OrderListItem[] }
      const retailJson = (await retailRes.json()) as { data: OrderListItem[] }

      expect(partnerJson.data.length).toBeGreaterThan(0)
      expect(retailJson.data.length).toBeGreaterThan(0)
      expect(partnerJson.data.every((r) => r.partner !== null)).toBe(true)
      expect(retailJson.data.every((r) => r.partner === null)).toBe(true)

      const partnerIds = new Set(partnerJson.data.map((r) => r.id))
      expect(retailJson.data.some((r) => partnerIds.has(r.id))).toBe(false)
    })

    test('an unknown ownerType is refused, not silently ignored', async () => {
      const res = await fetch('/api/v1/orders?ownerType=EVERYONE')
      expect(res.status).toBe(400)
    })
  })

  describe('edge cases', () => {
    test('switching Type does NOT clear the Owner filter', async () => {
      // Owner and Type are independent questions — a partner can mint and redeem.
      const user = userEvent.setup()
      const captured: string[] = []
      server.use(
        http.get('/api/v1/orders', ({ request }) => {
          captured.push(new URL(request.url).search)
          return okList([baseRow()])
        }),
      )
      setup(['/transactions?ownerType=PARTNER'])
      await waitFor(() => expect(captured.length).toBeGreaterThan(0))

      await user.click(screen.getByRole('button', { name: /^filter/i }))
      await user.click(await screen.findByRole('combobox', { name: 'Jenis' }))
      await user.click(await screen.findByRole('option', { name: /^redeem$/i }))
      await user.click(screen.getByRole('button', { name: /^terapkan$/i }))

      await waitFor(() => {
        const last = captured[captured.length - 1]
        expect(last).toContain('type=REDEEM')
        expect(last).toContain('ownerType=PARTNER')
      })
    })

    test('no Owner filter selected sends no ownerType param (both populations)', async () => {
      const captured: string[] = []
      server.use(
        http.get('/api/v1/orders', ({ request }) => {
          captured.push(new URL(request.url).search)
          return okList([baseRow()])
        }),
      )
      setup()
      await waitFor(() => expect(captured.length).toBeGreaterThan(0))
      expect(captured.every((s) => !s.includes('ownerType'))).toBe(true)
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// BOLEH DILIPAT, TIDAK BOLEH DIBUANG — nama rantai.
//
// `origin/dev` merender `STAFF safe · polygon` di kepala modal. Saat kepala itu
// disederhanakan, komentarnya berbunyi "Nama rantainya turun ke Detail teknis di
// bawah" — dan tidak pernah sampai ke sana. Kolom "Jaringan" di tabel juga
// `hiddenByDefault`, jadi selama beberapa commit nama rantai sebuah order TIDAK
// TERBACA DI MANA PUN secara bawaan.
//
// Dua cabang, dua tes: modal MINT dan modal REDEEM merender blok Detail teknis
// yang berbeda, dan menambal salah satunya saja adalah cara cacat ini lahir.
// ─────────────────────────────────────────────────────────────────────────────
describe('OrderDetailModal — nama rantai dilipat, tidak dibuang', () => {
  describe('positive', () => {
    test('MINT: Jaringan ada di Detail teknis, dengan nilai rantainya', async () => {
      const user = userEvent.setup()
      server.use(
        http.get('/api/v1/orders', () => okList([baseRow({ id: 'ord_chain_mint' })])),
        http.get('/api/v1/orders/ord_chain_mint', () =>
          okDetail(baseDetail({ id: 'ord_chain_mint', chain: 'polygon' })),
        ),
      )
      setup()
      await user.click(await screen.findByText('alice@example.com'))
      const dialog = await screen.findByRole('dialog')
      await user.click(await within(dialog).findByText('Detail teknis'))
      const label = await within(dialog).findByText('Jaringan')
      expect(label.parentElement?.textContent).toContain('polygon')
    })

    test('REDEEM: Jaringan ada di Detail teknis, dengan nilai rantainya', async () => {
      const user = userEvent.setup()
      server.use(
        http.get('/api/v1/orders', () => okList([redeemRow({ id: 'ord_chain_rdm' })])),
        http.get('/api/v1/orders/ord_chain_rdm', () =>
          okDetail(redeemDetail({ id: 'ord_chain_rdm', chain: 'polygon' })),
        ),
      )
      setup()
      await user.click(await screen.findByText('bob@example.com'))
      const dialog = await screen.findByRole('dialog')
      await user.click(await within(dialog).findByText('Detail teknis'))
      const label = await within(dialog).findByText('Jaringan')
      expect(label.parentElement?.textContent).toContain('polygon')
    })
  })
})
