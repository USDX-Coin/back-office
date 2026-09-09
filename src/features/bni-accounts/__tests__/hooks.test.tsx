import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { server } from '@/mocks/server'
import { resetMockData, issueMockJwt, getDefaultStaff } from '@/mocks/handlers'
import { createTestQueryClient } from '@/test/test-utils'
import {
  bniAccountsKeys,
  buildBniStatementPath,
  useBniBalances,
  useBniStatement,
  type BniStatementParams,
} from '../hooks'

// USDX-631 — sot/bni-integration.md § 16.4 "Perilaku query".

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  resetMockData()
})
afterAll(() => server.close())

function withClient() {
  const client = createTestQueryClient()
  document.cookie = `usdx_session=${issueMockJwt(getDefaultStaff()!)}; Path=/`
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return { client, wrapper }
}

function countRequests(pathPrefix: string) {
  const calls: string[] = []
  const listener = ({ request }: { request: Request }) => {
    const url = new URL(request.url)
    if (url.pathname.startsWith(pathPrefix)) calls.push(url.pathname + url.search)
  }
  server.events.on('request:start', listener)
  return {
    calls,
    stop: () => server.events.removeListener('request:start', listener),
  }
}

const TODAY = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10)
const NP_PARAMS: BniStatementParams = {
  accountNo: '108098391',
  startDate: TODAY,
  endDate: TODAY,
  type: 'DEBIT',
}

describe('buildBniStatementPath', () => {
  describe('positive', () => {
    test('encodes the three query params on the account path', () => {
      expect(buildBniStatementPath(NP_PARAMS)).toBe(
        `/api/v1/bni-accounts/108098391/statement?startDate=${TODAY}&endDate=${TODAY}&type=DEBIT`
      )
    })
  })

  describe('edge cases', () => {
    test('the statement key embeds the applied params so a new pull is a new key', () => {
      expect(bniAccountsKeys.statement(NP_PARAMS)).toEqual([
        'bni-accounts',
        'statement',
        NP_PARAMS,
      ])
    })
  })
})

describe('useBniBalances', () => {
  describe('positive', () => {
    test('fetches exactly once and again only on explicit refetch()', async () => {
      const { wrapper } = withClient()
      const probe = countRequests('/api/v1/bni-accounts/balances')
      const { result } = renderHook(() => useBniBalances(true), { wrapper })
      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(probe.calls).toHaveLength(1)

      const firstPullId = result.current.data!.pullId
      await act(async () => {
        await result.current.refetch()
      })
      expect(probe.calls).toHaveLength(2)
      await waitFor(() => expect(result.current.data!.pullId).not.toBe(firstPullId))
      probe.stop()
    })
  })

  describe('negative', () => {
    test('does not fire when disabled (no configured account)', async () => {
      const { wrapper } = withClient()
      const probe = countRequests('/api/v1/bni-accounts/balances')
      const { result } = renderHook(() => useBniBalances(false), { wrapper })
      await new Promise((r) => setTimeout(r, 30))
      expect(result.current.fetchStatus).toBe('idle')
      expect(probe.calls).toHaveLength(0)
      probe.stop()
    })

    test('a window focus event does not trigger a second bank call', async () => {
      const { wrapper } = withClient()
      const probe = countRequests('/api/v1/bni-accounts/balances')
      const { result } = renderHook(() => useBniBalances(true), { wrapper })
      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      act(() => {
        window.dispatchEvent(new Event('focus'))
        window.dispatchEvent(new Event('visibilitychange'))
      })
      await new Promise((r) => setTimeout(r, 30))
      expect(probe.calls).toHaveLength(1)
      probe.stop()
    })
  })

  describe('edge cases', () => {
    test('a 503 is surfaced as an error after ONE request (retry: false)', async () => {
      const { http, HttpResponse } = await import('msw')
      server.use(
        http.get('/api/v1/bni-accounts/balances', () =>
          HttpResponse.json(
            { status: 'error', metadata: null, data: null, error: { code: 'BNI_SERVICE_UNCONFIGURED', message: 'x' } },
            { status: 503 }
          )
        )
      )
      const { wrapper } = withClient()
      const probe = countRequests('/api/v1/bni-accounts/balances')
      const { result } = renderHook(() => useBniBalances(true), { wrapper })
      await waitFor(() => expect(result.current.isError).toBe(true))
      expect(probe.calls).toHaveLength(1)
      probe.stop()
    })
  })
})

describe('useBniStatement', () => {
  describe('positive', () => {
    test('idle while params are null, fetches once when they arrive', async () => {
      const { wrapper } = withClient()
      const probe = countRequests('/api/v1/bni-accounts/')
      const { result, rerender } = renderHook(
        ({ params }: { params: BniStatementParams | null }) => useBniStatement(params),
        { wrapper, initialProps: { params: null as BniStatementParams | null } }
      )
      expect(result.current.fetchStatus).toBe('idle')
      expect(probe.calls).toHaveLength(0)

      rerender({ params: NP_PARAMS })
      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(probe.calls).toHaveLength(1)
      expect(probe.calls[0]).toContain('type=DEBIT')
      expect(result.current.data!.rows.every((r) => r.flag === 'D')).toBe(true)
      probe.stop()
    })
  })

  describe('edge cases', () => {
    test('re-applying identical params after unmount is a fresh pull, not a cache hit (gcTime: 0)', async () => {
      const { wrapper } = withClient()
      const probe = countRequests('/api/v1/bni-accounts/')
      const first = renderHook(() => useBniStatement(NP_PARAMS), { wrapper })
      await waitFor(() => expect(first.result.current.isSuccess).toBe(true))
      first.unmount()
      // gcTime 0 schedules removal on a macrotask.
      await new Promise((r) => setTimeout(r, 10))

      const second = renderHook(() => useBniStatement(NP_PARAMS), { wrapper })
      await waitFor(() => expect(second.result.current.isSuccess).toBe(true))
      expect(probe.calls).toHaveLength(2)
      probe.stop()
    })
  })
})
