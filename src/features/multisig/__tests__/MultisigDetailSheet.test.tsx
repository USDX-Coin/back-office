import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { SafeMeta, SafeTxDetail, SafeTxListItem, SafeTxSigner } from '@/lib/types'

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

import MultisigDetailSheet from '../MultisigDetailSheet'

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

// The queue row the drawer was opened from. Its status is a second, independently
// polled opinion about the same transaction.
function makeListItem(overrides: Partial<SafeTxListItem> = {}): SafeTxListItem {
  return {
    id: ID,
    chain: 'polygon',
    safeType: 'STAFF',
    safeAddress: SAFE_ADDR,
    nonce: 5,
    activity: 'MINT',
    activityLabel: 'Mint 100 USDX',
    signatureProgress: { collected: 2, threshold: 2 },
    proposerType: 'BACKEND',
    proposerAddress: OTHER,
    status: 'CONFIRMING',
    safeTxHash: '0xhash',
    execTxHash: null,
    createdAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  }
}

function renderSheet(listItem: SafeTxListItem | null = null) {
  return render(
    <MultisigDetailSheet txId={ID} open onOpenChange={() => {}} listItem={listItem} />,
  )
}

const signBtn = () => screen.getByRole('button', { name: /Sign \(EIP-712\)/ })

describe('MultisigDetailSheet owner verification', () => {
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
      expect(screen.getByText('· owner')).toBeInTheDocument()
      expect(signBtn()).toBeEnabled()
    })

    test('empty signers but safes owners include wallet → owner via fallback, Sign enabled', () => {
      setDetail({ signers: [] })
      setSafes([safeMeta([OWNER, OTHER])])
      renderSheet()
      expect(screen.getByText('· owner')).toBeInTheDocument()
      expect(signBtn()).toBeEnabled()
    })
  })

  describe('negative', () => {
    test('signers present but wallet absent → not-owner, Sign disabled', () => {
      setDetail({ signers: [signer(OTHER)] })
      renderSheet()
      expect(screen.getByText('· not an owner')).toBeInTheDocument()
      const btn = signBtn()
      expect(btn).toBeDisabled()
      expect(btn).toHaveAttribute('title', expect.stringContaining('not an owner'))
    })
  })

  describe('edge cases', () => {
    test('empty signers + safes still loading → checking (transient), Sign disabled', () => {
      setDetail({ signers: [] })
      setSafes(undefined, { isLoading: true, isFetching: true })
      renderSheet()
      expect(screen.getByText(/verifying owner/)).toBeInTheDocument()
      const btn = signBtn()
      expect(btn).toBeDisabled()
      expect(btn).toHaveAttribute('title', expect.stringContaining('Verifying Safe ownership'))
    })

    test('empty signers + safes settled empty → unavailable, Retry refetches both', () => {
      setDetail({ signers: [] })
      setSafes([])
      renderSheet()
      expect(screen.getByText(/owner list is unavailable/)).toBeInTheDocument()
      expect(signBtn()).toBeDisabled()

      fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
      expect(refetchDetail).toHaveBeenCalledTimes(1)
      expect(refetchSafes).toHaveBeenCalledTimes(1)
    })

    test('flicker guard: empty signers + safes settled empty + detail poll refetching → stays unavailable', () => {
      // safes has settled (isLoading:false) but a 12s detail poll is in flight
      // (isFetching:true). Must remain 'unavailable', never revert to "Verifying…".
      setDetail({ signers: [] }, { isFetching: true })
      setSafes([], { isFetching: true })
      renderSheet()
      expect(screen.getByText('· ownership unknown')).toBeInTheDocument()
      expect(screen.queryByText(/verifying owner/)).not.toBeInTheDocument()
      expect(screen.getByText(/owner list is unavailable/)).toBeInTheDocument()
    })
  })
})

