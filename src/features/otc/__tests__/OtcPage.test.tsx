import { describe, test, expect, vi, beforeAll, beforeEach, afterAll, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { findStaffByEmail } from '@/mocks/handlers'
import { renderWithProviders } from '@/test/test-utils'
import type { RequestListItem, SafeTxDetail, SafeTxListItem } from '@/lib/types'

// The wallet stack (wagmi/RainbowKit) is replaced by a controllable fake; the
// signing rules in `useSafeTxSigning` (owner check, hash guard, confirm) stay
// REAL. `safeTxHashMatches` is forced true because these fixtures do not carry
// a real EIP-712 payload — the hash guard has its own tests.
const wallet = vi.hoisted(() => ({
  state: {
    isConnected: false,
    address: undefined as string | undefined,
    chainId: 137,
    chainOk: false,
    connect: vi.fn(),
    switchToPolygon: vi.fn(),
    isSwitching: false,
  },
  signAsync: vi.fn(async () => '0xsig' as `0x${string}`),
}))

vi.mock('@/features/multisig/walletActions', () => ({
  useMultisigWallet: () => wallet.state,
  useSignSafeTx: () => ({ signAsync: wallet.signAsync, isSigning: false }),
  useExecuteTransaction: () => ({ executeAsync: vi.fn(), isExecuting: false }),
  useSimulateExec: () => ({ status: 'ok', refetch: vi.fn(), isRefetching: false }),
}))

vi.mock('@/lib/multisig/safeTx', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/multisig/safeTx')>()),
  safeTxHashMatches: () => true,
}))

import OtcPage from '../OtcPage'

const OWNER = '0x444444840C416D1e7765de855c9100B0A31184d7'
const OTHER = '0x1111111111111111111111111111111111111111'

function row(over: Partial<RequestListItem>): RequestListItem {
  return {
    id: 'r',
    type: 'mint',
    userId: 'u1',
    userName: 'PT Sinar Niaga',
    userAddress: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
    amount: '50000.000000',
    amountIdr: '812500000.00',
    chain: 'polygon',
    safeType: 'MANAGER',
    status: 'PENDING_APPROVAL',
    safeTxHash: null,
    onChainTxHash: null,
    createdBy: 'stf_1',
    createdByName: 'Sarah King',
    createdAt: '2026-10-08T07:31:00.000Z',
    ...over,
  }
}

const MINT_PENDING = row({ id: 'req-mint', safeTxHash: '0xAAA1' })
const BURN_READY = row({
  id: 'req-burn',
  type: 'burn',
  userName: 'PT Arunika Dagang',
  amount: '20000.000000',
  amountIdr: '325000000.00',
  status: 'APPROVED',
  safeTxHash: '0xbbb2',
})
const MINT_DONE = row({ id: 'req-done', userName: 'PT Kala Logistik', status: 'EXECUTED' })
const BURN_REJECTED = row({ id: 'req-rej', type: 'burn', userName: 'CV Maju', status: 'REJECTED' })

function safeTx(over: Partial<SafeTxListItem>): SafeTxListItem {
  return {
    id: 'stx',
    chain: 'polygon',
    safeType: 'MANAGER',
    safeAddress: '0xaA3e70397F3668D6Fd9C25e36a6FB151241EE015',
    nonce: 4,
    activity: 'MINT',
    activityLabel: 'Mint 50.000 USDX',
    signatureProgress: { collected: 1, threshold: 2 },
    proposerType: 'BACKEND',
    proposerAddress: OTHER,
    status: 'PENDING_SIGN',
    safeTxHash: '0xaaa1',
    execTxHash: null,
    createdAt: '2026-10-08T07:31:00.000Z',
    ...over,
  }
}

const TX_SIGN = safeTx({ id: 'stx-sign' })
const TX_READY = safeTx({
  id: 'stx-ready',
  status: 'READY_TO_EXECUTE',
  safeTxHash: '0xBBB2',
  activity: 'BURN',
  signatureProgress: { collected: 2, threshold: 2 },
})

function detailOf(tx: SafeTxListItem): SafeTxDetail {
  return {
    ...tx,
    to: '0x2702d7043693651BB8A3D2Ec1C296B20692C7426',
    value: '0',
    data: '0x',
    operation: 0,
    decodedArgs: {},
    linkedRequestId: null,
    linkedOrderId: null,
    signers: [
      { address: OTHER, staffName: 'Marcus Thorne', isBackend: false, signed: true, signedAt: '2026-10-08T08:02:00.000Z' },
      { address: OWNER, staffName: 'Linda Chen', isBackend: false, signed: false, signedAt: null },
    ],
    execPayload: null,
    lastExecError: null,
    executedByStaffName: null,
    executedAt: null,
  }
}

const ok = (data: unknown, total?: number) =>
  HttpResponse.json({
    status: 'success',
    metadata: total === undefined ? null : { page: 1, limit: 20, total },
    data,
  })

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

