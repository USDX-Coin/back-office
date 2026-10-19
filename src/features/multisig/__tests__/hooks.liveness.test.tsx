import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { server } from '@/mocks/server'
import { useBackofficeTransactions, useOrderDetail } from '@/features/transactions/hooks'
import type { SafeTxDetail, SafeTxStatus } from '@/lib/types'
import { useExecuteSafeTx, useMultisigDetail } from '../hooks'

// Laporan lapangan: sesudah eksekusi Safe, desk menampilkan status basi sampai
// semenit. Dua akar, keduanya dibuktikan di sini dengan QueryClient berbentuk
// persis App.tsx (`staleTime` global 60 dtk):
//   1. Mutasi Safe hanya menyegarkan `['multisig', …]`, jadi Transaksi tetap
//      memegang jawaban lama.
//   2. Modal yang dibuka ulang dalam semenit memutar cache tanpa request.

const ID = 'tx_live'

let detailStatus: SafeTxStatus = 'READY_TO_EXECUTE'
let detailCalls = 0
let txCalls = 0
let orderCalls = 0

function detail(status: SafeTxStatus): SafeTxDetail {
  return {
    id: ID,
    chain: 'polygon',
    safeType: 'STAFF',
    safeAddress: '0xaA3e70397F3668D6Fd9C25e36a6FB151241EE015',
    nonce: 5,
    activity: 'MINT',
    activityLabel: 'Mint 100 USDX',
    signatureProgress: { collected: 2, threshold: 2 },
    proposerType: 'BACKEND',
    proposerAddress: '0x1111111111111111111111111111111111111111',
    status,
    safeTxHash: '0xhash',
    execTxHash: status === 'READY_TO_EXECUTE' ? null : '0xexec',
    createdAt: '2026-07-01T00:00:00.000Z',
    to: '0x2702d7043693651BB8A3D2Ec1C296B20692C7426',
    value: '0',
    data: '0x',
    operation: 0,
    decodedArgs: {},
    linkedRequestId: null,
    linkedOrderId: 'ord_1',
    signers: [],
    execPayload: null,
    lastExecError: null,
    executedByStaffName: null,
    executedAt: null,
  }
}

const envelope = (data: unknown) => HttpResponse.json({ status: 'success', metadata: null, data })

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

let qc: QueryClient
function setup() {
  detailStatus = 'READY_TO_EXECUTE'
  detailCalls = 0
  txCalls = 0
  orderCalls = 0
  server.use(
    http.get(`/api/v1/multisig/${ID}`, () => {
      detailCalls += 1
      return envelope(detail(detailStatus))
    }),
    http.post(`/api/v1/multisig/${ID}/execute`, () => {
      detailStatus = 'CONFIRMING'
      return envelope(detail('CONFIRMING'))
    }),
    http.get('/api/v1/transactions', () => {
      txCalls += 1
      return HttpResponse.json({ status: 'success', metadata: { page: 1, limit: 10, total: 0 }, data: [] })
    }),
    http.get('/api/v1/orders/:id', () => {
      orderCalls += 1
      return envelope({ id: 'ord_1', status: 'COMPLETED' })
    }),
  )
  // Bentuk App.tsx: staleTime global 60 dtk — override per-hook yang diuji.
  qc = new QueryClient({
    defaultOptions: { queries: { staleTime: 60 * 1000, retry: false }, mutations: { retry: false } },
  })
}

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

afterEach(() => qc.clear())

