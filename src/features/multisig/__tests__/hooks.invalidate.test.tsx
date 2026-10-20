import { describe, test, expect, vi, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

// Sesudah tanda tangan / eksekusi / batal, daftar, angka antrean, dan detail
// transaksi YANG DIKIRIM (id variabel mutasi, bukan baris yang sedang tampil)
// harus dimuat ulang — kalau tidak, modal tetap menampilkan status lama. Begitu
// juga layar alur uang lain yang merender order di balik transaksi itu
// (Transaksi, rincian order, OTC, badge sidebar — lib/moneyFlowViews).
const apiFetch = vi.hoisted(() => vi.fn())
vi.mock('@/lib/apiFetch', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/apiFetch')>()),
  apiFetch,
}))

import { MONEY_FLOW_VIEW_KEYS } from '@/lib/moneyFlowViews'
import {
  multisigDetailPollInterval,
  SAFE_TX_CONFIRMING_POLL_MS,
  SAFE_TX_DETAIL_POLL_MS,
  useCancelSafeTx,
  useConfirmSignature,
  useExecuteSafeTx,
  useProposeGovernance,
} from '../hooks'

function setup<T>(useHook: () => T) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const invalidate = vi.spyOn(qc, 'invalidateQueries')
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  const { result } = renderHook(useHook, { wrapper })
  const keys = () => invalidate.mock.calls.map(([filters]) => filters?.queryKey)
  return { result, keys }
}

const CASES = [
  {
    name: 'useConfirmSignature',
    hook: useConfirmSignature,
    path: 'confirm',
    body: { signerAddress: '0x00000000000000000000000000000000000000a1', signature: '0xsig' },
  },
  { name: 'useExecuteSafeTx', hook: useExecuteSafeTx, path: 'execute', body: { execTxHash: '0xexec' } },
  { name: 'useCancelSafeTx', hook: useCancelSafeTx, path: 'cancel', body: { reason: 'salah nominal' } },
] as const

beforeEach(() => {
  apiFetch.mockReset()
})

describe('multisig mutations — muat ulang sesudah berhasil', () => {
  describe('positive', () => {
    test.each(CASES)('$name should refresh list, count, and the detail of the posted id', async ({ hook, path, body }) => {
      apiFetch.mockResolvedValue({})
      const { result, keys } = setup(hook as () => ReturnType<typeof useExecuteSafeTx>)
      await act(() => result.current.mutateAsync({ id: 'tx_A', body } as never))
      expect(apiFetch).toHaveBeenCalledWith(`/api/v1/multisig/tx_A/${path}`, { method: 'POST', body })
      expect(keys()).toEqual(
        expect.arrayContaining([
          ['multisig', 'list'],
          ['multisig', 'count'],
          ['multisig', 'detail', 'tx_A'],
        ]),
      )
    })

    test.each(CASES)('$name should refresh every money-flow view, not just the Safe queue', async ({ hook, body }) => {
      // Order di balik mint yang ditandatangani tetap "Menunggu pembayaran" di
      // Transaksi kalau yang disegarkan hanya `['multisig', …]`.
      apiFetch.mockResolvedValue({})
      const { result, keys } = setup(hook as () => ReturnType<typeof useExecuteSafeTx>)
      await act(() => result.current.mutateAsync({ id: 'tx_A', body } as never))
      expect(keys()).toEqual(expect.arrayContaining(MONEY_FLOW_VIEW_KEYS.map((k) => [...k])))
      expect(keys()).toEqual(expect.arrayContaining([['orders', 'list'], ['backoffice-transactions'], ['requests'], ['queue-counts']]))
    })

    test('useProposeGovernance should refresh the money-flow views (queue + counts included)', async () => {
      apiFetch.mockResolvedValue({})
      const { result, keys } = setup(useProposeGovernance)
      await act(() => result.current.mutateAsync({} as never))
      expect(keys()).toEqual(MONEY_FLOW_VIEW_KEYS.map((k) => [...k]))
    })
  })

  describe('negative', () => {
    test.each(CASES)('$name should NOT refresh anything when the request fails', async ({ hook, body }) => {
      apiFetch.mockRejectedValue(new Error('409'))
      const { result, keys } = setup(hook as () => ReturnType<typeof useExecuteSafeTx>)
      await act(async () => {
        await expect(result.current.mutateAsync({ id: 'tx_A', body } as never)).rejects.toThrow('409')
      })
      expect(keys()).toEqual([])
    })
  })

  describe('edge cases', () => {
    test.each(CASES)('$name should refresh the id of each call, not the first one', async ({ hook, body }) => {
      apiFetch.mockResolvedValue({})
      const { result, keys } = setup(hook as () => ReturnType<typeof useExecuteSafeTx>)
      await act(() => result.current.mutateAsync({ id: 'tx_A', body } as never))
      await act(() => result.current.mutateAsync({ id: 'tx_B', body } as never))
      const details = keys().filter((k) => k?.[1] === 'detail')
      expect(details).toEqual([
        ['multisig', 'detail', 'tx_A'],
        ['multisig', 'detail', 'tx_B'],
      ])
    })
  })
})

describe('multisigDetailPollInterval', () => {
  describe('positive', () => {
    test('should poll faster while the execution is CONFIRMING on-chain', () => {
      expect(multisigDetailPollInterval('CONFIRMING')).toBe(SAFE_TX_CONFIRMING_POLL_MS)
      expect(SAFE_TX_CONFIRMING_POLL_MS).toBeLessThan(SAFE_TX_DETAIL_POLL_MS)
    })

    test('should keep the normal cadence while signatures are still being collected', () => {
      expect(multisigDetailPollInterval('PENDING_SIGN')).toBe(SAFE_TX_DETAIL_POLL_MS)
      expect(multisigDetailPollInterval('READY_TO_EXECUTE')).toBe(SAFE_TX_DETAIL_POLL_MS)
    })
  })

  describe('negative', () => {
    test('should stop once the transaction is final', () => {
      expect(multisigDetailPollInterval('EXECUTED')).toBe(false)
      expect(multisigDetailPollInterval('FAILED')).toBe(false)
      expect(multisigDetailPollInterval('CANCELLED')).toBe(false)
    })
  })

  describe('edge cases', () => {
    test('should not poll before the detail has loaded', () => {
      expect(multisigDetailPollInterval(undefined)).toBe(false)
    })
  })
})
