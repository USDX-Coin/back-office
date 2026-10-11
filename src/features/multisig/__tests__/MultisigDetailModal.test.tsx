import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import type { SafeMeta, SafeTxDetail, SafeTxSigner } from '@/lib/types'

// Owner-verification is driven purely by the data returned from useMultisigDetail
// + useSafes + useMultisigWallet, so we mock those hooks to control each state.
// resolveOwnerCheck / resolveOwnerVerification (the code under test) stay REAL.
const state = vi.hoisted(() => ({
  detail: undefined as unknown,
  safes: undefined as unknown,
  wallet: undefined as unknown,
  simulate: undefined as unknown,
}))

vi.mock('../hooks', () => ({
  useMultisigDetail: () => state.detail,
  useSafes: () => state.safes,
  useConfirmSignature: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useExecuteSafeTx: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCancelSafeTx: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

vi.mock('../walletActions', () => ({
  useMultisigWallet: () => state.wallet,
  useSignSafeTx: () => ({ signAsync: vi.fn(), isSigning: false }),
  useExecuteTransaction: () => ({ executeAsync: vi.fn(), isExecuting: false }),
  useSimulateExec: () => state.simulate,
}))

vi.mock('@/features/chains/hooks', () => ({ useChainConfig: () => ({ data: [] }) }))
vi.mock('@/lib/auth', () => ({ useAuth: () => ({ user: { role: 'ADMIN' } }) }))

// Keep the SafeTx hash guard from blocking Sign in the "owner" cases — we only
// exercise the owner-check here, not EIP-712 hashing.
vi.mock('@/lib/multisig/safeTx', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/multisig/safeTx')>()),
  safeTxHashMatches: () => true,
}))

import MultisigDetailModal from '../MultisigDetailModal'

const ID = '019f1cb1-57d3-73a4-b4fb-3d510ba4aa94'
const OWNER = '0x444444840C416D1e7765de855c9100B0A31184d7'
const OTHER = '0x1111111111111111111111111111111111111111'
const SAFE_ADDR = '0xaA3e70397F3668D6Fd9C25e36a6FB151241EE015'

function signer(address: string, signed = false): SafeTxSigner {
  return { address, staffName: null, isBackend: false, signed, signedAt: null }
}

function makeDetail(overrides: Partial<SafeTxDetail> = {}): SafeTxDetail {
  return {
    id: ID,
    chain: 'polygon',
    safeType: 'STAFF',
    safeAddress: SAFE_ADDR,
    nonce: 5,
    activity: 'MINT',
    activityLabel: 'Mint 100 USDX',
    signatureProgress: { collected: 0, threshold: 2 },
    proposerType: 'BACKEND',
    proposerAddress: OTHER,
    status: 'PENDING_SIGN',
    safeTxHash: '0xhash',
    execTxHash: null,
    createdAt: '2026-07-01T00:00:00.000Z',
    to: '0x2702d7043693651BB8A3D2Ec1C296B20692C7426',
    value: '0',
    data: '0x',
    operation: 0,
    decodedArgs: {},
    linkedRequestId: null,
    linkedOrderId: null,
    signers: [],
    execPayload: null,
    lastExecError: null,
    executedByStaffName: null,
    executedAt: null,
    ...overrides,
  }
}

function safeMeta(owners: string[]): SafeMeta {
  return {
    chain: 'polygon',
    safeType: 'STAFF',
    safeAddress: SAFE_ADDR,
    threshold: 2,
    owners,
    nonce: 5,
    balanceNative: '0',
    lastSyncedAt: '2026-07-01T00:00:00.000Z',
  }
}

let refetchDetail: ReturnType<typeof vi.fn>
let refetchSafes: ReturnType<typeof vi.fn>

function setDetail(over: Partial<SafeTxDetail> = {}, flags: Record<string, unknown> = {}) {
  state.detail = {
    data: makeDetail(over),
    isLoading: false,
    isError: false,
    isFetching: false,
    error: null,
    refetch: refetchDetail,
    ...flags,
  }
}

function setSafes(data: SafeMeta[] | undefined, flags: Record<string, unknown> = {}) {
  state.safes = {
    data,
    isLoading: false,
    isFetching: false,
    refetch: refetchSafes,
    ...flags,
  }
}

function renderSheet() {
  return render(
    <MemoryRouter>
      <MultisigDetailModal txId={ID} onClose={() => {}} listItem={null} nav={null} />
    </MemoryRouter>,
  )
}

const signBtn = () => screen.getByRole('button', { name: /^Tanda tangani$/ })
const walletLine = () => screen.getByTestId('multisig-wallet-line')

describe('MultisigDetailModal owner verification', () => {
  beforeEach(() => {
    refetchDetail = vi.fn()
    refetchSafes = vi.fn()
    state.wallet = {
      isConnected: true,
      address: OWNER,
      chainId: 137,
      chainOk: true,
      connect: vi.fn(),
      switchToPolygon: vi.fn(),
      isSwitching: false,
    }
    setDetail()
    setSafes([])
    state.simulate = { status: 'idle', refetch: vi.fn(), isRefetching: false }
  })

  describe('positive', () => {
    test('wallet in detail.signers → owner, Sign enabled (primary source)', () => {
      setDetail({ signers: [signer(OWNER), signer(OTHER)] })
      renderSheet()
      expect(walletLine()).toHaveTextContent('kamu pemilik Safe ini')
      expect(signBtn()).toBeEnabled()
    })

    test('empty signers but safes owners include wallet → owner via fallback, Sign enabled', () => {
      setDetail({ signers: [] })
      setSafes([safeMeta([OWNER, OTHER])])
      renderSheet()
      expect(walletLine()).toHaveTextContent('kamu pemilik Safe ini')
      expect(signBtn()).toBeEnabled()
    })
  })

  describe('negative', () => {
    test('signers present but wallet absent → not-owner, Sign disabled', () => {
      setDetail({ signers: [signer(OTHER)] })
      renderSheet()
      expect(walletLine()).toHaveTextContent('wallet ini bukan pemilik Safe ini')
      const btn = signBtn()
      expect(btn).toBeDisabled()
      expect(screen.getByText('Wallet yang terhubung bukan pemilik Safe ini.')).toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    test('empty signers + safes still loading → checking (transient), Sign disabled', () => {
      setDetail({ signers: [] })
      setSafes(undefined, { isLoading: true, isFetching: true })
      renderSheet()
      expect(walletLine()).toHaveTextContent('memeriksa…')
      const btn = signBtn()
      expect(btn).toBeDisabled()
      expect(screen.getByText('Memeriksa apakah wallet ini pemilik Safe…')).toBeInTheDocument()
    })

    test('empty signers + safes settled empty → unavailable, Retry refetches both', () => {
      setDetail({ signers: [] })
      setSafes([])
      renderSheet()
      expect(screen.getByText(/Belum bisa memastikan wallet ini pemilik Safe\./)).toBeInTheDocument()
      expect(signBtn()).toBeDisabled()

      fireEvent.click(screen.getByRole('button', { name: 'Coba lagi' }))
      expect(refetchDetail).toHaveBeenCalledTimes(1)
      expect(refetchSafes).toHaveBeenCalledTimes(1)
    })

    test('flicker guard: empty signers + safes settled empty + detail poll refetching → stays unavailable', () => {
      // safes has settled (isLoading:false) but a 12s detail poll is in flight
      // (isFetching:true). Must remain 'unavailable', never revert to "Verifying…".
      setDetail({ signers: [] }, { isFetching: true })
      setSafes([], { isFetching: true })
      renderSheet()
      expect(walletLine()).toHaveTextContent('status pemilik belum diketahui')
      expect(walletLine()).not.toHaveTextContent('memeriksa')
      expect(screen.getByText(/Belum bisa memastikan wallet ini pemilik Safe\./)).toBeInTheDocument()
    })
  })
})

// Execute is gated by the pre-execute simulate. A transport/RPC failure must read
// as "unavailable" (retryable), NOT a false "would revert".
describe('MultisigDetailModal execute simulate gate', () => {
  const EXEC_PAYLOAD = {
    to: '0x2702d7043693651BB8A3D2Ec1C296B20692C7426',
    value: '0',
    data: '0x',
    operation: 0,
    safeTxGas: '0',
    baseGas: '0',
    gasPrice: '0',
    gasToken: '0x0000000000000000000000000000000000000000',
    refundReceiver: '0x0000000000000000000000000000000000000000',
    signatures: '0x',
  }

  function setExecutable() {
    setDetail({
      status: 'READY_TO_EXECUTE',
      signers: [signer(OWNER, true), signer(OTHER, true)],
      signatureProgress: { collected: 2, threshold: 2 },
      execPayload: EXEC_PAYLOAD,
    })
    setSafes([safeMeta([OWNER, OTHER])])
  }

  const execBtn = () => screen.getByRole('button', { name: /^Eksekusi$/ })

  beforeEach(() => {
    refetchDetail = vi.fn()
    refetchSafes = vi.fn()
    state.wallet = {
      isConnected: true,
      address: OWNER,
      chainId: 137,
      chainOk: true,
      connect: vi.fn(),
      switchToPolygon: vi.fn(),
      isSwitching: false,
    }
    setExecutable()
  })

  describe('positive', () => {
    test('simulate ok → Execute enabled', () => {
      state.simulate = { status: 'ok', refetch: vi.fn(), isRefetching: false }
      renderSheet()
      expect(screen.getByText(/Uji coba eksekusi lolos/)).toBeInTheDocument()
      expect(execBtn()).toBeEnabled()
    })
  })

  describe('negative', () => {
    test('simulate revert → Execute disabled, shows "akan ditolak"', () => {
      state.simulate = {
        status: 'revert',
        reason: 'Kontrak USDX sedang dihentikan sementara (EnforcedPause) — jalankan kembali dulu sebelum transaksi ini bisa dieksekusi.',
        refetch: vi.fn(),
        isRefetching: false,
      }
      renderSheet()
      expect(screen.getByText(/Eksekusi akan ditolak:/)).toBeInTheDocument()
      expect(execBtn()).toBeDisabled()
    })
  })

  describe('edge cases', () => {
    test('simulate error (RPC unreachable) → unavailable, not a revert, Retry refetches', () => {
      const simRefetch = vi.fn()
      state.simulate = {
        status: 'error',
        reason: 'HTTP request failed.',
        refetch: simRefetch,
        isRefetching: false,
      }
      renderSheet()
      expect(screen.getByText(/Uji coba eksekusi tidak bisa dijalankan/)).toBeInTheDocument()
      expect(screen.queryByText(/Eksekusi akan ditolak:/)).not.toBeInTheDocument()
      expect(execBtn()).toBeDisabled()

      fireEvent.click(screen.getByRole('button', { name: 'Coba lagi' }))
      expect(simRefetch).toHaveBeenCalledTimes(1)
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// § 4 P0-2 — order asal bisa dibuka langsung dari modal (tautan, bukan teks).
// Ops-fokus (Okt 2026): tautannya berbunyi "Buka transaksi asal"; id mentahnya
// pindah ke Detail teknis.
// ─────────────────────────────────────────────────────────────────────────────
describe('MultisigDetailModal — tautan ke order asalnya (P0-2)', () => {
  const ORDER_ID = 'ord_9f3a2b'

  beforeEach(() => {
    refetchDetail = vi.fn()
    refetchSafes = vi.fn()
    setSafes([safeMeta([OWNER])])
    state.wallet = { address: OTHER, isConnected: true, chainOk: true }
    state.simulate = { status: 'idle', reason: null, refetch: vi.fn(), isRefetching: false }
  })

  describe('positive', () => {
    test('tautan "Buka transaksi asal" menuju /transactions/:id', () => {
      setDetail({ linkedOrderId: ORDER_ID })
      renderSheet()
      expect(screen.getByRole('link', { name: 'Buka transaksi asal' })).toHaveAttribute('href', `/transactions/${ORDER_ID}`)
    })
  })

  describe('negative', () => {
    test('tanpa linkedOrderId tidak ada tautan yang mengarang tujuan', () => {
      setDetail({ linkedOrderId: null })
      renderSheet()
      expect(screen.queryByRole('link', { name: /transaksi asal/i })).not.toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    test('id order mentah tetap ada di Detail teknis (dilipat, tidak dibuang)', () => {
      setDetail({ linkedOrderId: ORDER_ID })
      renderSheet()
      expect(screen.getByTestId('detail-teknis')).toHaveTextContent(ORDER_ID)
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Ops-fokus (PM Okt 2026): di depan hanya transaksi dalam kata — alamat, hash,
// calldata, nonce, operasi, jaringan pindah ke Detail teknis. Pagar kecocokan
// isi transaksi vs server WAJIB tetap ada dan mengunci tanda tangan + eksekusi.
// ─────────────────────────────────────────────────────────────────────────────
describe('MultisigDetailModal — bahasa ops', () => {
  const NAMED = { address: OWNER, staffName: 'Linda Chen', isBackend: false, signed: true, signedAt: '2026-09-12T01:00:09.000Z' }
  const PENDING = { address: OTHER, staffName: 'Marcus Thorne', isBackend: false, signed: false, signedAt: null }

  beforeEach(() => {
    refetchDetail = vi.fn()
    refetchSafes = vi.fn()
    setSafes([safeMeta([OWNER, OTHER])])
    state.wallet = { address: OWNER, isConnected: true, chainId: 137, chainOk: true, connect: vi.fn(), switchToPolygon: vi.fn(), isSwitching: false }
    state.simulate = { status: 'idle', reason: null, refetch: vi.fn(), isRefetching: false }
  })

  describe('positive', () => {
    test('judul, status kalimat, Safe sebagai kata, penanda tangan dengan nama', () => {
      setDetail({
        activityLabel: `Mint 100 USDX → ${OTHER}`,
        signers: [NAMED, PENDING],
        signatureProgress: { collected: 1, threshold: 2 },
      })
      renderSheet()
      expect(screen.getByRole('heading', { name: 'Mint 100 USDX' })).toBeInTheDocument()
      expect(screen.getByTestId('multisig-status-sentence')).toHaveTextContent('Menunggu 1 tanda tangan lagi')
      expect(screen.getAllByText('Safe Staf').length).toBeGreaterThan(0)
      const signers = screen.getByTestId('multisig-signers')
      expect(signers).toHaveTextContent('Linda Chen')
      expect(signers).toHaveTextContent('Sudah · 12 Sep 2026, 08:00:09')
      expect(signers).toHaveTextContent('Marcus Thorne')
      expect(signers).toHaveTextContent('Belum')
      expect(signers).not.toHaveTextContent('0x')
    })
  })

  describe('negative', () => {
    test('isi tidak cocok dengan server → peringatan di atas, tombol terkunci', async () => {
      const safeTx = await import('@/lib/multisig/safeTx')
      const spy = vi.spyOn(safeTx, 'safeTxHashMatches').mockReturnValue(false)
      setDetail({ signers: [NAMED, PENDING] })
      renderSheet()
      expect(screen.getByTestId('multisig-mismatch')).toHaveTextContent('tidak cocok dengan data server')
      expect(signBtn()).toBeDisabled()
      spy.mockRestore()
    })
  })

  describe('edge cases', () => {
    test('alamat, hash, calldata, nonce hanya di Detail teknis', () => {
      setDetail({ signers: [NAMED, PENDING], safeTxHash: '0xabc123def456', data: '0xdeadbeef', nonce: 42 })
      renderSheet()
      const teknis = screen.getByTestId('detail-teknis')
      expect(teknis).toHaveTextContent(SAFE_ADDR)
      expect(teknis).toHaveTextContent('0xabc123def456')
      expect(teknis).toHaveTextContent('0xdeadbeef')
      expect(teknis).toHaveTextContent('42')
      expect(teknis).toHaveAttribute('data-state', 'closed')
      // Di luar Detail teknis tidak ada alamat/hash.
      const front = screen.getByTestId('multisig-modal').cloneNode(true) as HTMLElement
      front.querySelector('[data-testid="detail-teknis"]')?.remove()
      expect(front.textContent).not.toMatch(/0x[0-9a-fA-F]{6,}/)
    })
  })
})