describe('desk liveness after a Safe execute', () => {
  describe('positive', () => {
    test('should refetch the Transaksi list after execute, not only the Safe queue', async () => {
      setup()
      const { result, unmount } = renderHook(
        () => ({ txs: useBackofficeTransactions({ needsAction: true }), execute: useExecuteSafeTx() }),
        { wrapper },
      )
      await waitFor(() => expect(result.current.txs.isSuccess).toBe(true))
      expect(txCalls).toBe(1)

      await act(() => result.current.execute.mutateAsync({ id: ID, body: { execTxHash: '0xexec' } }))

      await waitFor(() => expect(txCalls).toBe(2))
      unmount()
    })

    test('reopening the Safe detail within a minute should fetch it again', async () => {
      setup()
      const first = renderHook(() => useMultisigDetail(ID), { wrapper })
      await waitFor(() => expect(first.result.current.data?.status).toBe('READY_TO_EXECUTE'))
      first.unmount()

      // Dieksekusi di tempat lain sementara modal tertutup.
      detailStatus = 'CONFIRMING'
      const second = renderHook(() => useMultisigDetail(ID), { wrapper })
      await waitFor(() => expect(second.result.current.data?.status).toBe('CONFIRMING'))
      expect(detailCalls).toBe(2)
      second.unmount()
    })

    test('the detail turning final should refresh the other money-flow views', async () => {
      setup()
      detailStatus = 'CONFIRMING'
      const { result, unmount } = renderHook(
        () => ({ detail: useMultisigDetail(ID), txs: useBackofficeTransactions({}) }),
        { wrapper },
      )
      await waitFor(() => expect(result.current.detail.data?.status).toBe('CONFIRMING'))
      await waitFor(() => expect(result.current.txs.isSuccess).toBe(true))
      expect(txCalls).toBe(1)

      // Poll mendapati jaringan sudah mengonfirmasi — order di baliknya ikut selesai.
      detailStatus = 'EXECUTED'
      await act(() => result.current.detail.refetch())

      await waitFor(() => expect(txCalls).toBe(2))
      unmount()
    })
  })

  describe('negative', () => {
    test('a poll that is still CONFIRMING should not fan out', async () => {
      setup()
      detailStatus = 'CONFIRMING'
      const { result, unmount } = renderHook(
        () => ({ detail: useMultisigDetail(ID), txs: useBackofficeTransactions({}) }),
        { wrapper },
      )
      await waitFor(() => expect(result.current.detail.data?.status).toBe('CONFIRMING'))
      await waitFor(() => expect(result.current.txs.isSuccess).toBe(true))

      await act(() => result.current.detail.refetch())
      expect(detailCalls).toBe(2)
      expect(txCalls).toBe(1)
      unmount()
    })

    test('a failed execute should not refetch the Transaksi list', async () => {
      setup()
      server.use(
        http.post(`/api/v1/multisig/${ID}/execute`, () =>
          HttpResponse.json(
            { status: 'error', metadata: null, data: null, error: { code: 'SAFE_TX_NOT_EXECUTABLE', message: 'x' } },
            { status: 409 },
          ),
        ),
      )
      const { result, unmount } = renderHook(
        () => ({ txs: useBackofficeTransactions({}), execute: useExecuteSafeTx() }),
        { wrapper },
      )
      await waitFor(() => expect(result.current.txs.isSuccess).toBe(true))
      await act(async () => {
        await expect(
          result.current.execute.mutateAsync({ id: ID, body: { execTxHash: '0xexec' } }),
        ).rejects.toThrow()
      })
      expect(txCalls).toBe(1)
      unmount()
    })
  })

  describe('edge cases', () => {
    test('order detail (writes pii_access_audit for redeem) should NOT refetch on reopen', async () => {
      // Pengecualian yang disengaja: tiap GET /orders/{id} redeem = satu baris
      // "staf membuka rekening". Kesegaran sesudah aksi datang dari invalidasi.
      setup()
      const first = renderHook(() => useOrderDetail('ord_1'), { wrapper })
      await waitFor(() => expect(first.result.current.isSuccess).toBe(true))
      first.unmount()

      const second = renderHook(() => useOrderDetail('ord_1'), { wrapper })
      expect(second.result.current.isSuccess).toBe(true)
      expect(second.result.current.isFetching).toBe(false)
      // Beri waktu nyata — refetch-on-mount yang tertunda pun sempat berangkat.
      await act(() => new Promise((r) => setTimeout(r, 50)))
      expect(second.result.current.isFetching).toBe(false)
      expect(orderCalls).toBe(1)
      second.unmount()
    })

    test('…but a money action should still mark it stale for the next open', async () => {
      setup()
      const order = renderHook(() => useOrderDetail('ord_1'), { wrapper })
      await waitFor(() => expect(order.result.current.isSuccess).toBe(true))
      order.unmount()

      const exec = renderHook(() => useExecuteSafeTx(), { wrapper })
      await act(() => exec.result.current.mutateAsync({ id: ID, body: { execTxHash: '0xexec' } }))
      // Tidak sedang terbuka → tidak ditarik sekarang (tidak ada jejak audit palsu)…
      expect(orderCalls).toBe(1)
      expect(qc.getQueryState(['orders', 'detail', 'ord_1'])?.isInvalidated).toBe(true)

      // …dan ditarik saat seseorang benar-benar membukanya lagi.
      const reopened = renderHook(() => useOrderDetail('ord_1'), { wrapper })
      await waitFor(() => expect(orderCalls).toBe(2))
      reopened.unmount()
      exec.unmount()
    })

    test('a Safe tx with no linked order (governance) should not mark any order detail stale', async () => {
      setup()
      server.use(
        http.post(`/api/v1/multisig/${ID}/execute`, () =>
          envelope({ ...detail('CONFIRMING'), linkedOrderId: null }),
        ),
      )
      const order = renderHook(() => useOrderDetail('ord_1'), { wrapper })
      await waitFor(() => expect(order.result.current.isSuccess).toBe(true))
      order.unmount()

      const exec = renderHook(() => useExecuteSafeTx(), { wrapper })
      await act(() => exec.result.current.mutateAsync({ id: ID, body: { execTxHash: '0xexec' } }))
      expect(qc.getQueryState(['orders', 'detail', 'ord_1'])?.isInvalidated).toBe(false)
      exec.unmount()
    })

    test('switching rows (↑/↓) from a CONFIRMING tx to an EXECUTED one should not fan out', async () => {
      setup()
      detailStatus = 'CONFIRMING'
      server.use(
        http.get('/api/v1/multisig/tx_done', () => envelope({ ...detail('EXECUTED'), id: 'tx_done' })),
      )
      const { result, rerender, unmount } = renderHook(
        ({ id }: { id: string }) => ({ detail: useMultisigDetail(id), txs: useBackofficeTransactions({}) }),
        { wrapper, initialProps: { id: ID } },
      )
      await waitFor(() => expect(result.current.detail.data?.status).toBe('CONFIRMING'))
      await waitFor(() => expect(result.current.txs.isSuccess).toBe(true))

      // Baris tujuan sudah pernah dibuka (ada di cache) — status langsung
      // CONFIRMING (tx lain) → EXECUTED tanpa jeda `undefined` di antaranya.
      qc.setQueryData(['multisig', 'detail', 'tx_done'], { ...detail('EXECUTED'), id: 'tx_done' })
      rerender({ id: 'tx_done' })
      await waitFor(() => expect(result.current.detail.data?.status).toBe('EXECUTED'))
      await act(() => new Promise((r) => setTimeout(r, 50)))
      expect(txCalls).toBe(1)
      unmount()
    })
  })
})
