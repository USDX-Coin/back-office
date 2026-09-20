import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { resetMockData } from '@/mocks/handlers'
import RequestDetailModal from '@/components/RequestDetailModal'
import { renderWithProviders } from '@/test/test-utils'
import type { RequestListItem } from '@/lib/types'

// USDX-71 — on-chain deep-links in the request detail modal:
//   onChainTxHash / depositTxHash → block explorer (Polygonscan)
//   safeTxHash → Safe UI, using the Safe address for the row's safeType

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  resetMockData()
})
afterAll(() => server.close())

const STAFF_SAFE = '0x1111111111111111111111111111111111111111'
const MANAGER_SAFE = '0x2222222222222222222222222222222222222222'
const ON_CHAIN_TX = '0x' + 'a'.repeat(64)
const SAFE_TX = '0x' + 'b'.repeat(64)
const DEPOSIT_TX = '0x' + 'c'.repeat(64)

function chainsOk() {
  return http.get('/api/v1/chains', () =>
    HttpResponse.json({
      status: 'success',
      metadata: null,
      data: [
        {
          chain: 'polygon',
          chainId: 137,
          name: 'Polygon',
          blockExplorerUrl: 'https://polygonscan.com',
          staffSafeAddress: STAFF_SAFE,
          managerSafeAddress: MANAGER_SAFE,
          usdxAddress: '0x3333333333333333333333333333333333333333',
        },
      ],
    })
  )
}

function detailOk(detail: Record<string, unknown>) {
  return http.get('/api/v1/requests/:id', () =>
    HttpResponse.json({ status: 'success', metadata: null, data: detail })
  )
}

const listRow: RequestListItem = {
  id: 'req_1',
  type: 'mint',
  userId: 'u1',
  userName: 'Alice',
  userAddress: STAFF_SAFE,
  amount: '100.00',
  amountIdr: '1625000',
  chain: 'polygon',
  safeType: 'STAFF',
  status: 'EXECUTED',
  safeTxHash: SAFE_TX,
  onChainTxHash: ON_CHAIN_TX,
  createdBy: 's1',
  createdByName: 'Sam Operator',
  createdAt: '2026-05-01T00:00:00Z',
}

const mintExecutedDetail = {
  id: 'req_1',
  type: 'mint',
  idempotencyKey: '0x' + '0'.repeat(64),
  userId: 'u1',
  userName: 'Alice',
  userAddress: STAFF_SAFE,
  amount: '100.00',
  amountWei: '100000000',
  amountIdr: '1625000',
  rateUsed: '16250',
  chain: 'polygon',
  notes: null,
  safeType: 'STAFF',
  status: 'EXECUTED',
  safeTxHash: SAFE_TX,
  onChainTxHash: ON_CHAIN_TX,
  createdBy: 's1',
  createdAt: '2026-05-01T00:00:00Z',
  updatedAt: '2026-05-01T00:00:00Z',
}

// § 4 P1-2 — nilai mentah (hash Safe, wei, kode anti-dobel, id request, nama
// jaringan) dilipat ke blok "Detail teknis" yang tertutup secara default.
// ATURANNYA: boleh dilipat, TIDAK boleh dibuang — jadi tes ini membukanya dan
// membuktikan nilainya masih utuh, lengkap dengan tautan explorer/Safe-nya.
// Tanpa langkah ini `Collapsible` Radix memang tidak merender isinya sama sekali.
async function openDetailTeknis() {
  const trigger = await screen.findByText('Detail teknis')
  fireEvent.click(trigger)
  return trigger
}

function open(props?: Partial<React.ComponentProps<typeof RequestDetailModal>>) {
  return renderWithProviders(
    <RequestDetailModal
      requestId="req_1"
      listItem={listRow}
      open
      onOpenChange={() => {}}
      {...props}
    />,
    { authenticated: true }
  )
}

