import { describe, test, expect, beforeAll, beforeEach, afterAll, afterEach } from 'vitest'
import type { ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { createTestQueryClient } from '@/test/test-utils'
import { POLL_ACTIVE_MS, POLL_BADGE_MS } from '@/lib/queryConfig'
import { SAFE_TX_COUNTED_STATUSES } from '@/lib/multisig/status'
import { useOrderList } from '@/features/transactions/hooks'
import type { OrderListItem, SafeTxDetail } from '@/lib/types'
import {
  multisigCountPollInterval,
  multisigDetailPollInterval,
  multisigListPollInterval,
  useConfirmSignature,
  useExecuteSafeTx,
  useMultisigDetail,
} from '../hooks'

// Stale-UI regressions this file guards (real incident during an OTC mint):
//   1. Signing left the drawer describing the world BEFORE the click until a
//      background refetch happened to land.
//   2. The consumer order views kept showing the pre-signature state, because
//      multisig mutations only ever invalidated ['multisig', …].
//   3. A poll that left before the signature was recorded could land after it
//      and undo the fresh state.
//   4. Settled rows must stop polling entirely — "live" is not "unbounded".

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const ID = '019f1cb1-57d3-73a4-b4fb-3d510ba4aa94'
const OWNER = '0x444444840C416D1e7765de855c9100B0A31184d7'
const OTHER = '0x1111111111111111111111111111111111111111'
const DETAIL_KEY = ['multisig', 'detail', ID]

function makeDetail(overrides: Partial<SafeTxDetail> = {}): SafeTxDetail {
  return {
    id: ID,
    chain: 'polygon',
    safeType: 'STAFF',
    safeAddress: '0xaA3e70397F3668D6Fd9C25e36a6FB151241EE015',
    nonce: 5,
    activity: 'MINT',
    activityLabel: 'Mint 100 USDX',
    signatureProgress: { collected: 1, threshold: 2 },
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
    linkedOrderId: 'ord_1',
    signers: [],
    execPayload: null,
    lastExecError: null,
    executedByStaffName: null,
    executedAt: null,
    ...overrides,
  }
}

/** Pre-signature snapshot — what the drawer was already showing. */
const pendingDetail = makeDetail()
/** What the backend answers the confirm POST with: the second signature landed. */
const signedDetail = makeDetail({
  status: 'READY_TO_EXECUTE',
  signatureProgress: { collected: 2, threshold: 2 },
})
const executedDetail = makeDetail({
  status: 'CONFIRMING',
  signatureProgress: { collected: 2, threshold: 2 },
  execTxHash: '0xexec',
})

function envelope<T>(data: T) {
  return HttpResponse.json({ status: 'success', metadata: null, data })
}

function orderRow(overrides: Partial<OrderListItem> = {}): OrderListItem {
  return {
    id: 'ord_1',
    type: 'MINT',
    userId: 'usr_1',
    userEmail: 'alice@example.com',
    amount: '250.00',
    totalPayIdr: '4078500.00',
    netPayoutIdr: null,
    chain: 'polygon',
    paymentStatus: 'PAID',
    safeStatus: 'EXECUTED',
    // Terminal on purpose: with the row settled the order list never polls, so
    // any refetch the test observes can only have come from the invalidation.
    status: 'COMPLETED',
    createdAt: '2026-06-01T00:00:00Z',
    ...overrides,
  }
}

function orderPage(rows: OrderListItem[]) {
  return HttpResponse.json({
    status: 'success',
    metadata: { page: 1, limit: 10, total: rows.length },
    data: rows,
  })
}

let qc: QueryClient
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

beforeEach(() => {
  qc = createTestQueryClient()
})

// ─── polling cadence ────────────────────────────────────────────────────────

describe('multisig poll cadence', () => {
  describe('positive', () => {
    test('polls the queue at the active cadence while any row is in flight', () => {
      expect(
        multisigListPollInterval([{ status: 'EXECUTED' }, { status: 'PENDING_SIGN' }]),
      ).toBe(POLL_ACTIVE_MS)
      expect(multisigListPollInterval([{ status: 'CONFIRMING' }])).toBe(POLL_ACTIVE_MS)
    })

    test('polls an open detail while the transaction is still moving', () => {
      expect(multisigDetailPollInterval('PENDING_SIGN')).toBe(POLL_ACTIVE_MS)
      expect(multisigDetailPollInterval('READY_TO_EXECUTE')).toBe(POLL_ACTIVE_MS)
      expect(multisigDetailPollInterval('CONFIRMING')).toBe(POLL_ACTIVE_MS)
    })
  })

  describe('negative', () => {
    test('stops entirely once every row has settled', () => {
      expect(
        multisigListPollInterval([
          { status: 'EXECUTED' },
          { status: 'FAILED' },
          { status: 'CANCELLED' },
        ]),
      ).toBe(false)
    })

    test('stops on a terminal detail — executed money is not re-fetched forever', () => {
      expect(multisigDetailPollInterval('EXECUTED')).toBe(false)
      expect(multisigDetailPollInterval('FAILED')).toBe(false)
      expect(multisigDetailPollInterval('CANCELLED')).toBe(false)
    })
  })

  describe('edge cases', () => {
    test('an empty or not-yet-loaded queue does not poll', () => {
      expect(multisigListPollInterval([])).toBe(false)
      expect(multisigListPollInterval(undefined)).toBe(false)
    })

    test('a detail with no data yet does not poll', () => {
      expect(multisigDetailPollInterval(undefined)).toBe(false)
    })

    test('the three badge polls are staggered so they never share a tick', () => {
      const intervals = SAFE_TX_COUNTED_STATUSES.map(multisigCountPollInterval)
      expect(new Set(intervals).size).toBe(intervals.length)
      expect(Math.min(...intervals)).toBeGreaterThanOrEqual(POLL_BADGE_MS)
      // At most ONE badge can coincide with the 5s queue/detail cadence, so the
      // worst-case burst on this page is three requests in a throttle window,
      // not five (sot/conventions.md § Rate Limiting — 5 req/s per user).
      expect(intervals.filter((ms) => ms % POLL_ACTIVE_MS === 0)).toHaveLength(1)
    })

    test('an uncounted status still gets a valid interval', () => {
      expect(multisigCountPollInterval('EXECUTED')).toBe(POLL_BADGE_MS)
    })
  })
})

// ─── mutation → cache ───────────────────────────────────────────────────────

describe('multisig mutations keep the desk in sync', () => {
  describe('positive', () => {
    test('a successful sign is in the detail cache the moment the call resolves', async () => {
      // The GET keeps answering with the pre-signature snapshot, so the only way
      // the assertion below can pass is the mutation's OWN response being
      // written into the cache — not a lucky refetch.
      server.use(
        http.post(`/api/v1/multisig/${ID}/confirm`, () => envelope(signedDetail)),
        http.get(`/api/v1/multisig/${ID}`, () => envelope(pendingDetail)),
      )

      const { result } = renderHook(
        () => ({ detail: useMultisigDetail(ID), confirm: useConfirmSignature(ID) }),
        { wrapper },
      )
      await waitFor(() => expect(result.current.detail.data?.status).toBe('PENDING_SIGN'))

      await act(async () => {
        await result.current.confirm.mutateAsync({
          signerAddress: OWNER,
          signature: '0xsignature',
        })
      })

      // No waitFor: invalidation alone would leave the panel on the old payload
      // for a whole round trip, which is exactly the window the operator sees.
      expect(qc.getQueryData<SafeTxDetail>(DETAIL_KEY)).toMatchObject({
        status: 'READY_TO_EXECUTE',
        signatureProgress: { collected: 2, threshold: 2 },
      })
    })

    test('a successful execute lands the same way', async () => {
      // The GET keeps answering with the pre-execute payload, so only the
      // mutation's own response can produce the CONFIRMING assertion below.
      server.use(
        http.post(`/api/v1/multisig/${ID}/execute`, () => envelope(executedDetail)),
        http.get(`/api/v1/multisig/${ID}`, () => envelope(signedDetail)),
      )

      const { result } = renderHook(
        () => ({ detail: useMultisigDetail(ID), execute: useExecuteSafeTx(ID) }),
        { wrapper },
      )
      await waitFor(() => expect(result.current.detail.data?.status).toBe('READY_TO_EXECUTE'))

      await act(async () => {
        await result.current.execute.mutateAsync({ execTxHash: '0xexec' })
      })

      expect(qc.getQueryData<SafeTxDetail>(DETAIL_KEY)).toMatchObject({
        status: 'CONFIRMING',
        execTxHash: '0xexec',
      })
    })

    test('signing refreshes the consumer order views, not just the multisig queue', async () => {
      let orderCalls = 0
      server.use(
        http.get('/api/v1/orders', () => {
          orderCalls += 1
          return orderPage([orderRow()])
        }),
        http.post(`/api/v1/multisig/${ID}/confirm`, () => envelope(signedDetail)),
      )

      const { result } = renderHook(
        () => ({ orders: useOrderList({}), confirm: useConfirmSignature(ID) }),
        { wrapper },
      )
      await waitFor(() => expect(result.current.orders.isSuccess).toBe(true))
      expect(orderCalls).toBe(1)

      await act(async () => {
        await result.current.confirm.mutateAsync({
          signerAddress: OWNER,
          signature: '0xsignature',
        })
      })

      // /transactions reads ['orders', …]; before this it sat on the pre-signature
      // state until its own poll came round.
      await waitFor(() => expect(orderCalls).toBe(2))
    })
  })

  describe('negative', () => {
    test('a rejected sign leaves both the detail and the order views untouched', async () => {
      let orderCalls = 0
      server.use(
        http.get(`/api/v1/multisig/${ID}`, () => envelope(pendingDetail)),
        http.get('/api/v1/orders', () => {
          orderCalls += 1
          return orderPage([orderRow()])
        }),
        http.post(`/api/v1/multisig/${ID}/confirm`, () =>
          HttpResponse.json(
            {
              status: 'error',
              metadata: null,
              data: null,
              error: { code: 'SAFE_TX_NOT_SIGNABLE', message: 'Not signable' },
            },
            { status: 409 },
          ),
        ),
      )

      const { result } = renderHook(
        () => ({
          detail: useMultisigDetail(ID),
          orders: useOrderList({}),
          confirm: useConfirmSignature(ID),
        }),
        { wrapper },
      )
      await waitFor(() => expect(result.current.orders.isSuccess).toBe(true))
      await waitFor(() => expect(result.current.detail.data?.status).toBe('PENDING_SIGN'))

      await act(async () => {
        await expect(
          result.current.confirm.mutateAsync({
            signerAddress: OWNER,
            signature: '0xsignature',
          }),
        ).rejects.toThrow()
      })

      expect(qc.getQueryData<SafeTxDetail>(DETAIL_KEY)).toMatchObject({
        status: 'PENDING_SIGN',
        signatureProgress: { collected: 1, threshold: 2 },
      })
      expect(orderCalls).toBe(1)
    })
  })

  describe('edge cases', () => {
    test('a poll that left before the signature cannot undo it', async () => {
      // GET #1 loads the drawer. GET #2 is the poll already in flight when the
      // operator signs: it answers with the pre-signature snapshot and must be
      // discarded, not applied on top of the freshly-signed state.
      let getCount = 0
      let releaseStalePoll = () => {}
      const stalePollHeld = new Promise<void>((resolve) => {
        releaseStalePoll = resolve
      })
      server.use(
        http.get(`/api/v1/multisig/${ID}`, async () => {
          getCount += 1
          if (getCount === 2) await stalePollHeld
          return envelope(pendingDetail)
        }),
        http.post(`/api/v1/multisig/${ID}/confirm`, () => envelope(signedDetail)),
      )

      const { result } = renderHook(
        () => ({ detail: useMultisigDetail(ID), confirm: useConfirmSignature(ID) }),
        { wrapper },
      )
      await waitFor(() => expect(result.current.detail.data?.status).toBe('PENDING_SIGN'))

      // Start the doomed poll, then sign while it is still hanging.
      act(() => {
        void result.current.detail.refetch()
      })
      await waitFor(() => expect(getCount).toBe(2))

      await act(async () => {
        await result.current.confirm.mutateAsync({
          signerAddress: OWNER,
          signature: '0xsignature',
        })
      })

      await act(async () => {
        releaseStalePoll()
        await stalePollHeld
      })

      await waitFor(() =>
        expect(qc.getQueryData<SafeTxDetail>(DETAIL_KEY)?.status).toBe('READY_TO_EXECUTE'),
      )
      // And it stays there — the late response is dropped, not merely overtaken.
      await new Promise((resolve) => setTimeout(resolve, 30))
      expect(qc.getQueryData<SafeTxDetail>(DETAIL_KEY)?.status).toBe('READY_TO_EXECUTE')
    })
  })
})