let requestUrls: URL[] = []
let confirmBodies: unknown[] = []

beforeEach(() => {
  requestUrls = []
  confirmBodies = []
  wallet.state = {
    isConnected: false,
    address: undefined,
    chainId: 137,
    chainOk: false,
    connect: vi.fn(),
    switchToPolygon: vi.fn(),
    isSwitching: false,
  }
  wallet.signAsync.mockClear()
  server.use(
    http.get('/api/v1/requests', ({ request }) => {
      const url = new URL(request.url)
      requestUrls.push(url)
      const status = url.searchParams.get('status') ?? ''
      if (status === 'PENDING_APPROVAL,APPROVED') return ok([MINT_PENDING, BURN_READY], 2)
      return ok([MINT_DONE, BURN_REJECTED], 2)
    }),
    http.get('/api/v1/requests/:id', ({ params }) => {
      const r = [MINT_PENDING, BURN_READY, MINT_DONE, BURN_REJECTED].find((x) => x.id === params.id)
      if (!r) return HttpResponse.json({ status: 'error', data: null }, { status: 404 })
      const { type: _type, userName: _name, ...rest } = r
      void _type
      void _name
      return ok({ ...rest, idempotencyKey: 'idem-1', amountWei: '1', rateUsed: '16250.00', notes: null, updatedAt: r.createdAt })
    }),
    http.get('/api/v1/multisig', ({ request }) => {
      const status = new URL(request.url).searchParams.get('status')
      if (status === 'PENDING_SIGN') return ok([TX_SIGN], 1)
      if (status === 'READY_TO_EXECUTE') return ok([TX_READY], 1)
      return ok([], 0)
    }),
    http.get('/api/v1/multisig/safes', () => ok([])),
    http.get('/api/v1/multisig/:id', ({ params }) =>
      ok(detailOf(params.id === TX_READY.id ? TX_READY : TX_SIGN)),
    ),
    http.post('/api/v1/multisig/:id/confirm', async ({ request }) => {
      confirmBodies.push(await request.json())
      return ok(detailOf(TX_SIGN))
    }),
  )
})

function renderOtc(path = '/otc', staffEmail = 'demo@usdx.io') {
  return renderWithProviders(
    <Routes>
      <Route path="/otc" element={<OtcPage />} />
      <Route path="/otc/:id" element={<OtcPage />} />
      <Route path="/mint/new" element={<div>FORM MINT</div>} />
    </Routes>,
    { initialEntries: [path], staffId: findStaffByEmail(staffEmail)!.id },
  )
}

function groupBody(key: string) {
  return document.querySelector(`tbody[data-group="${key}"]`) as HTMLElement
}