describe('RequestDetailModal — on-chain links', () => {
  describe('positive', () => {
    test('renders onChainTxHash as a block explorer link (target=_blank, rel=noopener)', async () => {
      server.use(chainsOk(), detailOk(mintExecutedDetail))
      open()
      await waitFor(() => {
        expect(
          document.querySelector(`a[href="https://polygonscan.com/tx/${ON_CHAIN_TX}"]`)
        ).not.toBeNull()
      })
      const link = document.querySelector(`a[href="https://polygonscan.com/tx/${ON_CHAIN_TX}"]`)!
      expect(link.getAttribute('target')).toBe('_blank')
      expect(link.getAttribute('rel')).toBe('noopener noreferrer')
    })

    test('renders safeTxHash as a Safe UI link using the STAFF safe address', async () => {
      server.use(chainsOk(), detailOk(mintExecutedDetail))
      open()
      await openDetailTeknis()
      await waitFor(() => {
        const a = document.querySelector('a[href^="https://app.safe.global/transactions/tx"]')
        expect(a).not.toBeNull()
      })
      const href = document
        .querySelector('a[href^="https://app.safe.global/transactions/tx"]')!
        .getAttribute('href')!
      expect(href).toContain(`matic%3A${STAFF_SAFE}`)
      expect(href).toContain(`multisig_${STAFF_SAFE}_${SAFE_TX}`)
    })

    test('uses the MANAGER safe address when safeType is MANAGER', async () => {
      server.use(chainsOk(), detailOk({ ...mintExecutedDetail, safeType: 'MANAGER' }))
      open({ listItem: { ...listRow, safeType: 'MANAGER' } })
      await openDetailTeknis()
      await waitFor(() => {
        const a = document.querySelector('a[href^="https://app.safe.global/transactions/tx"]')
        expect(a?.getAttribute('href')).toContain(`matic%3A${MANAGER_SAFE}`)
      })
    })

    test('renders the burn deposit tx hash as a block explorer link', async () => {
      server.use(
        chainsOk(),
        detailOk({
          ...mintExecutedDetail,
          type: 'burn',
          status: 'IDR_TRANSFERRED',
          depositTxHash: DEPOSIT_TX,
          bankName: 'BCA',
          bankAccount: '1234567890',
        })
      )
      open({ listItem: { ...listRow, type: 'burn', status: 'IDR_TRANSFERRED' } })
      await waitFor(() => {
        expect(
          document.querySelector(`a[href="https://polygonscan.com/tx/${DEPOSIT_TX}"]`)
        ).not.toBeNull()
      })
    })
  })

  describe('edge cases', () => {
    test('falls back to copyable text (no explorer link) when chain config is unavailable', async () => {
      server.use(
        http.get('/api/v1/chains', () =>
          HttpResponse.json(
            { status: 'error', metadata: null, data: null, error: { code: 'X', message: 'down' } },
            { status: 500 }
          )
        ),
        detailOk(mintExecutedDetail)
      )
      open()
      // wait until the detail body has rendered
      await screen.findByText('Bukti blockchain')
      await openDetailTeknis()
      expect(document.querySelector('a[href^="https://polygonscan.com/tx/"]')).toBeNull()
      expect(document.querySelector('a[href^="https://app.safe.global/"]')).toBeNull()
    })

    test('renders an em dash when onChainTxHash is null', async () => {
      server.use(
        chainsOk(),
        detailOk({ ...mintExecutedDetail, status: 'PENDING_APPROVAL', onChainTxHash: null })
      )
      open({ listItem: { ...listRow, status: 'PENDING_APPROVAL', onChainTxHash: null } })
      const label = await screen.findByText('Bukti blockchain')
      expect(label.parentElement?.textContent).toContain('—')
      expect(document.querySelector(`a[href*="${ON_CHAIN_TX}"]`)).toBeNull()
    })

    // P1-2 — pagar yang membuat "boleh dilipat, tidak boleh dibuang" bisa gagal
    // kalau seseorang menghapus field-nya alih-alih melipatnya.
    test('Detail teknis tetap membawa SELURUH nilai mentah yang dulu di layar utama', async () => {
      server.use(chainsOk(), detailOk(mintExecutedDetail))
      open()
      await openDetailTeknis()
      for (const label of [
        'ID request',
        'Kode anti-dobel',
        'Nominal satuan terkecil (wei)',
        'Jaringan',
        'Nomor antrean tanda tangan',
      ]) {
        expect(await screen.findByText(label)).toBeInTheDocument()
      }
      // Nilai wei-nya sendiri, bukan cuma labelnya.
      expect(screen.getByText(mintExecutedDetail.amountWei)).toBeInTheDocument()
    })

    test('Detail teknis tertutup secara default', async () => {
      server.use(chainsOk(), detailOk(mintExecutedDetail))
      open()
      await screen.findByText('Detail teknis')
      // P1-5 — "Amount (wei)" dulu berdiri sebagai label field di layar utama.
      //
      // TERTUTUP = TIDAK TERLIHAT, bukan tidak ada di DOM. `DetailTeknis` memakai
      // `hidden="until-found"` supaya Ctrl+F tetap menemukan hash/id yang
      // terlipat; yang dijaga di sini keadaan yang dialami operator.
      expect(screen.getByText('Nominal satuan terkecil (wei)')).not.toBeVisible()
      expect(screen.queryByText(/amount \(wei\)/i)).not.toBeInTheDocument()
    })
  })
})

// USDX-78 — detail modal surfaces the "Created by" staff name.
describe('RequestDetailModal — Created by (USDX-78)', () => {
  test('renders Created by from the detail response when present', async () => {
    server.use(
      chainsOk(),
      detailOk({ ...mintExecutedDetail, createdByName: 'Detail Owner' })
    )
    open()
    // P1-1 — "Created by" → "Dibuat oleh"; tetap di layar utama karena ia bahan
    // penilaian, bukan bahan penelusuran.
    const label = await screen.findByText('Dibuat oleh')
    // sibling div under the same <Field> wrapper renders the value.
    expect(label.parentElement?.textContent).toContain('Detail Owner')
  })

  test('falls back to listItem.createdByName when the detail response omits it', async () => {
    server.use(chainsOk(), detailOk(mintExecutedDetail))
    // listRow fixture has createdByName = 'Sam Operator'.
    open()
    const label = await screen.findByText('Dibuat oleh')
    expect(label.parentElement?.textContent).toContain('Sam Operator')
  })
})
