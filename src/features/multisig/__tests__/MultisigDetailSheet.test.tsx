import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { SafeMeta, SafeTxDetail, SafeTxSigner } from '@/lib/types'

// Owner-verification is driven purely by the data returned from useMultisigDetail
// + useSafes + useMultisigWallet, so we mock those hooks to control each state.
// resolveOwnerCheck / resolveOwnerVerification (the code under test) stay REAL.
const state = vi.hoisted(() => ({
  detail: undefined as unknown,
  safes: undefined as unknown,
  wallet: undefined as unknown,
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
  useSimulateExec: () => ({ status: 'idle' }),
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

function renderSheet() {
  return render(<MultisigDetailSheet txId={ID} open onOpenChange={() => {}} listItem={null} />)
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
