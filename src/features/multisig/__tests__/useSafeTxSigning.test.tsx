import { describe, test, expect, vi, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'

// Hasil wallet (tanda tangan / hash eksekusi) harus dikirim ke transaksi yang
// DITANDATANGANI, walau baris yang tampil berganti selama wallet terbuka
// (verifikator netral 11 Okt 2026: Tab + Enter ke baris lain di belakang dialog
// non-modal walletSafe).
const state = vi.hoisted(() => ({
  confirm: vi.fn(),
  execute: vi.fn(),
  cancel: vi.fn(),
  signAsync: vi.fn(),
  executeAsync: vi.fn(),
}))

vi.mock('../hooks', () => ({
  useMultisigDetail: (id: string | null) => ({ data: id ? { id, status: 'READY_TO_EXECUTE', signers: [], activity: 'MINT' } : undefined }),
  useSafes: () => ({ data: [] }),
  useConfirmSignature: () => ({ mutateAsync: state.confirm, isPending: false }),
  useExecuteSafeTx: () => ({ mutateAsync: state.execute, isPending: false }),
  useCancelSafeTx: () => ({ mutateAsync: state.cancel, isPending: false }),
}))

vi.mock('../walletActions', () => ({
  useMultisigWallet: () => ({ address: '0x00000000000000000000000000000000000000a1', isConnected: true, chainOk: true }),
  useSignSafeTx: () => ({ signAsync: state.signAsync, isSigning: false }),
  useExecuteTransaction: () => ({ executeAsync: state.executeAsync, isExecuting: false }),
  useSimulateExec: () => ({ status: 'ok' }),
}))

vi.mock('@/lib/auth', () => ({ useAuth: () => ({ user: { role: 'ADMIN' } }) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { useSafeTxSigning } from '../useSafeTxSigning'

function deferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((r) => (resolve = r))
  return { promise, resolve }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useSafeTxSigning', () => {
  describe('positive', () => {
    test('should post the execute hash to the transaction that was executed', async () => {
      state.executeAsync.mockResolvedValue('0xexec')
      const { result } = renderHook(() => useSafeTxSigning('tx_A'))
      await act(() => result.current.handleExecute())
      expect(state.execute).toHaveBeenCalledWith({ id: 'tx_A', body: { execTxHash: '0xexec' } })
    })
  })

  describe('negative', () => {
    test('should NOT post the execute hash to another row opened while the wallet was open', async () => {
      const wallet = deferred<string>()
      state.executeAsync.mockReturnValue(wallet.promise)
      const { result, rerender } = renderHook(({ id }) => useSafeTxSigning(id), { initialProps: { id: 'tx_A' } })

      let running!: Promise<void>
      act(() => {
        running = result.current.handleExecute()
      })
      rerender({ id: 'tx_B' })
      await act(async () => {
        wallet.resolve('0xhashA')
        await running
      })

      expect(state.execute).toHaveBeenCalledTimes(1)
      expect(state.execute).toHaveBeenCalledWith({ id: 'tx_A', body: { execTxHash: '0xhashA' } })
    })

    test('should NOT post a signature to another row opened while the wallet was open', async () => {
      const wallet = deferred<string>()
      state.signAsync.mockReturnValue(wallet.promise)
      const { result, rerender } = renderHook(({ id }) => useSafeTxSigning(id), { initialProps: { id: 'tx_A' } })

      let running!: Promise<void>
      act(() => {
        running = result.current.handleSign()
      })
      rerender({ id: 'tx_B' })
      await act(async () => {
        wallet.resolve('0xsig')
        await running
      })

      expect(state.confirm).toHaveBeenCalledWith({
        id: 'tx_A',
        body: { signerAddress: '0x00000000000000000000000000000000000000a1', signature: '0xsig' },
      })
    })
  })

  describe('edge cases', () => {
    test('should not post anything when the wallet rejects', async () => {
      state.executeAsync.mockRejectedValue(new Error('User rejected the request'))
      const { result } = renderHook(() => useSafeTxSigning('tx_A'))
      await act(() => result.current.handleExecute())
      expect(state.execute).not.toHaveBeenCalled()
    })
  })
})