describe('OtcPage', () => {
  describe('positive', () => {
    test('should list mint + redeem in one table, action group on top with signature status', async () => {
      renderOtc()
      const action = await waitFor(() => {
        const el = groupBody('action')
        expect(within(el).getByText('PT Sinar Niaga')).toBeInTheDocument()
        return el
      })
      expect(within(action).getByText('Perlu tindakan')).toBeInTheDocument()
      expect(await within(action).findByText('1 dari 2 tanda tangan')).toBeInTheDocument()
      expect(within(action).getByText('Siap dieksekusi')).toBeInTheDocument()
      expect(within(action).getByText('Redeem OTC')).toBeInTheDocument()

      const history = groupBody('history')
      expect(within(history).getByText('Lainnya')).toBeInTheDocument()
      expect(within(history).getByText('Selesai')).toBeInTheDocument()
      expect(within(history).getByText('Ditolak')).toBeInTheDocument()
      // The old vocabulary is gone from the screen.
      expect(screen.queryByText(/burn/i)).not.toBeInTheDocument()
    })

    test('should pull the two status groups separately, without overlap', async () => {
      renderOtc()
      await waitFor(() => expect(requestUrls.length).toBeGreaterThanOrEqual(2))
      const statuses = requestUrls.map((u) => u.searchParams.get('status'))
      expect(statuses).toContain('PENDING_APPROVAL,APPROVED')
      expect(statuses).toContain('EXECUTED,IDR_TRANSFERRED,REJECTED')
    })

    test('should open the right-hand panel on row click, keeping the table visible', async () => {
      const user = userEvent.setup()
      renderOtc()
      await user.click(await screen.findByRole('button', { name: /buka mint otc pt sinar niaga/i }))
      const panel = await screen.findByRole('region', { name: 'Detail permintaan OTC' })
      expect(within(panel).getByRole('heading', { name: 'PT Sinar Niaga' })).toBeInTheDocument()
      expect(within(panel).getByText('Yang perlu kamu lakukan')).toBeInTheDocument()
      expect(within(panel).getByText(/kurang 1 lagi/)).toBeInTheDocument()
      // Signatures by name, sentence history, folded technical detail.
      expect(await within(panel).findByText('Marcus Thorne')).toBeInTheDocument()
      expect(within(panel).getByText('Sarah King membuat permintaan mint OTC')).toBeInTheDocument()
      expect(within(panel).getByRole('button', { name: /detail teknis/i })).toHaveAttribute('aria-expanded', 'false')
      // The table is still there (no overlay).
      expect(groupBody('action')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /buka mint otc pt sinar niaga/i })).toHaveAttribute('aria-current', 'true')
    })

    test('should sign from the panel after an inline "Sudah benar semua?" that names the amount', async () => {
      wallet.state = { ...wallet.state, isConnected: true, address: OWNER, chainOk: true }
      const user = userEvent.setup()
      renderOtc('/otc/req-mint')
      const panel = await screen.findByRole('region', { name: 'Detail permintaan OTC' })
      const signBtn = await within(panel).findByRole('button', { name: 'Tanda tangani di wallet' })
      await waitFor(() => expect(signBtn).toBeEnabled())
      await user.click(signBtn)
      expect(within(panel).getByText('Sudah benar semua?')).toBeInTheDocument()
      expect(within(panel).getByText(/Cetak 50\.000,00 USDX ke wallet/)).toBeInTheDocument()
      expect(within(panel).getByText('Senilai Rp 812.500.000')).toBeInTheDocument()
      await user.click(within(panel).getByRole('button', { name: 'Ya, tanda tangani' }))
      await waitFor(() => expect(confirmBodies).toEqual([{ signerAddress: OWNER, signature: '0xsig' }]))
      expect(wallet.signAsync).toHaveBeenCalledTimes(1)
    })

    test('should offer "Buat mint OTC" and "Buat redeem OTC" to roles that may submit', async () => {
      const user = userEvent.setup()
      renderOtc()
      expect(screen.getByRole('button', { name: 'Buat redeem OTC' })).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Buat mint OTC' }))
      expect(screen.getByText('FORM MINT')).toBeInTheDocument()
    })
  })

  describe('negative', () => {
    test('should ask to connect the wallet first instead of offering a dead sign button', async () => {
      const user = userEvent.setup()
      renderOtc('/otc/req-mint')
      const panel = await screen.findByRole('region', { name: 'Detail permintaan OTC' })
      await user.click(await within(panel).findByRole('button', { name: 'Hubungkan wallet' }))
      expect(wallet.state.connect).toHaveBeenCalledTimes(1)
    })

    test('should disable signing with the reason when the wallet is not a Safe owner', async () => {
      wallet.state = { ...wallet.state, isConnected: true, address: '0x9999999999999999999999999999999999999999', chainOk: true }
      renderOtc('/otc/req-mint')
      const panel = await screen.findByRole('region', { name: 'Detail permintaan OTC' })
      const btn = await within(panel).findByRole('button', { name: 'Tanda tangani di wallet' })
      await waitFor(() => expect(btn).toHaveAccessibleDescription('Wallet yang terhubung bukan owner Safe ini'))
      expect(btn).toBeDisabled()
    })

    test('should hide the create buttons from DEVELOPER (cannot submit OTC)', async () => {
      renderOtc('/otc', 'marcus.a@usdx.io')
      await screen.findByText('PT Sinar Niaga')
      expect(screen.queryByRole('button', { name: 'Buat mint OTC' })).not.toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    test('should open a finished request from a direct link with no primary action', async () => {
      renderOtc('/otc/req-done')
      const panel = await screen.findByRole('region', { name: 'Detail permintaan OTC' })
      expect(await within(panel).findByText('Selesai. USDX sudah dicetak ke wallet nasabah.')).toBeInTheDocument()
      expect(within(panel).queryByRole('button', { name: /tanda tangani|eksekusi|hubungkan/i })).not.toBeInTheDocument()
    })

    test('should close the panel and go back to the table', async () => {
      const user = userEvent.setup()
      renderOtc('/otc/req-done')
      const panel = await screen.findByRole('region', { name: 'Detail permintaan OTC' })
      await user.click(within(panel).getByRole('button', { name: /^tutup$/i }))
      await waitFor(() =>
        expect(screen.queryByRole('region', { name: 'Detail permintaan OTC' })).not.toBeInTheDocument(),
      )
    })

    test('should send the search and kind filter to both pulls', async () => {
      const user = userEvent.setup()
      renderOtc()
      await screen.findByText('PT Sinar Niaga')
      await user.selectOptions(screen.getByLabelText('Jenis'), 'burn')
      await user.type(screen.getByRole('textbox', { name: 'Cari permintaan OTC' }), 'arunika')
      await waitFor(() => {
        const last = requestUrls.filter((u) => u.searchParams.get('search') === 'arunika')
        expect(last.map((u) => u.searchParams.get('status')).sort()).toEqual([
          'EXECUTED,IDR_TRANSFERRED,REJECTED',
          'PENDING_APPROVAL,APPROVED',
        ])
        expect(last.every((u) => u.searchParams.get('type') === 'burn')).toBe(true)
      })
    })
  })
})