// The drawer and the queue row are separate queries on separate poll clocks, so
// they disagree for a few seconds at a time. Reproduces the reported bug: the
// list said Confirming, the drawer replayed a cached PENDING_SIGN snapshot and
// invited the operator to connect a wallet and sign a transaction that had
// already been signed and broadcast.
describe('MultisigDetailSheet status reconciliation with the queue row', () => {
  beforeEach(() => {
    refetchDetail = vi.fn()
    refetchSafes = vi.fn()
    state.wallet = {
      isConnected: false,
      address: undefined,
      chainId: 137,
      chainOk: false,
      connect: vi.fn(),
      switchToPolygon: vi.fn(),
      isSwitching: false,
    }
    setDetail({ signers: [signer(OWNER), signer(OTHER)] })
    setSafes([safeMeta([OWNER, OTHER])])
    state.simulate = { status: 'idle', refetch: vi.fn(), isRefetching: false }
  })

  describe('positive', () => {
    test('stale PENDING_SIGN detail + Confirming row → no Sign, no Connect wallet', () => {
      renderSheet(makeListItem({ status: 'CONFIRMING' }))
      expect(screen.queryByRole('button', { name: /Sign \(EIP-712\)/ })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Connect wallet' })).not.toBeInTheDocument()
      // …and the panel reads the same status the operator saw in the queue.
      expect(screen.getByText('Confirming')).toBeInTheDocument()
      expect(screen.queryByText('Pending sign')).not.toBeInTheDocument()
    })

    test('row already Executed → the drawer offers no action at all', () => {
      setDetail({ status: 'READY_TO_EXECUTE', signers: [signer(OWNER, true), signer(OTHER, true)] })
      state.wallet = { ...(state.wallet as object), isConnected: true, address: OWNER, chainOk: true }
      renderSheet(makeListItem({ status: 'EXECUTED' }))
      expect(screen.queryByRole('button', { name: 'Execute' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Sign \(EIP-712\)/ })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument()
      expect(screen.getByText('Executed')).toBeInTheDocument()
    })
  })

  describe('negative', () => {
    test('a row that is BEHIND the detail never re-enables Sign', () => {
      // The list is the stale one this time: it still says Pending sign for a
      // transaction the detail knows is already broadcast.
      setDetail({ status: 'CONFIRMING', signers: [signer(OWNER, true), signer(OTHER, true)] })
      renderSheet(makeListItem({ status: 'PENDING_SIGN' }))
      expect(screen.queryByRole('button', { name: /Sign \(EIP-712\)/ })).not.toBeInTheDocument()
      expect(screen.getByText('Confirming')).toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    test('both views agree on a signable state → Sign is still offered', () => {
      renderSheet(makeListItem({ status: 'PENDING_SIGN' }))
      expect(screen.getByRole('button', { name: /Sign \(EIP-712\)/ })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Connect wallet' })).toBeInTheDocument()
    })

    test('deep link with no row in the current page falls back to the detail', () => {
      // /multisig/:id opened straight from a URL — the queue page may not hold
      // the row at all, so there is no second opinion to reconcile against.
      renderSheet(null)
      expect(screen.getByRole('button', { name: /Sign \(EIP-712\)/ })).toBeInTheDocument()
      expect(screen.getByText('Pending sign')).toBeInTheDocument()
    })
  })
})

// Execute is gated by the pre-execute simulate. A transport/RPC failure must read
// as "unavailable" (retryable), NOT a false "would revert".
describe('MultisigDetailSheet execute simulate gate', () => {
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

  const execBtn = () => screen.getByRole('button', { name: 'Execute' })

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
      expect(screen.getByText(/Simulation passed/)).toBeInTheDocument()
      expect(execBtn()).toBeEnabled()
    })
  })

  describe('negative', () => {
    test('simulate revert → Execute disabled, shows "Would revert"', () => {
      state.simulate = {
        status: 'revert',
        reason: 'The USDX contract is paused — unpause before this can execute.',
        refetch: vi.fn(),
        isRefetching: false,
      }
      renderSheet()
      expect(screen.getByText(/Would revert/)).toBeInTheDocument()
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
      expect(screen.getByText(/Simulation unavailable/)).toBeInTheDocument()
      expect(screen.queryByText(/Would revert/)).not.toBeInTheDocument()
      expect(execBtn()).toBeDisabled()

      fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
      expect(simRefetch).toHaveBeenCalledTimes(1)
    })
  })
})
